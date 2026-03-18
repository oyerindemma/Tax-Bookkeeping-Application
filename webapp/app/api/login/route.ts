import { NextResponse } from "next/server";
import { seedDefaultExpenseCategories } from "@/src/lib/expense-categories";
import {
  buildSessionCookieOptions,
  createSession,
  normalizeEmail,
  SESSION_COOKIE_NAME,
  validateEmail,
  verifyPassword,
} from "@/src/lib/auth";
import {
  attachTraceId,
  buildTraceErrorPayload,
  createRouteLogger,
  hashForLogs,
} from "@/src/lib/observability";
import { prisma } from "@/src/lib/prisma";
import {
  buildWorkspaceCookieOptions,
  WORKSPACE_COOKIE_NAME,
} from "@/src/lib/workspaces";

export const runtime = "nodejs";

type LoginBody = {
  email?: string;
  password?: string;
};

function buildValidationError(body: LoginBody) {
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fieldErrors: Record<string, string> = {};

  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;

  if (!password) {
    fieldErrors.password = "Enter your password.";
  }

  if (Object.keys(fieldErrors).length === 0) {
    return null;
  }

  return {
    error: "Please enter both your email and password.",
    fieldErrors,
  };
}

export async function POST(req: Request) {
  const logger = createRouteLogger("/api/login", req);

  try {
    const body = (await req.json()) as LoginBody;
    const validationError = buildValidationError(body);
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";

    if (validationError) {
      logger.warn("validation failed", {
        emailHash: email ? hashForLogs(email) : null,
      });
      return attachTraceId(
        NextResponse.json(validationError, { status: 400 }),
        logger.traceId
      );
    }

    const password = body.password ?? "";
    logger.info("login attempt", {
      emailHash: hashForLogs(email),
    });

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        fullName: true,
        role: true,
      },
    });

    if (!user) {
      logger.warn("login rejected", {
        emailHash: hashForLogs(email),
        reason: "missing_user",
      });
      return attachTraceId(
        NextResponse.json({ error: "Invalid email or password." }, { status: 401 }),
        logger.traceId
      );
    }

    const passwordMatches = await verifyPassword(password, user.password);
    if (!passwordMatches) {
      logger.warn("login rejected", {
        emailHash: hashForLogs(email),
        reason: "invalid_password",
      });
      return attachTraceId(
        NextResponse.json({ error: "Invalid email or password." }, { status: 401 }),
        logger.traceId
      );
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
                  plan: "STARTER",
                  status: "free",
                },
              },
            },
            select: { id: true },
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

    logger.info("login completed", {
      userId: user.id,
      workspaceId,
    });
    return attachTraceId(res, logger.traceId);
  } catch (error) {
    logger.error("login failed", error);
    return attachTraceId(
      NextResponse.json(
        buildTraceErrorPayload(
          "We could not log you in right now. Please try again.",
          logger.traceId
        ),
        { status: 500 }
      ),
      logger.traceId
    );
  }
}
