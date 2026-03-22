import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { seedDefaultExpenseCategories } from "@/src/lib/expense-categories";
import {
  buildSessionCookieOptions,
  createSession,
  hashPassword,
  normalizeEmail,
  normalizeFullName,
  SESSION_COOKIE_NAME,
  validateEmail,
  validateFullName,
  validatePassword,
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

type SignupBody = {
  email?: string;
  password?: string;
  fullName?: string;
  confirmPassword?: string;
};

function buildValidationError(body: SignupBody) {
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const fullName = typeof body.fullName === "string" ? normalizeFullName(body.fullName) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  const fieldErrors: Record<string, string> = {};

  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;

  const nameError = validateFullName(fullName);
  if (nameError) fieldErrors.fullName = nameError;

  const passwordError = validatePassword(password);
  if (passwordError) fieldErrors.password = passwordError;

  if (confirmPassword && confirmPassword !== password) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (!confirmPassword) {
    fieldErrors.confirmPassword = "Confirm your password.";
  }

  if (Object.keys(fieldErrors).length === 0) {
    return null;
  }

  return {
    error: "Please correct the highlighted fields.",
    fieldErrors,
  };
}

export async function POST(req: Request) {
  const logger = createRouteLogger("/api/signup", req);

  try {
    const body = (await req.json()) as SignupBody;
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

    const fullName = normalizeFullName(body.fullName ?? "");
    const passwordHash = await hashPassword(body.password ?? "");
    logger.info("signup attempt", {
      emailHash: hashForLogs(email),
    });

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      logger.warn("duplicate email rejected", {
        emailHash: hashForLogs(email),
      });
      return attachTraceId(
        NextResponse.json(
          {
            error: "An account already exists for that email. Log in instead.",
            fieldErrors: {
              email: "An account already exists for this email address.",
            },
          },
          { status: 409 }
        ),
        logger.traceId
      );
    }

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          password: passwordHash,
          fullName,
          role: "USER",
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: `${fullName}'s Workspace`,
          members: {
            create: {
              userId: createdUser.id,
              role: "OWNER",
            },
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

      await seedDefaultExpenseCategories(tx, workspace.id);

      return {
        user: createdUser,
        workspaceId: workspace.id,
      };
    });

    const { token, expiresAt } = await createSession(user.user.id);
    const res = NextResponse.json(
      {
        user: user.user,
      },
      { status: 201 }
    );

    res.cookies.set(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(expiresAt));
    res.cookies.set(
      WORKSPACE_COOKIE_NAME,
      String(user.workspaceId),
      buildWorkspaceCookieOptions()
    );
    logger.info("signup completed", {
      userId: user.user.id,
      workspaceId: user.workspaceId,
    });

    return attachTraceId(res, logger.traceId);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      logger.warn("duplicate email race rejected");
      return attachTraceId(
        NextResponse.json(
          {
            error: "An account already exists for that email. Log in instead.",
            fieldErrors: {
              email: "An account already exists for this email address.",
            },
          },
          { status: 409 }
        ),
        logger.traceId
      );
    }

    logger.error("signup failed", error);
console.error("SIGNUP ERROR RAW:", error);

return attachTraceId(
  NextResponse.json(
    buildTraceErrorPayload(
      "We could not create your account right now. Please try again.",
      logger.traceId
    ),
    { status: 500 }
  ),
  logger.traceId
);
  }
}
