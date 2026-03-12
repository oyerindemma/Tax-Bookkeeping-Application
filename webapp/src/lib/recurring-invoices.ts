import "server-only";

import type {
  InvoiceStatus,
  Prisma,
  RecurringInvoice as RecurringInvoiceModel,
  RecurringInvoiceFrequency,
} from "@prisma/client";
import { logAudit } from "@/src/lib/audit";
import { getClientDisplayName } from "@/src/lib/clients";
import {
  buildInvoiceNumber,
  computeInvoiceTotals,
  parseDate,
  type ComputedInvoiceTotals,
  type InvoiceItemInput,
} from "@/src/lib/invoices";
import { prisma } from "@/src/lib/prisma";

type StoredRecurringTemplateItem = ComputedInvoiceTotals["items"][number];

type HydratedRecurringInvoice = Prisma.RecurringInvoiceGetPayload<{
  include: { client: true };
}>;

export type TemplateInvoiceStatus = "DRAFT" | "SENT";

export type WorkspaceRecurringInvoice = Omit<
  RecurringInvoiceModel,
  "itemsJson" | "invoiceStatus"
> & {
  invoiceStatus: TemplateInvoiceStatus;
  client: {
    id: number;
    name: string;
    companyName: string | null;
    email: string;
  };
  displayName: string;
  templateItems: StoredRecurringTemplateItem[];
  templateItemCount: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
};

export type NormalizedRecurringInvoicePayload = {
  clientId: number;
  frequency: RecurringInvoiceFrequency;
  nextRunAt: Date;
  dueInDays: number;
  invoiceStatus: TemplateInvoiceStatus;
  active: boolean;
  itemsJson: string;
  notes: string | null;
};

type GeneratedInvoiceSummary = {
  invoiceId: number;
  invoiceNumber: string;
  recurringInvoiceId: number;
};

const ALLOWED_TEMPLATE_STATUSES = ["DRAFT", "SENT"] as const;
const RECURRING_FREQUENCIES = ["WEEKLY", "MONTHLY", "QUARTERLY"] as const;

function isRecurringFrequency(value: string): value is RecurringInvoiceFrequency {
  return RECURRING_FREQUENCIES.includes(value as RecurringInvoiceFrequency);
}

function isTemplateInvoiceStatus(value: string): value is TemplateInvoiceStatus {
  return ALLOWED_TEMPLATE_STATUSES.includes(value as (typeof ALLOWED_TEMPLATE_STATUSES)[number]);
}

function normalizeTemplateInvoiceStatus(value: InvoiceStatus): TemplateInvoiceStatus {
  return value === "SENT" ? "SENT" : "DRAFT";
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function parseDueInDays(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 365) {
    return null;
  }
  return parsed;
}

function parseStoredTemplateItems(itemsJson: string) {
  try {
    const parsed = JSON.parse(itemsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is StoredRecurringTemplateItem => {
      return (
        item &&
        typeof item.description === "string" &&
        typeof item.quantity === "number" &&
        Number.isFinite(item.quantity) &&
        typeof item.unitPrice === "number" &&
        Number.isFinite(item.unitPrice) &&
        typeof item.taxRate === "number" &&
        Number.isFinite(item.taxRate) &&
        typeof item.lineTotal === "number" &&
        Number.isFinite(item.lineTotal)
      );
    });
  } catch {
    return [];
  }
}

function summarizeTemplateItems(items: StoredRecurringTemplateItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    subtotal,
    taxAmount: totalAmount - subtotal,
    totalAmount,
    templateItemCount: items.length,
  };
}

function mapRecurringInvoice(recurringInvoice: HydratedRecurringInvoice): WorkspaceRecurringInvoice {
  const templateItems = parseStoredTemplateItems(recurringInvoice.itemsJson);
  const summary = summarizeTemplateItems(templateItems);

  return {
    id: recurringInvoice.id,
    workspaceId: recurringInvoice.workspaceId,
    clientId: recurringInvoice.clientId,
    frequency: recurringInvoice.frequency,
    nextRunAt: recurringInvoice.nextRunAt,
    dueInDays: recurringInvoice.dueInDays,
    invoiceStatus: normalizeTemplateInvoiceStatus(recurringInvoice.invoiceStatus),
    active: recurringInvoice.active,
    notes: recurringInvoice.notes,
    createdAt: recurringInvoice.createdAt,
    updatedAt: recurringInvoice.updatedAt,
    client: {
      id: recurringInvoice.client.id,
      name: recurringInvoice.client.name,
      companyName: recurringInvoice.client.companyName,
      email: recurringInvoice.client.email,
    },
    displayName: getClientDisplayName(recurringInvoice.client),
    templateItems,
    ...summary,
  };
}

