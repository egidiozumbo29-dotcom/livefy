import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Credenziali demo — solo per sviluppo locale. */
const STREAMER = {
  email: "streamer@demo.synthra",
  username: "demo_streamer",
  password: "StreamerDemo123!",
};

const ADMIN = {
  email: "admin@demo.synthra",
  username: "demo_admin",
  password: "AdminDemo123!",
};

async function main() {
  const passwordHash = await bcrypt.hash(STREAMER.password, 12);
  const birthDate = new Date("1990-05-15");

  await prisma.user.upsert({
    where: { email: STREAMER.email },
    update: {
      passwordHash,
      role: Role.MODEL,
      banned: false,
      ageVerified: true,
      username: STREAMER.username,
    },
    create: {
      username: STREAMER.username,
      email: STREAMER.email,
      passwordHash,
      role: Role.MODEL,
      birthDate,
      ageVerified: true,
      language: "it",
      country: "IT",
      category: "Demo",
      tags: ["demo", "live"],
      bio: "Account streamer di sviluppo (seed Prisma).",
    },
  });

  await prisma.user.upsert({
    where: { email: ADMIN.email },
    update: {
      passwordHash: await bcrypt.hash(ADMIN.password, 12),
      role: Role.ADMIN,
      banned: false,
      ageVerified: true,
      username: ADMIN.username,
    },
    create: {
      username: ADMIN.username,
      email: ADMIN.email,
      passwordHash: await bcrypt.hash(ADMIN.password, 12),
      role: Role.ADMIN,
      birthDate,
      ageVerified: true,
      language: "it",
      country: "IT",
      bio: "Account admin di sviluppo (seed Prisma).",
    },
  });

  console.log(
    `\n  Account demo creati:\n    Streamer: ${STREAMER.email} / ${STREAMER.password}\n    Admin:    ${ADMIN.email} / ${ADMIN.password}\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
