import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink, createSession, isEmailAllowed } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?err=invalid", req.url));
  }
  const email = await consumeMagicLink(token);
  if (!email || !isEmailAllowed(email)) {
    return NextResponse.redirect(new URL("/login?err=invalid", req.url));
  }
  await createSession(email);
  return NextResponse.redirect(new URL("/", req.url));
}