function advanceRecurringRunAt(date: Date, frequency: RecurringInvoiceFrequency) {
  const next = new Date(date);
  if (frequency === "WEEKLY") {
    next.setUTCDate(next.getUTCDate() + 7);
  }
  if (frequency === "MONTHLY") {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  if (frequency === "QUARTERLY") {
    next.setUTCMonth(next.getUTCMonth() + 3);
  }
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function createInvoiceFromRecurring(
  tx: Prisma.TransactionClient,
  recurringInvoice: HydratedRecurringInvoice,
  issueDate: Date,
  templateItems: StoredRecurringTemplateItem[]
) {
  const { subtotal, taxAmount, totalAmount } = summarizeTemplateItems(templateItems);

  return tx.invoice.create({
    data: {
      workspaceId: recurringInvoice.workspaceId,
      clientId: recurringInvoice.clientId,
      recurringInvoiceId: recurringInvoice.id,
      invoiceNumber: buildInvoiceNumber(issueDate),
      status: recurringInvoice.invoiceStatus,
      issueDate,
      dueDate: addDays(issueDate, recurringInvoice.dueInDays),
      subtotal,
      taxAmount,
      totalAmount,
      notes: recurringInvoice.notes?.trim() || null,
      items: {
        create: templateItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal,
        })),
      },
    },
    include: {
      client: true,
      items: true,
    },
  });
}

export function parseRecurringInvoicePayload(body: {
  clientId?: unknown;
  frequency?: unknown;
  nextRunAt?: unknown;
  dueInDays?: unknown;
  invoiceStatus?: unknown;
  active?: unknown;
  notes?: unknown;
  items?: InvoiceItemInput[];
}): { data: NormalizedRecurringInvoicePayload } | { error: string } {
  const clientId = Number(body.clientId);
  if (!Number.isFinite(clientId) || !Number.isInteger(clientId) || clientId <= 0) {
    return { error: "clientId is required" };
  }

  const frequency = String(body.frequency ?? "").toUpperCase();
  if (!isRecurringFrequency(frequency)) {
    return { error: "frequency must be WEEKLY, MONTHLY, or QUARTERLY" };
  }

  const nextRunAt = parseDate(
    typeof body.nextRunAt === "string" ? body.nextRunAt : undefined
  );
  if (!nextRunAt) {
    return { error: "nextRunAt is required" };
  }

  const dueInDays = parseDueInDays(body.dueInDays);
  if (dueInDays === null) {
    return { error: "dueInDays must be a whole number between 0 and 365" };
  }

  const invoiceStatus = String(body.invoiceStatus ?? "DRAFT").toUpperCase();
  if (!isTemplateInvoiceStatus(invoiceStatus)) {
    return { error: "invoiceStatus must be DRAFT or SENT" };
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { error: "At least one line item is required" };
  }

  const computed = computeInvoiceTotals(body.items);
  if ("error" in computed) {
    return { error: computed.error };
  }

  return {
    data: {
      clientId,
      frequency,
      nextRunAt,
      dueInDays,
      invoiceStatus,
      active: parseBoolean(body.active, true),
      notes: normalizeText(body.notes),
      itemsJson: JSON.stringify(computed.items),
    },
  };
}

export async function listWorkspaceRecurringInvoices(workspaceId: number) {
  const recurringInvoices = await prisma.recurringInvoice.findMany({
    where: { workspaceId },
    include: { client: true },
    orderBy: [{ active: "desc" }, { nextRunAt: "asc" }],
  });

  return recurringInvoices.map((entry) => mapRecurringInvoice(entry));
}

