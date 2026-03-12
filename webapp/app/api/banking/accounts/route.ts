import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { getWorkspaceFeatureAccess } from "@/src/lib/billing";
import { logAudit } from "@/src/lib/audit";
import { logRouteError } from "@/src/lib/logger";

export const runtime = "nodejs";

function normalizeCurrency(value: string | undefined) {
  const trimmed = value?.trim().toUpperCase();
  return trimmed && trimmed.length <= 6 ? trimmed : "NGN";
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
      { error: featureAccess.error, currentPlan: featureAccess.plan, requiredPlan: featureAccess.requiredPlan },
      { status: 402 }
    );
  }

  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ accounts: accounts ?? [] });
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
      { error: featureAccess.error, currentPlan: featureAccess.plan, requiredPlan: featureAccess.requiredPlan },
      { status: 402 }
    );
  }

  try {
    const body = await req.json();
    const { name, bankName, accountNumber, currency } = body as {
      name?: string;
      bankName?: string;
      accountNumber?: string;
      currency?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!bankName?.trim()) {
      return NextResponse.json({ error: "bankName is required" }, { status: 400 });
    }
    if (!accountNumber?.trim()) {
      return NextResponse.json({ error: "accountNumber is required" }, { status: 400 });
    }

    const account = await prisma.bankAccount.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: name.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        currency: normalizeCurrency(currency),
      },
    });

    await logAudit({
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      action: "BANK_ACCOUNT_CREATED",
      metadata: { accountId: account.id, name: account.name },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    logRouteError("bank account create failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
