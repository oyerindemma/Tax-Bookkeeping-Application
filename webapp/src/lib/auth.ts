import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import type { WorkspaceRole } from "@prisma/client";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  SESSION_MAX_AGE_SECONDS,
} from "@/src/lib/session-constants";
import { WORKSPACE_COOKIE_NAME } from "@/src/lib/workspaces";

export { SESSION_COOKIE_NAME, SESSION_TTL_DAYS, SESSION_MAX_AGE_SECONDS };

export function buildSessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function deleteSessionByToken(token: string) {
  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function getSessionByToken(token?: string) {
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session;
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getSessionByToken(token);
}

export async function getUserFromSession() {
  const session = await getSessionFromCookies();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getUserFromSession();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function getAuthContext() {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const cookieStore = await cookies();
  const rawWorkspace = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;
  const workspaceId = rawWorkspace ? Number(rawWorkspace) : NaN;
  let membership =
    Number.isFinite(workspaceId) && Number.isInteger(workspaceId)
      ? await prisma.workspaceMember.findFirst({
          where: {
            userId: session.userId,
            workspaceId,
            workspace: {
              archivedAt: null,
            },
          },
          select: { role: true, workspaceId: true },
        })
      : null;

  if (!membership) {
    membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: session.userId,
        workspace: {
          archivedAt: null,
        },
      },
      orderBy: { workspace: { name: "asc" } },
      select: { role: true, workspaceId: true },
    });
  }

  if (!membership) return null;

  return {
    userId: session.userId,
    workspaceId: membership.workspaceId,
    role: membership.role,
  };
}

export async function getWorkspaceAuth(workspaceId: number, userId?: number) {
  const resolvedUserId = userId ?? (await getSessionFromCookies())?.userId;
  if (!resolvedUserId) return null;

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: resolvedUserId,
      workspaceId,
      workspace: {
        archivedAt: null,
      },
    },
    select: { role: true },
  });

  if (!membership) return null;

  return {
    userId: resolvedUserId,
    workspaceId,
    role: membership.role as WorkspaceRole,
  };
}

const ROLE_ORDER: WorkspaceRole[] = ["VIEWER", "MEMBER", "ADMIN", "OWNER"];

export function isRoleAtLeast(role: WorkspaceRole, required: WorkspaceRole) {
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(required);
}

type RoleCheckResult =
  | { ok: true; context: { userId: number; workspaceId: number; role: WorkspaceRole } }
  | { ok: false; status: number; error: string };

export async function requireRoleAtLeast(
  workspaceId: number,
  required: WorkspaceRole
): Promise<RoleCheckResult> {
  const session = await getSessionFromCookies();
  if (!session) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.userId,
      workspaceId,
      workspace: {
        archivedAt: null,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    return { ok: false, status: 404, error: "Workspace not found" };
  }

  const role = membership.role as WorkspaceRole;
  if (!isRoleAtLeast(role, required)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return {
    ok: true,
    context: { userId: session.userId, workspaceId, role },
  };
}
