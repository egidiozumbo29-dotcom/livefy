import { Prisma } from "../generated/prisma";
import { prisma } from "./prisma";

export const EVENT_TYPES = {
  TIP: "TIP",
  STREAM_ACCESS: "STREAM_ACCESS",
  GALLERY_PURCHASE: "GALLERY_PURCHASE",
  PAYOUT_REQUESTED: "PAYOUT_REQUESTED",
  PAYOUT_PAID: "PAYOUT_PAID",
  OWNER_REVENUE: "OWNER_REVENUE",
  USER_SIGNUP: "USER_SIGNUP",
  USER_LOGIN: "USER_LOGIN",
} as const;

export type Range = { from: Date; to: Date };

export type PlatformKpi = {
  platformId: string;
  platformName: string;
  grossEur: number;
  payoutEur: number;
  ownerEur: number;
  events: number;
  signups: number;
};

function decToNumber(d: Prisma.Decimal | null | undefined): number {
  if (!d) return 0;
  return Number(d.toString());
}

export async function computeKpis(range: Range): Promise<{
  totals: Omit<PlatformKpi, "platformId" | "platformName">;
  perPlatform: PlatformKpi[];
}> {
  const platforms = await prisma.platform.findMany({
    orderBy: { name: "asc" },
  });

  const where = {
    occurredAt: { gte: range.from, lte: range.to },
  } as const;

  const [
    grossAgg,
    payoutAgg,
    ownerAgg,
    eventsAgg,
    signupAgg,
  ] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["platformId"],
      where: {
        ...where,
        type: {
          in: [
            EVENT_TYPES.TIP,
            EVENT_TYPES.STREAM_ACCESS,
            EVENT_TYPES.GALLERY_PURCHASE,
          ],
        },
      },
      _sum: { amountEur: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["platformId"],
      where: { ...where, type: EVENT_TYPES.PAYOUT_PAID },
      _sum: { amountEur: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["platformId"],
      where: { ...where, type: EVENT_TYPES.OWNER_REVENUE },
      _sum: { amountEur: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["platformId"],
      where,
      _count: { _all: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["platformId"],
      where: { ...where, type: EVENT_TYPES.USER_SIGNUP },
      _count: { _all: true },
    }),
  ]);

  const grossMap = new Map(
    grossAgg.map((r) => [r.platformId, decToNumber(r._sum.amountEur)]),
  );
  const payoutMap = new Map(
    payoutAgg.map((r) => [r.platformId, decToNumber(r._sum.amountEur)]),
  );
  const ownerMap = new Map(
    ownerAgg.map((r) => [r.platformId, decToNumber(r._sum.amountEur)]),
  );
  const eventsMap = new Map(
    eventsAgg.map((r) => [r.platformId, r._count._all]),
  );
  const signupMap = new Map(
    signupAgg.map((r) => [r.platformId, r._count._all]),
  );

  const perPlatform: PlatformKpi[] = platforms.map((p) => ({
    platformId: p.id,
    platformName: p.name,
    grossEur: grossMap.get(p.id) ?? 0,
    payoutEur: payoutMap.get(p.id) ?? 0,
    ownerEur: ownerMap.get(p.id) ?? 0,
    events: eventsMap.get(p.id) ?? 0,
    signups: signupMap.get(p.id) ?? 0,
  }));

  const totals = perPlatform.reduce(
    (acc, p) => ({
      grossEur: acc.grossEur + p.grossEur,
      payoutEur: acc.payoutEur + p.payoutEur,
      ownerEur: acc.ownerEur + p.ownerEur,
      events: acc.events + p.events,
      signups: acc.signups + p.signups,
    }),
    { grossEur: 0, payoutEur: 0, ownerEur: 0, events: 0, signups: 0 },
  );

  return { totals, perPlatform };
}

export async function recentEvents(limit = 50) {
  return prisma.analyticsEvent.findMany({
    orderBy: { occurredAt: "desc" },
    take: limit,
    include: { platform: { select: { name: true } } },
  });
}

export type DailyPoint = { date: string; grossEur: number; ownerEur: number; events: number };

export async function dailyEarnings(range: Range): Promise<DailyPoint[]> {
  const rows = await prisma.analyticsEvent.findMany({
    where: { occurredAt: { gte: range.from, lte: range.to } },
    select: { occurredAt: true, type: true, amountEur: true },
    orderBy: { occurredAt: "asc" },
  });

  const map = new Map<string, DailyPoint>();

  for (const row of rows) {
    const date = row.occurredAt.toISOString().slice(0, 10);
    if (!map.has(date)) map.set(date, { date, grossEur: 0, ownerEur: 0, events: 0 });
    const point = map.get(date)!;
    point.events += 1;
    const eur = row.amountEur ? Number(row.amountEur.toString()) : 0;
    if (
      row.type === EVENT_TYPES.TIP ||
      row.type === EVENT_TYPES.STREAM_ACCESS ||
      row.type === EVENT_TYPES.GALLERY_PURCHASE
    ) {
      point.grossEur = Math.round((point.grossEur + eur) * 10000) / 10000;
    }
    if (row.type === EVENT_TYPES.OWNER_REVENUE) {
      point.ownerEur = Math.round((point.ownerEur + eur) * 10000) / 10000;
    }
  }

  return Array.from(map.values());
}

export async function exportEventsAsCsv(range: Range): Promise<string> {
  const rows = await prisma.analyticsEvent.findMany({
    where: { occurredAt: { gte: range.from, lte: range.to } },
    orderBy: { occurredAt: "desc" },
    include: { platform: { select: { name: true } } },
    take: 10000,
  });

  const header = "date,platform,type,userId,username,amountTokens,amountEur,currency";
  const lines = rows.map((r) => {
    const cols = [
      r.occurredAt.toISOString().slice(0, 19).replace("T", " "),
      r.platform.name,
      r.type,
      r.userId ?? "",
      r.username ?? "",
      r.amountTokens != null ? r.amountTokens.toString() : "",
      r.amountEur != null ? Number(r.amountEur.toString()).toFixed(4) : "",
      r.currency ?? "EUR",
    ];
    return cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(",");
  });

  return [header, ...lines].join("\n");
}
