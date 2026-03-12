import type { InvoiceStatus } from "@prisma/client";

export type InvoiceItemInput = {
  description?: string;
  quantity?: number | string;
  unitPrice?: number | string;
  taxRate?: number | string;
};

export type ComputedInvoiceTotals = {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    lineTotal: number;
  }>;
};

export function parseMoneyToKobo(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function parseTaxRate(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return parsed;
}

export function parseQuantity(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

export function parseDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function buildInvoiceNumber(date = new Date()) {
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${stamp}-${random}`;
}

export function computeInvoiceTotals(
  items: InvoiceItemInput[]
): ComputedInvoiceTotals | { error: string } {
  const normalized: ComputedInvoiceTotals["items"] = [];
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const description = item.description?.trim();
    if (!description) {
      return { error: "Each item requires a description." } as const;
    }
    const quantity = parseQuantity(item.quantity);
    if (!quantity) {
      return { error: "Each item requires a quantity greater than 0." } as const;
    }
    const unitPrice = parseMoneyToKobo(item.unitPrice);
    if (unitPrice === null) {
      return { error: "Each item requires a valid unit price." } as const;
    }
    const taxRate = parseTaxRate(item.taxRate);
    if (taxRate === null) {
      return { error: "Tax rate must be between 0 and 100." } as const;
    }

    const lineSubtotal = quantity * unitPrice;
    const lineTax = Math.round(lineSubtotal * (taxRate / 100));
    const lineTotal = lineSubtotal + lineTax;

    subtotal += lineSubtotal;
    taxAmount += lineTax;

    normalized.push({
      description,
      quantity,
      unitPrice,
      taxRate,
      lineTotal,
    });
  }

  return {
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount,
    items: normalized,
  } as const;
}

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return ["DRAFT", "SENT", "PAID", "OVERDUE"].includes(value);
}

export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
