import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { getWorkspaceFeatureAccess } from "@/src/lib/billing";
import { logAudit } from "@/src/lib/audit";
import { logRouteError } from "@/src/lib/logger";

export const runtime = "nodejs";

type MatchStatus = "MATCHED" | "UNMATCHED" | "IGNORED";

type MatchType = "INVOICE" | "TAX_RECORD" | "MANUAL";

function parseId(raw: unknown) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseStatus(raw: unknown): MatchStatus | null {
  const normalized = String(raw ?? "").toUpperCase();
  if (normalized === "MATCHED" || normalized === "UNMATCHED" || normalized === "IGNORED") {
    return normalized as MatchStatus;
  }
  return null;
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
    const { transactionId, status, invoiceId, taxRecordId, matchType } = body as {
      transactionId?: number | string;
      status?: string;
      invoiceId?: number | string;
      taxRecordId?: number | string;
      matchType?: string;
    };

    const parsedTransactionId = parseId(transactionId);
    if (!parsedTransactionId) {
      return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
    }

    const parsedStatus = parseStatus(status);
    if (!parsedStatus) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const transaction = await prisma.bankTransaction.findFirst({
      where: { id: parsedTransactionId, workspaceId: ctx.workspaceId },
    });
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (parsedStatus === "MATCHED") {
      const parsedInvoiceId = invoiceId !== undefined ? parseId(invoiceId) : null;
      const parsedTaxRecordId = taxRecordId !== undefined ? parseId(taxRecordId) : null;

      if (!parsedInvoiceId && !parsedTaxRecordId) {
        return NextResponse.json(
          { error: "invoiceId or taxRecordId is required" },
          { status: 400 }
        );
      }

      if (parsedInvoiceId) {
        const invoice = await prisma.invoice.findFirst({
          where: { id: parsedInvoiceId, workspaceId: ctx.workspaceId },
        });
        if (!invoice) {
          return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }
      }

      if (parsedTaxRecordId) {
        const record = await prisma.taxRecord.findFirst({
          where: { id: parsedTaxRecordId, workspaceId: ctx.workspaceId },
        });
        if (!record) {
          return NextResponse.json({ error: "Tax record not found" }, { status: 404 });
        }
      }

      let resolvedMatchType: MatchType = "MANUAL";
      const normalizedType = String(matchType ?? "").toUpperCase();
      if (normalizedType === "INVOICE" || normalizedType === "TAX_RECORD") {
        resolvedMatchType = normalizedType as MatchType;
      } else if (parsedInvoiceId) {
        resolvedMatchType = "INVOICE";
      } else if (parsedTaxRecordId) {
        resolvedMatchType = "TAX_RECORD";
      }

      await prisma.$transaction(async (tx) => {
        await tx.reconciliationMatch.upsert({
          where: { bankTransactionId: transaction.id },
          update: {
            invoiceId: parsedInvoiceId ?? null,
            taxRecordId: parsedTaxRecordId ?? null,
            matchType: resolvedMatchType,
          },
          create: {
            workspaceId: ctx.workspaceId,
            bankTransactionId: transaction.id,
            invoiceId: parsedInvoiceId ?? null,
            taxRecordId: parsedTaxRecordId ?? null,
            matchType: resolvedMatchType,
          },
        });

        await tx.bankTransaction.update({
          where: { id: transaction.id },
          data: { status: "MATCHED" },
        });
      });

      await logAudit({
        workspaceId: ctx.workspaceId,
        actorUserId: ctx.userId,
        action: "BANK_RECONCILE_MATCHED",
        metadata: {
          transactionId: transaction.id,
          invoiceId: parsedInvoiceId ?? null,
          taxRecordId: parsedTaxRecordId ?? null,
          matchType: resolvedMatchType,
        },
      });

      return NextResponse.json({ ok: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.reconciliationMatch.deleteMany({
        where: { bankTransactionId: transaction.id },
      });

      await tx.bankTransaction.update({
        where: { id: transaction.id },
        data: { status: parsedStatus },
      });
    });

    await logAudit({
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      action: parsedStatus === "IGNORED" ? "BANK_RECONCILE_IGNORED" : "BANK_RECONCILE_UNMATCHED",
      metadata: {
        transactionId: transaction.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logRouteError("bank reconcile failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json({ error: "Failed to reconcile transaction" }, { status: 500 });
  }
}
