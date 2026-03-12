import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { getWorkspaceFeatureAccess } from "@/src/lib/billing";
import { logAudit } from "@/src/lib/audit";
import { logRouteError } from "@/src/lib/logger";

export const runtime = "nodejs";

type RowError = {
  row: number;
  field: string;
  message: string;
};

type ParsedRow = {
  transactionDate: Date;
  description: string;
  reference: string | null;
  amount: number;
  type: "CREDIT" | "DEBIT";
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseAmount(raw: string) {
  const normalized = raw.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function parseDate(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function parseType(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (["CR", "CREDIT", "C"].includes(normalized)) return "CREDIT" as const;
  if (["DR", "DEBIT", "D"].includes(normalized)) return "DEBIT" as const;
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
    const formData = await req.formData();
    const file = formData.get("file");
    const bankAccountIdRaw = formData.get("bankAccountId");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }

    const bankAccountId = Number(bankAccountIdRaw);
    if (!Number.isFinite(bankAccountId) || !Number.isInteger(bankAccountId)) {
      return NextResponse.json({ error: "bankAccountId is required" }, { status: 400 });
    }

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, workspaceId: ctx.workspaceId },
    });
    if (!bankAccount) {
      return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
    }

    const content = await file.text();
    const rows = parseCsv(content);
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
    }

    const headers = rows[0].map((value) => normalizeHeader(value));
    const findIndex = (candidates: string[]) =>
      headers.findIndex((header) => candidates.includes(header));

    const dateIndex = findIndex([
      "date",
      "transactiondate",
      "valuedate",
      "posteddate",
    ]);
    const descriptionIndex = findIndex([
      "description",
      "details",
      "narration",
      "memo",
    ]);
    const referenceIndex = findIndex([
      "reference",
      "ref",
      "transactionid",
      "id",
    ]);
    const amountIndex = findIndex(["amount", "amt"]);
    const typeIndex = findIndex(["type", "drcr", "creditdebit"]);
    const debitIndex = findIndex(["debit", "withdrawal", "dr"]);
    const creditIndex = findIndex(["credit", "deposit", "cr"]);

    if (dateIndex === -1) {
      return NextResponse.json({ error: "CSV is missing a date column" }, { status: 400 });
    }

    const errors: RowError[] = [];
    const parsed: ParsedRow[] = [];

    rows.slice(1).forEach((row, index) => {
      const rowNumber = index + 2;
      const dateValue = row[dateIndex]?.trim() ?? "";
      const descriptionValue =
        (descriptionIndex !== -1 ? row[descriptionIndex]?.trim() : "") ?? "";
      const referenceValue =
        (referenceIndex !== -1 ? row[referenceIndex]?.trim() : "") ?? "";
      const amountValue = amountIndex !== -1 ? row[amountIndex]?.trim() : "";
      const typeValue = typeIndex !== -1 ? row[typeIndex]?.trim() : "";
      const debitValue = debitIndex !== -1 ? row[debitIndex]?.trim() : "";
      const creditValue = creditIndex !== -1 ? row[creditIndex]?.trim() : "";

      if (
        !dateValue &&
        !descriptionValue &&
        !referenceValue &&
        !amountValue &&
        !debitValue &&
        !creditValue
      ) {
        return;
      }

      const transactionDate = parseDate(dateValue);
      if (!transactionDate) {
        errors.push({ row: rowNumber, field: "date", message: "invalid date" });
        return;
      }

      let amountKobo: number | null = null;
      let type: "CREDIT" | "DEBIT" | null = null;

      if (debitValue || creditValue) {
        const debitAmount = debitValue ? parseAmount(debitValue) : null;
        const creditAmount = creditValue ? parseAmount(creditValue) : null;

        if (debitAmount && debitAmount > 0) {
          amountKobo = debitAmount;
          type = "DEBIT";
        } else if (creditAmount && creditAmount > 0) {
          amountKobo = creditAmount;
          type = "CREDIT";
        }
      } else if (amountValue) {
        const parsedAmount = parseAmount(amountValue);
        if (parsedAmount !== null) {
          if (parsedAmount < 0) {
            amountKobo = Math.abs(parsedAmount);
            type = "DEBIT";
          } else {
            amountKobo = parsedAmount;
            type = "CREDIT";
          }
        }
      }

      if (typeValue) {
        const parsedType = parseType(typeValue);
        if (parsedType) {
          type = parsedType;
        }
      }

      if (!amountKobo || amountKobo <= 0) {
        errors.push({ row: rowNumber, field: "amount", message: "invalid amount" });
        return;
      }

      if (!type) {
        errors.push({ row: rowNumber, field: "type", message: "missing type" });
        return;
      }

      const description = descriptionValue || referenceValue || "Bank transaction";

      parsed.push({
        transactionDate,
        description,
        reference: referenceValue || null,
        amount: amountKobo,
        type,
      });
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    if (parsed.length === 0) {
      return NextResponse.json({ error: "No valid rows to import" }, { status: 400 });
    }

    await prisma.bankTransaction.createMany({
      data: parsed.map((row) => ({
        workspaceId: ctx.workspaceId,
        bankAccountId: bankAccount.id,
        transactionDate: row.transactionDate,
        description: row.description,
        reference: row.reference,
        amount: row.amount,
        type: row.type,
        status: "UNMATCHED",
      })),
    });

    await logAudit({
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      action: "BANK_STATEMENT_IMPORTED",
      metadata: {
        bankAccountId: bankAccount.id,
        count: parsed.length,
        fileName: file.name,
      },
    });

    return NextResponse.json({ ok: true, inserted: parsed.length });
  } catch (error) {
    logRouteError("bank transaction import failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json({ error: "Failed to import transactions" }, { status: 500 });
  }
}
