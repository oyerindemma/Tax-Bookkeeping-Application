import "server-only";

import crypto from "crypto";
import type { Invoice, Prisma } from "@prisma/client";
import { logAudit } from "@/src/lib/audit";
import { prisma } from "@/src/lib/prisma";

type InvoiceIncomeRecordTarget = Pick<
  Invoice,
  "id" | "invoiceNumber" | "totalAmount" | "taxAmount" | "workspaceId"
>;

export type InvoicePaymentLinkResult = {
  paymentReference: string;
  paymentUrl: string;
  provider: "stub";
};

function computeTax(amountKobo: number, taxRate: number) {
  const computedTax = Math.round(amountKobo * (taxRate / 100));
  const netAmount = Math.round(amountKobo - computedTax);
  return { computedTax, netAmount };
}

export function buildInvoicePaymentReference(invoiceId: number) {
  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `PAY-${invoiceId}-${suffix}`;
}

export function buildInvoicePaymentUrl(requestUrl: string, paymentReference: string) {
  const origin = new URL(requestUrl).origin;
  return `${origin}/pay/${encodeURIComponent(paymentReference)}`;
}

export function createStubInvoicePaymentLink(input: {
  invoiceId: number;
  requestUrl: string;
}): InvoicePaymentLinkResult {
  const paymentReference = buildInvoicePaymentReference(input.invoiceId);
  return {
    paymentReference,
    paymentUrl: buildInvoicePaymentUrl(input.requestUrl, paymentReference),
    provider: "stub",
  };
}

export async function ensureInvoiceIncomeTaxRecord(
  tx: Prisma.TransactionClient,
  input: {
    invoice: InvoiceIncomeRecordTarget;
    actorUserId: number;
    occurredOn?: Date;
  }
) {
  const { invoice, actorUserId, occurredOn = new Date() } = input;

  const existingRecord = await tx.taxRecord.findUnique({
    where: { invoiceId: invoice.id },
    select: { id: true },
  });
  if (existingRecord) {
    return existingRecord.id;
  }

  const effectiveTaxRate =
    invoice.totalAmount > 0
      ? Number(((invoice.taxAmount / invoice.totalAmount) * 100).toFixed(2))
      : 0;
  const computed = computeTax(invoice.totalAmount, effectiveTaxRate);

  const record = await tx.taxRecord.create({
    data: {
      userId: actorUserId,
      workspaceId: invoice.workspaceId,
      invoiceId: invoice.id,
      kind: "INCOME",
      amountKobo: invoice.totalAmount,
      taxRate: effectiveTaxRate,
      computedTax: computed.computedTax,
      netAmount: computed.netAmount,
      occurredOn,
      description: `Invoice #${invoice.invoiceNumber}`,
      source: "invoice",
    },
  });

  return record.id;
}

async function resolveInvoiceActorUserId(
  tx: Prisma.TransactionClient,
  workspaceId: number
) {
  const membership = await tx.workspaceMember.findFirst({
    where: { workspaceId },
    orderBy: { id: "asc" },
    select: { userId: true },
  });

  return membership?.userId ?? null;
}

export async function confirmInvoicePaymentByReference(input: {
  paymentReference: string;
  provider?: string | null;
  paidAt?: Date;
  amountKobo?: number | null;
  eventId?: string | null;
}) {
  const paidAt = input.paidAt ?? new Date();

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { paymentReference: input.paymentReference },
    });

    if (!invoice) {
      return { error: "Invoice not found" } as const;
    }

    if (
      input.amountKobo !== undefined &&
      input.amountKobo !== null &&
      input.amountKobo !== invoice.totalAmount
    ) {
      return { error: "Payment amount does not match invoice total" } as const;
    }

    const alreadyPaid = invoice.status === "PAID";
    const effectivePaidAt = invoice.paidAt ?? paidAt;

    const updated =
      alreadyPaid && invoice.paidAt
        ? invoice
        : await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: "PAID",
              paidAt: effectivePaidAt,
            },
          });

    let taxRecordId: number | null = null;
    if (!alreadyPaid) {
      const actorUserId = await resolveInvoiceActorUserId(tx, invoice.workspaceId);
      if (!actorUserId) {
        return { error: "No workspace member available for payment confirmation" } as const;
      }

      taxRecordId = await ensureInvoiceIncomeTaxRecord(tx, {
        invoice: updated,
        actorUserId,
        occurredOn: effectivePaidAt,
      });
    }

    return {
      invoice: updated,
      taxRecordId,
      alreadyPaid,
    } as const;
  });

  if ("error" in result) {
    return result;
  }

  if (!result.alreadyPaid) {
    await logAudit({
      workspaceId: result.invoice.workspaceId,
      actorUserId: null,
      action: "INVOICE_PAYMENT_CONFIRMED",
      metadata: {
        invoiceId: result.invoice.id,
        invoiceNumber: result.invoice.invoiceNumber,
        paymentReference: input.paymentReference,
        provider: input.provider ?? "stub",
        paidAt: result.invoice.paidAt?.toISOString() ?? paidAt.toISOString(),
        amountKobo: result.invoice.totalAmount,
        eventId: input.eventId ?? null,
      },
    });

    if (result.taxRecordId) {
      await logAudit({
        workspaceId: result.invoice.workspaceId,
        actorUserId: null,
        action: "Income created from invoice payment",
        metadata: {
          invoiceId: result.invoice.id,
          taxRecordId: result.taxRecordId,
          amountKobo: result.invoice.totalAmount,
          paymentReference: input.paymentReference,
        },
      });
    }
  }

  return {
    ...result,
    alreadyProcessed: result.alreadyPaid,
  };
}
