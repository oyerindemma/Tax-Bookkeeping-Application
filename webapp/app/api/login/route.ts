import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import {
  buildSessionCookieOptions,
  createSession,
  SESSION_COOKIE_NAME,
} from "@/src/lib/auth";
import {
  buildWorkspaceCookieOptions,
  WORKSPACE_COOKIE_NAME,
} from "@/src/lib/workspaces";
import { seedDefaultExpenseCategories } from "@/src/lib/expense-categories";
import { logRouteError } from "@/src/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const { token, expiresAt } = await createSession(user.id);
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: user.id,
        workspace: {
          archivedAt: null,
        },
      },
      orderBy: { workspace: { name: "asc" } },
    });
    let workspaceId = membership?.workspaceId;
    if (!workspaceId) {
      const totalMemberships = await prisma.workspaceMember.count({
        where: { userId: user.id },
      });
      if (totalMemberships === 0) {
        const workspace = await prisma.$transaction(async (tx) => {
          const createdWorkspace = await tx.workspace.create({
            data: {
              name: `${user.fullName}'s Workspace`,
              members: {
                create: { userId: user.id, role: "OWNER" },
              },
              subscription: {
                create: {
                  plan: "FREE",
                  status: "free",
                },
              },
            },
          });

          await seedDefaultExpenseCategories(tx, createdWorkspace.id);

          return createdWorkspace;
        });
        workspaceId = workspace.id;
      }
    }
    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(expiresAt));
    if (workspaceId) {
      res.cookies.set(
        WORKSPACE_COOKIE_NAME,
        String(workspaceId),
        buildWorkspaceCookieOptions()
      );
    }
    return res;
  } catch (error) {
    logRouteError("login failed", error);
    return NextResponse.json(
      { error: "Server error logging in" },
      { status: 500 }
    );
  }
}
