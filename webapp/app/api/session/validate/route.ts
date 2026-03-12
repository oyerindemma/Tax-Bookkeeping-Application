import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/src/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
