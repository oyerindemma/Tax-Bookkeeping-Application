import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { getWorkspaceFeatureAccess } from "@/src/lib/billing";
import { logRouteError } from "@/src/lib/logger";

export const runtime = "nodejs";

type TransactionStatus = "UNMATCHED" | "MATCHED" | "IGNORED";

type InvoiceSuggestion = {
  id: number;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  clientName: string | null;
};

type TaxSuggestion = {
  id: number;
  kind: string;
  amountKobo: number;
  occurredOn: Date;
  description: string | null;
};

function parseStatus(raw: string | null) {
  if (!raw) return null;
  const normalized = raw.toUpperCase();
  if (normalized === "UNMATCHED" || normalized === "MATCHED" || normalized === "IGNORED") {
    return normalized as TransactionStatus;
  }
  return null;
}

function parseId(raw: string | null) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function GET(req: Request) {
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
    const url = new URL(req.url);
    const status = parseStatus(url.searchParams.get("status"));
    const bankAccountId = parseId(url.searchParams.get("bankAccountId"));

    const where: {
      workspaceId: number;
      status?: TransactionStatus;
      bankAccountId?: number;
    } = {
      workspaceId: ctx.workspaceId,
    };

    if (status) {
      where.status = status;
    }
    if (bankAccountId) {
      where.bankAccountId = bankAccountId;
    }

    const transactions = await prisma.bankTransaction.findMany({
      where,
      orderBy: { transactionDate: "desc" },
      take: 200,
      include: {
        bankAccount: true,
        match: true,
      },
    });

    const includeSuggestions = status === "UNMATCHED" || !status;

    const enriched = await Promise.all(
      transactions.map(async (transaction) => {
        let invoiceSuggestions: InvoiceSuggestion[] = [];
        let taxSuggestions: TaxSuggestion[] = [];

        if (includeSuggestions && transaction.status === "UNMATCHED") {
          if (transaction.type === "CREDIT") {
            const invoices = await prisma.invoice.findMany({
              where: {
                workspaceId: ctx.workspaceId,
                totalAmount: transaction.amount,
              },
              take: 3,
              orderBy: { issueDate: "desc" },
              select: {
                id: true,
                invoiceNumber: true,
                totalAmount: true,
                status: true,
                client: { select: { name: true } },
              },
            });
            invoiceSuggestions = invoices.map((invoice) => ({
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              totalAmount: invoice.totalAmount,
              status: invoice.status,
              clientName: invoice.client?.name ?? null,
            }));
          }

          const kind = transaction.type === "CREDIT" ? "INCOME" : "EXPENSE";
          const taxRecords = await prisma.taxRecord.findMany({
            where: {
              workspaceId: ctx.workspaceId,
              amountKobo: transaction.amount,
              kind,
            },
            take: 3,
            orderBy: { occurredOn: "desc" },
            select: {
              id: true,
              kind: true,
              amountKobo: true,
              occurredOn: true,
              description: true,
            },
          });
          taxSuggestions = taxRecords;
        }

        return {
          ...transaction,
          suggestions: {
            invoices: invoiceSuggestions,
            taxRecords: taxSuggestions,
          },
        };
      })
    );

    return NextResponse.json({ transactions: enriched });
  } catch (error) {
    logRouteError("bank transactions load failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json({ error: "Failed to load transactions" }, { status: 500 });
  }
}
