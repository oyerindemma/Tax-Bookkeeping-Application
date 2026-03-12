import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { logAudit } from "@/src/lib/audit";
import { logRouteError } from "@/src/lib/logger";
import type { InvoiceStatus } from "@prisma/client";
import { ensureInvoiceIncomeTaxRecord } from "@/src/lib/invoice-payments";
import {
  computeInvoiceTotals,
  isInvoiceStatus,
  parseDate,
  type ComputedInvoiceTotals,
  type InvoiceItemInput,
  startOfToday,
} from "@/src/lib/invoices";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id?: string }> };

function parseId(raw?: string) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth = await requireRoleAtLeast(ctx.workspaceId, "VIEWER");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const invoiceId = parseId(id);
  if (!invoiceId) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, workspaceId: ctx.workspaceId },
    include: { client: true, items: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "SENT" && invoice.dueDate < startOfToday()) {
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "OVERDUE" },
      include: { client: true, items: true },
    });
    return NextResponse.json({ invoice: updated });
  }

  return NextResponse.json({ invoice });
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth = await requireRoleAtLeast(ctx.workspaceId, "MEMBER");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const invoiceId = parseId(id);
  if (!invoiceId) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const {
      status,
      issueDate,
      dueDate,
      notes,
      items,
      clientId,
    } = body as {
      status?: string;
      issueDate?: string;
      dueDate?: string;
      notes?: string;
      items?: InvoiceItemInput[];
      clientId?: number | string;
    };

    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceId, workspaceId: ctx.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    let parsedClientId: number | undefined = undefined;
    if (clientId !== undefined) {
      const candidate = Number(clientId);
      if (!Number.isFinite(candidate) || !Number.isInteger(candidate)) {
        return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
      }
      const client = await prisma.client.findFirst({
        where: { id: candidate, workspaceId: ctx.workspaceId },
      });
      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      parsedClientId = client.id;
    }

    const parsedIssueDate = issueDate ? parseDate(issueDate) : null;
    const parsedDueDate = dueDate ? parseDate(dueDate) : null;
    if (issueDate && !parsedIssueDate) {
      return NextResponse.json({ error: "Invalid issueDate" }, { status: 400 });
    }
    if (dueDate && !parsedDueDate) {
      return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
    }
    if (parsedIssueDate && parsedDueDate && parsedDueDate < parsedIssueDate) {
      return NextResponse.json(
        { error: "dueDate must be after issueDate" },
        { status: 400 }
      );
    }

    let nextStatus: InvoiceStatus | undefined;
    if (status !== undefined) {
      const normalized = String(status).toUpperCase();
      if (!isInvoiceStatus(normalized)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      nextStatus = normalized;
    }

    let computedTotals: ComputedInvoiceTotals | null = null;
    if (items) {
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "items are required" }, { status: 400 });
      }
      const computed = computeInvoiceTotals(items);
      if ("error" in computed) {
        return NextResponse.json({ error: computed.error }, { status: 400 });
      }
      computedTotals = computed;
    }

    const shouldCreateTaxRecord =
      nextStatus === "PAID" && existing.status !== "PAID";

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: nextStatus ?? undefined,
          paidAt:
            nextStatus === "PAID"
              ? existing.paidAt ?? new Date()
              : nextStatus !== undefined && existing.status === "PAID"
                ? null
                : undefined,
          issueDate: parsedIssueDate ?? undefined,
          dueDate: parsedDueDate ?? undefined,
          notes: notes !== undefined ? notes?.trim() || null : undefined,
          clientId: parsedClientId ?? undefined,
          subtotal: computedTotals ? computedTotals.subtotal : undefined,
          taxAmount: computedTotals ? computedTotals.taxAmount : undefined,
          totalAmount: computedTotals ? computedTotals.totalAmount : undefined,
        },
      });

      if (computedTotals) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId } });
        await tx.invoiceItem.createMany({
          data: computedTotals.items.map((item) => ({
            invoiceId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            lineTotal: item.lineTotal,
          })),
        });
      }

      let taxRecordId: number | null = null;
      if (shouldCreateTaxRecord) {
        taxRecordId = await ensureInvoiceIncomeTaxRecord(tx, {
          invoice: updated,
          actorUserId: ctx.userId,
          occurredOn: updated.paidAt ?? new Date(),
        });
      }

      return { invoice: updated, taxRecordId };
    });

    const { taxRecordId } = result;
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, workspaceId: ctx.workspaceId },
      include: { client: true, items: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    const statusChanged = nextStatus !== undefined && nextStatus !== existing.status;

    await logAudit({
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      action: statusChanged ? "INVOICE_STATUS_CHANGED" : "INVOICE_UPDATED",
      metadata: {
        invoiceId: invoice.id,
        status: nextStatus ?? invoice.status,
      },
    });

    if (taxRecordId) {
      await logAudit({
        workspaceId: ctx.workspaceId,
        actorUserId: ctx.userId,
        action: "Income created from invoice payment",
        metadata: {
          invoiceId: invoice.id,
          taxRecordId,
          amountKobo: invoice.totalAmount,
        },
      });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    logRouteError("invoice update failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      invoiceId,
    });
    return NextResponse.json({ error: "Server error updating invoice" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth = await requireRoleAtLeast(ctx.workspaceId, "MEMBER");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const invoiceId = parseId(id);
  if (!invoiceId) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  try {
    const deleted = await prisma.invoice.deleteMany({
      where: { id: invoiceId, workspaceId: ctx.workspaceId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await logAudit({
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      action: "INVOICE_DELETED",
      metadata: { invoiceId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logRouteError("invoice delete failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      invoiceId,
    });
    return NextResponse.json({ error: "Server error deleting invoice" }, { status: 500 });
  }
}
