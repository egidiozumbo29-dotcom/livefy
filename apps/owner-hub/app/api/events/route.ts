import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "../../../generated/prisma";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  externalId: z.string().min(1).max(128),
  type: z.string().min(1).max(64),
  occurredAt: z.string().datetime(),
  userId: z.string().max(64).nullish(),
  username: z.string().max(120).nullish(),
  amountTokens: z.number().finite().nullish(),
  amountEur: z.number().finite().nullish(),
  currency: z.string().max(8).nullish(),
  meta: z.record(z.unknown()).nullish(),
});

const bodySchema = z.object({
  platform: z.object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(120),
    apiUrl: z.string().url().nullish(),
  }),
  events: z.array(eventSchema).min(1).max(500),
});

export async function POST(req: NextRequest) {
  const expected = process.env.OWNER_INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "ingest_disabled" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { platform, events } = parsed.data;

  await prisma.platform.upsert({
    where: { id: platform.id },
    update: {
      name: platform.name,
      apiUrl: platform.apiUrl ?? null,
    },
    create: {
      id: platform.id,
      name: platform.name,
      apiUrl: platform.apiUrl ?? null,
    },
  });

  let inserted = 0;
  let duplicates = 0;
  for (const ev of events) {
    try {
      await prisma.analyticsEvent.create({
        data: {
          platformId: platform.id,
          externalId: ev.externalId,
          type: ev.type,
          userId: ev.userId ?? null,
          username: ev.username ?? null,
          amountTokens: ev.amountTokens ?? null,
          amountEur: ev.amountEur ?? null,
          currency: ev.currency ?? null,
          meta: ev.meta
            ? (ev.meta as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          occurredAt: new Date(ev.occurredAt),
        },
      });
      inserted++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Unique constraint") || msg.includes("P2002")) {
        duplicates++;
      } else {
        return NextResponse.json(
          { error: "insert_failed", detail: msg },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({ ok: true, inserted, duplicates });
}
