import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { logAudit } from "@/src/lib/audit";
import { logRouteError } from "@/src/lib/logger";
import {
  buildInvoiceNumber,
  computeInvoiceTotals,
  isInvoiceStatus,
  parseDate,
  type InvoiceItemInput,
  startOfToday,
} from "@/src/lib/invoices";

export const runtime = "nodejs";

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await requireRoleAtLeast(ctx.workspaceId, "VIEWER");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const today = startOfToday();
    await prisma.invoice.updateMany({
      where: {
        workspaceId: ctx.workspaceId,
        status: "SENT",
        dueDate: { lt: today },
      },
      data: { status: "OVERDUE" },
    });

    const invoices = await prisma.invoice.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
        items: true,
      },
    });

    return Response.json({ invoices: invoices ?? [] });
  } catch (error) {
    logRouteError("invoices list failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return Response.json({ error: "Failed to load invoices" }, { status: 500 });
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

  try {
    const body = await req.json();
    const { clientId, issueDate, dueDate, notes, items, invoiceNumber, status } = body as {
      clientId?: number | string;
      issueDate?: string;
      dueDate?: string;
      notes?: string;
      items?: InvoiceItemInput[];
      invoiceNumber?: string;
      status?: string;
    };

    const parsedClientId = Number(clientId);
    if (!Number.isFinite(parsedClientId) || !Number.isInteger(parsedClientId)) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    const client = await prisma.client.findFirst({
      where: { id: parsedClientId, workspaceId: ctx.workspaceId },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const parsedIssueDate = parseDate(issueDate);
    const parsedDueDate = parseDate(dueDate);
    if (!parsedIssueDate || !parsedDueDate) {
      return NextResponse.json(
        { error: "issueDate and dueDate are required" },
        { status: 400 }
      );
    }

    if (parsedDueDate < parsedIssueDate) {
      return NextResponse.json(
        { error: "dueDate must be after issueDate" },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items are required" }, { status: 400 });
    }

    const computed = computeInvoiceTotals(items);
    if ("error" in computed) {
      return NextResponse.json({ error: computed.error }, { status: 400 });
    }

    let nextStatus: InvoiceStatus = "SENT";
    if (status !== undefined) {
      const normalized = String(status).toUpperCase();
      if (!isInvoiceStatus(normalized)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      nextStatus = normalized;
    }

    const invoice = await prisma.invoice.create({
      data: {
        workspaceId: ctx.workspaceId,
        clientId: client.id,
        invoiceNumber: invoiceNumber?.trim() || buildInvoiceNumber(),
        status: nextStatus,
        issueDate: parsedIssueDate,
        dueDate: parsedDueDate,
        subtotal: computed.subtotal,
        taxAmount: computed.taxAmount,
        totalAmount: computed.totalAmount,
        notes: notes?.trim() || null,
        items: {
          create: computed.items,
        },
      },
      include: {
        client: true,
        items: true,
      },
    });

    await logAudit({
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      action: "INVOICE_CREATED",
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
      },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    logRouteError("invoice create failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json({ error: "Server error creating invoice" }, { status: 500 });
  }
}
