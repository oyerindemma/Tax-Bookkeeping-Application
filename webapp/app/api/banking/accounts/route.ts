import { NextResponse } from "next/server";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { getWorkspaceFeatureAccess } from "@/src/lib/billing";
import { logAudit } from "@/src/lib/audit";
import { logRouteError } from "@/src/lib/logger";
import { createWorkspaceBankAccount } from "@/src/lib/banking";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

function parseOptionalId(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await requireRoleAtLeast(ctx.workspaceId, "VIEWER");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const featureAccess = await getWorkspaceFeatureAccess(ctx.workspaceId, "BANKING");
  if (!featureAccess.ok) {
    return NextResponse.json(
      {
        error: featureAccess.error,
        currentPlan: featureAccess.plan,
        requiredPlan: featureAccess.requiredPlan,
      },
      { status: 402 }
    );
  }

  try {
    const accounts = await prisma.bankAccount.findMany({
      where: {
        workspaceId: ctx.workspaceId,
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        clientBusiness: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        currency: account.currency,
        clientBusinessId: account.clientBusinessId ?? null,
        clientBusinessName: account.clientBusiness?.name ?? null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    logRouteError("bank accounts load failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await requireRoleAtLeast(ctx.workspaceId, "MEMBER");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const featureAccess = await getWorkspaceFeatureAccess(ctx.workspaceId, "BANKING");
  if (!featureAccess.ok) {
    return NextResponse.json(
      {
        error: featureAccess.error,
        currentPlan: featureAccess.plan,
        requiredPlan: featureAccess.requiredPlan,
      },
      { status: 402 }
    );
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const bankName = typeof body.bankName === "string" ? body.bankName.trim() : "";
    const accountNumber =
      typeof body.accountNumber === "string" ? body.accountNumber.trim() : "";

    if (!name || !bankName || !accountNumber) {
      return NextResponse.json(
        { error: "name, bankName, and accountNumber are required" },
        { status: 400 }
      );
    }

    const account = await createWorkspaceBankAccount({
      workspaceId: ctx.workspaceId,
      clientBusinessId: parseOptionalId(body.clientBusinessId),
      name,
      bankName,
      accountNumber,
      currency: typeof body.currency === "string" ? body.currency : null,
    });

    await logAudit({
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      action: "BANK_ACCOUNT_CREATED",
      metadata: {
        accountId: account.id,
        clientBusinessId: account.clientBusinessId ?? null,
        name: account.name,
      },
    });

    return NextResponse.json(
      {
        account: {
          id: account.id,
          name: account.name,
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          currency: account.currency,
          clientBusinessId: account.clientBusinessId ?? null,
          clientBusinessName: account.clientBusiness?.name ?? null,
          createdAt: account.createdAt.toISOString(),
          updatedAt: account.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logRouteError("bank account create failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create account",
      },
      { status: 500 }
    );
  }
}
