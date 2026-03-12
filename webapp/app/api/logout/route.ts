import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildSessionCookieOptions,
  deleteSessionByToken,
  SESSION_COOKIE_NAME,
} from "@/src/lib/auth";
import {
  buildWorkspaceCookieOptions,
  WORKSPACE_COOKIE_NAME,
} from "@/src/lib/workspaces";
import { logRouteError } from "@/src/lib/logger";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      await deleteSessionByToken(token);
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE_NAME, "", {
      ...buildSessionCookieOptions(),
      maxAge: 0,
    });
    res.cookies.set(WORKSPACE_COOKIE_NAME, "", {
      ...buildWorkspaceCookieOptions(),
      maxAge: 0,
    });
    return res;
  } catch (error) {
    logRouteError("logout failed", error);
    return NextResponse.json(
      { error: "Server error logging out" },
      { status: 500 }
    );
  }
}
