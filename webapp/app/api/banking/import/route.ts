import { NextResponse } from "next/server";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { getWorkspaceFeatureAccess } from "@/src/lib/billing";
import { logAudit } from "@/src/lib/audit";
import { logRouteError } from "@/src/lib/logger";
import {
  previewBankStatementCsv,
  importBankStatementCsv,
  type BankImportColumnMapping,
} from "@/src/lib/banking";

export const runtime = "nodejs";

function parseOptionalId(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseMapping(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      transactionDate:
        typeof parsed.transactionDate === "string" && parsed.transactionDate.trim()
          ? parsed.transactionDate.trim()
          : null,
      description:
        typeof parsed.description === "string" && parsed.description.trim()
          ? parsed.description.trim()
          : null,
      debit:
        typeof parsed.debit === "string" && parsed.debit.trim()
          ? parsed.debit.trim()
          : null,
      credit:
        typeof parsed.credit === "string" && parsed.credit.trim()
          ? parsed.credit.trim()
          : null,
      amount:
        typeof parsed.amount === "string" && parsed.amount.trim()
          ? parsed.amount.trim()
          : null,
      balance:
        typeof parsed.balance === "string" && parsed.balance.trim()
          ? parsed.balance.trim()
          : null,
      reference:
        typeof parsed.reference === "string" && parsed.reference.trim()
          ? parsed.reference.trim()
          : null,
    } satisfies BankImportColumnMapping;
  } catch {
    return null;
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
    const formData = await req.formData();
    const file = formData.get("file");
    const mode = typeof formData.get("mode") === "string" ? String(formData.get("mode")) : "preview";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A CSV file is required" }, { status: 400 });
    }

    const content = await file.text();
    if (!content.trim()) {
      return NextResponse.json({ error: "The CSV file is empty" }, { status: 400 });
    }

    if (mode === "preview") {
      const preview = previewBankStatementCsv(content);
      return NextResponse.json({ preview });
    }

    const mapping = parseMapping(formData.get("mapping"));
    if (!mapping) {
      return NextResponse.json(
        { error: "A valid column mapping is required before import" },
        { status: 400 }
      );
    }

    const result = await importBankStatementCsv({
      workspaceId: ctx.workspaceId,
      uploadedByUserId: ctx.userId,
      bankAccountId: Number(formData.get("bankAccountId")),
      clientBusinessId: parseOptionalId(formData.get("clientBusinessId")),
      fileName: file.name,
      fileType: file.type || "text/csv",
      uploadSizeBytes: file.size,
      content,
      mapping,
    });

    if (!result.imported) {
      return NextResponse.json(
        {
          error: "No valid rows were imported",
          errors: result.errors,
          guidance: result.guidance,
        },
        { status: 400 }
      );
    }

    await logAudit({
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      action: "BANK_STATEMENT_IMPORTED",
      metadata: {
        importId: result.imported.importId,
        importedCount: result.imported.importedCount,
        duplicateCount: result.imported.duplicateCount,
        failedCount: result.imported.failedCount,
      },
    });

    return NextResponse.json({
      ok: true,
      importId: result.imported.importId,
      inserted: result.imported.importedCount,
      duplicateCount: result.imported.duplicateCount,
      failedCount: result.imported.failedCount,
      errors: result.errors,
      guidance: result.guidance,
    });
  } catch (error) {
    logRouteError("bank statement import failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to import bank statement",
      },
      { status: 500 }
    );
  }
}
