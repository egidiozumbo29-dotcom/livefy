/**
 * Script una tantum: ricalcola `creatorBalance` per ogni creator come:
 *   somma lorda tip ricevuti
 * + somma lorda accessi paid stream
 * + somma lorda acquisti galleria
 * - somma payout NON RIFIUTATI (PENDING, APPROVED, PAID)
 *
 * Eseguire con:
 *   npx tsx prisma/reconcile-creator-balance.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Prisma, PrismaClient, PayoutStatus, Role } from "@prisma/client";

function loadEnvFile() {
  const envPath = resolve(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvFile();

const prisma = new PrismaClient();

async function main() {
  const creators = await prisma.user.findMany({
    where: { role: { in: [Role.MODEL, Role.ADMIN, Role.MODERATOR] } },
    select: { id: true, username: true, creatorBalance: true },
  });

  console.log(`Riconcilio ${creators.length} creator...`);

  for (const c of creators) {
    const [tips, access, gallery, payouts] = await Promise.all([
      prisma.tip.aggregate({
        where: { receiverId: c.id },
        _sum: { amount: true },
      }),
      prisma.streamAccess.aggregate({
        where: { stream: { userId: c.id } },
        _sum: { pricePaid: true },
      }),
      prisma.galleryPurchase.aggregate({
        where: { item: { creatorId: c.id } },
        _sum: { pricePaid: true },
      }),
      prisma.payoutRequest.aggregate({
        where: {
          userId: c.id,
          status: {
            in: [PayoutStatus.PENDING, PayoutStatus.APPROVED, PayoutStatus.PAID],
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const tipsTk = tips._sum.amount
      ? new Prisma.Decimal(tips._sum.amount.toString())
      : new Prisma.Decimal(0);
    const accessTk = new Prisma.Decimal(access._sum.pricePaid ?? 0);
    const galleryTk = new Prisma.Decimal(gallery._sum.pricePaid ?? 0);
    const payoutsTk = payouts._sum.amount
      ? new Prisma.Decimal(payouts._sum.amount.toString())
      : new Prisma.Decimal(0);

    const target = tipsTk.add(accessTk).add(galleryTk).sub(payoutsTk);
    const targetClamped = target.lt(0) ? new Prisma.Decimal(0) : target;

    const oldBalance = new Prisma.Decimal(c.creatorBalance.toString());
    if (oldBalance.equals(targetClamped)) continue;

    await prisma.user.update({
      where: { id: c.id },
      data: { creatorBalance: targetClamped },
    });

    console.log(
      `  ${c.username}: ${oldBalance.toString()} -> ${targetClamped.toString()} (tips=${tipsTk}, access=${accessTk}, gallery=${galleryTk}, payouts=${payoutsTk})`,
    );
  }

  console.log("Riconciliazione completata.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
