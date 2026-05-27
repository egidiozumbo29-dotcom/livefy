import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SESSION_COOKIE = "owner_hub_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 giorni
const MAGIC_TTL_MS = 1000 * 60 * 15; // 15 minuti

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function allowedEmails(): string[] {
  return (process.env.OWNER_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string): boolean {
  const list = allowedEmails();
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}

export async function createMagicLink(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hash(token);
  const expiresAt = new Date(Date.now() + MAGIC_TTL_MS);
  await prisma.magicLinkToken.create({
    data: { email: email.trim().toLowerCase(), tokenHash, expiresAt },
  });
  const base = process.env.OWNER_HUB_URL ?? "http://localhost:3100";
  return `${base}/api/auth/verify?token=${token}`;
}

export async function consumeMagicLink(token: string): Promise<string | null> {
  const tokenHash = hash(token);
  const record = await prisma.magicLinkToken.findUnique({
    where: { tokenHash },
  });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;
  await prisma.magicLinkToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record.email;
}

export async function createSession(email: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hash(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.ownerSession.create({
    data: { email: email.trim().toLowerCase(), tokenHash, expiresAt },
  });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const c = cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = hash(token);
    await prisma.ownerSession.deleteMany({ where: { tokenHash } });
  }
  c.delete(SESSION_COOKIE);
}

export async function getSessionEmail(): Promise<string | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hash(token);
  const session = await prisma.ownerSession.findUnique({ where: { tokenHash } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.ownerSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!isEmailAllowed(session.email)) return null;
  return session.email;
}