export async function getWorkspaceRecurringInvoice(
  workspaceId: number,
  recurringInvoiceId: number
) {
  const recurringInvoice = await prisma.recurringInvoice.findFirst({
    where: { id: recurringInvoiceId, workspaceId },
    include: { client: true },
  });

  if (!recurringInvoice) return null;
  return mapRecurringInvoice(recurringInvoice);
}

export async function processDueRecurringInvoices(
  workspaceId: number,
  actorUserId: number | null
) {
  const now = new Date();
  const dueDefinitions = await prisma.recurringInvoice.findMany({
    where: {
      workspaceId,
      active: true,
      nextRunAt: { lte: now },
    },
    include: { client: true },
    orderBy: { nextRunAt: "asc" },
  });

  const generatedInvoices: GeneratedInvoiceSummary[] = [];

  for (const definition of dueDefinitions) {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.recurringInvoice.findFirst({
        where: {
          id: definition.id,
          workspaceId,
          active: true,
        },
        include: { client: true },
      });

      if (!current || current.nextRunAt > now) {
        return { generated: [] as GeneratedInvoiceSummary[] };
      }

      const templateItems = parseStoredTemplateItems(current.itemsJson);
      if (templateItems.length === 0) {
        return { generated: [] as GeneratedInvoiceSummary[] };
      }

      const generated: GeneratedInvoiceSummary[] = [];
      let runAt = current.nextRunAt;
      let safetyCounter = 0;

      while (runAt <= now && safetyCounter < 12) {
        const invoice = await createInvoiceFromRecurring(tx, current, runAt, templateItems);
        generated.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          recurringInvoiceId: current.id,
        });
        runAt = advanceRecurringRunAt(runAt, current.frequency);
        safetyCounter += 1;
      }

      if (generated.length > 0) {
        await tx.recurringInvoice.update({
          where: { id: current.id },
          data: { nextRunAt: runAt },
        });
      }

      return { generated };
    });

    generatedInvoices.push(...result.generated);
  }

  await Promise.all(
    generatedInvoices.map((entry) =>
      logAudit({
        workspaceId,
        actorUserId,
        action: "RECURRING_INVOICE_GENERATED",
        metadata: {
          recurringInvoiceId: entry.recurringInvoiceId,
          invoiceId: entry.invoiceId,
          invoiceNumber: entry.invoiceNumber,
          automatic: true,
        },
      })
    )
  );

  return {
    generatedCount: generatedInvoices.length,
    invoices: generatedInvoices,
  };
}

export async function generateRecurringInvoiceNow(input: {
  workspaceId: number;
  recurringInvoiceId: number;
  actorUserId: number | null;
}) {
  const { workspaceId, recurringInvoiceId, actorUserId } = input;

  const result = await prisma.$transaction(async (tx) => {
    const recurringInvoice = await tx.recurringInvoice.findFirst({
      where: { id: recurringInvoiceId, workspaceId },
      include: { client: true },
    });

    if (!recurringInvoice) {
      return { error: "Recurring invoice not found" } as const;
    }

    const templateItems = parseStoredTemplateItems(recurringInvoice.itemsJson);
    if (templateItems.length === 0) {
      return { error: "Recurring invoice template is invalid" } as const;
    }

    const issueDate = new Date();
    const invoice = await createInvoiceFromRecurring(
      tx,
      recurringInvoice,
      issueDate,
      templateItems
    );
    const nextBase =
      recurringInvoice.nextRunAt > issueDate ? recurringInvoice.nextRunAt : issueDate;
    const updatedRecurringInvoice = await tx.recurringInvoice.update({
      where: { id: recurringInvoice.id },
      data: {
        nextRunAt: advanceRecurringRunAt(nextBase, recurringInvoice.frequency),
      },
      include: { client: true },
    });

    return {
      invoice,
      recurringInvoice: updatedRecurringInvoice,
    } as const;
  });

  if ("error" in result) {
    return result;
  }

  await logAudit({
    workspaceId,
    actorUserId,
    action: "RECURRING_INVOICE_GENERATED",
    metadata: {
      recurringInvoiceId,
      invoiceId: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
      automatic: false,
    },
  });

  return {
    invoice: result.invoice,
    recurringInvoice: mapRecurringInvoice(result.recurringInvoice),
  };
}
