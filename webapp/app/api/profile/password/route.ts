import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { getUserFromSession } from "@/src/lib/auth";
import { logRouteError } from "@/src/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { oldPassword, newPassword } = body as {
      oldPassword?: string;
      newPassword?: string;
    };

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: "oldPassword and newPassword are required" },
        { status: 400 }
      );
    }

    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logRouteError("password update failed", error, { userId: user.id });
    return NextResponse.json(
      { error: "Server error updating password" },
      { status: 500 }
    );
  }
}
