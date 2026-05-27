/* eslint-disable */
// Genera al volo un magic link per la email passata come argomento.
// Uso: node scripts/gen-magic-link.js egidiozumbo29@gmail.com
const crypto = require("node:crypto");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { PrismaClient } = require("../generated/prisma");

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Manca email. Uso: node scripts/gen-magic-link.js you@example.com");
  process.exit(1);
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.magicLinkToken.create({
      data: { email, tokenHash, expiresAt },
    });
    const base = process.env.OWNER_HUB_URL || "http://localhost:3100";
    console.log("\n=================== MAGIC LINK ===================");
    console.log(`${base}/api/auth/verify?token=${token}`);
    console.log("==================================================\n");
  } finally {
    await prisma.$disconnect();
  }
})();
