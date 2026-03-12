"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TaxRecordForm, {
  TaxRecordFormValues,
} from "./TaxRecordForm";
import TaxRecordsTable from "./TaxRecordsTable";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

type TaxRecord = {
  id: number;
  kind: string;
  amountKobo: number;
  taxRate: number;
  currency: string;
  occurredOn: string;
  description: string | null;
  createdAt: string;
  invoiceId?: number | null;
  source?: string | null;
  categoryId?: number | null;
  category?: { id: number; name: string } | null;
  vendorName?: string | null;
  recurring?: boolean;
};

type Category = {
  id: number;
  name: string;
};

type Props = {
  role: Role;
};

const CATEGORY_ALIASES: Record<string, string> = {
  advertising: "marketing",
  ads: "marketing",
  electric: "utilities",
  electricity: "utilities",
  fuel: "transport",
  internet: "utilities",
  lease: "rent",
  officeexpense: "office",
  officeexpenses: "office",
  officesupplies: "office",
  other: "miscellaneous",
  power: "utilities",
  saas: "software",
  subscription: "software",
  subscriptions: "software",
  transportfare: "transport",
  transportation: "transport",
  travel: "transport",
  utility: "utilities",
};

function toDateInputValue(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function normalizeCategoryKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export default function TaxRecordsClient({ role }: Props) {
  const router = useRouter();
  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<TaxRecord | null>(null);
  const [draftValues, setDraftValues] = useState<TaxRecordFormValues | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);

  const canEdit = role === "OWNER" || role === "ADMIN" || role === "MEMBER";

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/tax-records", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setListError(data?.error ?? "Failed to load records");
        return;
      }
      setRecords(Array.isArray(data?.records) ? data.records : []);
    } catch {
      setListError("Network error loading records");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/expense-categories", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        return;
      }
      setCategories(Array.isArray(data?.categories) ? data.categories : []);
    } catch {
      // ignore category load errors to keep tax records functional
    }
  }, []);

  useEffect(() => {
    loadRecords();
    loadCategories();
  }, [loadRecords, loadCategories]);

  const initialFormValues: TaxRecordFormValues = useMemo(() => {
    if (editingRecord) {
      return {
        kind: editingRecord.kind,
        amount: (editingRecord.amountKobo / 100).toFixed(2),
        taxRate: String(editingRecord.taxRate ?? 0),
        occurredOn: toDateInputValue(editingRecord.occurredOn),
        description: editingRecord.description ?? "",
        currency: editingRecord.currency ?? "NGN",
        categoryId: editingRecord.categoryId ? String(editingRecord.categoryId) : "",
        vendorName: editingRecord.vendorName ?? "",
        recurring: Boolean(editingRecord.recurring),
      };
    }
    if (draftValues) return draftValues;
    return {
      kind: "INCOME",
      amount: "",
      taxRate: "0",
      occurredOn: new Date().toISOString().slice(0, 10),
      description: "",
      currency: "NGN",
      categoryId: "",
      vendorName: "",
      recurring: false,
    };
  }, [editingRecord, draftValues]);

  async function handleSave(values: TaxRecordFormValues) {
    if (!canEdit) {
      setActionError("You have view-only access.");
      return;
    }
    setActionError(null);
    setActionMsg(null);
    setSaving(true);

    const amountKobo = Math.round(Number(values.amount) * 100);
    const parsedRate = values.taxRate.trim() === "" ? 0 : Number(values.taxRate);
    const parsedCategoryId = values.categoryId ? Number(values.categoryId) : null;
    const payload = {
      kind: values.kind,
      amountKobo,
      taxRate: parsedRate,
      currency: values.currency,
      occurredOn: values.occurredOn,
      description: values.description,
      categoryId: parsedCategoryId,
      vendorName: values.vendorName,
      recurring: values.recurring,
    };

    try {
      const res = await fetch(
        editingRecord ? `/api/tax-records/${editingRecord.id}` : "/api/tax-records",
        {
          method: editingRecord ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setActionError(data?.error ?? "Failed to save record");
        return;
      }
      setActionMsg(editingRecord ? "Record updated" : "Record created");
      setEditingRecord(null);
      setDraftValues(null);
      await loadRecords();
    } catch {
      setActionError("Network error saving record");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record: TaxRecord) {
    if (!canEdit) {
      setActionError("You have view-only access.");
      return;
    }
    if (!confirm("Delete this record?")) return;
    setActionError(null);
    setActionMsg(null);
    setDeletingId(record.id);

    try {
      const res = await fetch(`/api/tax-records/${record.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data?.error ?? "Failed to delete record");
        return;
      }
      setActionMsg("Record deleted");
      await loadRecords();
    } catch {
      setActionError("Network error deleting record");
    } finally {
      setDeletingId(null);
    }
  }

  function handleNewRecord() {
    if (!canEdit) return;
    setEditingRecord(null);
    setDraftValues(null);
    setActionError(null);
    setActionMsg(null);
    setImageError(null);
    setImageFileName(null);
  }

  function findCategoryIdByName(name: string | undefined) {
    if (!name) return "";
    const normalized = normalizeCategoryKey(name);
    if (!normalized) return "";
    const canonical = CATEGORY_ALIASES[normalized] ?? normalized;
    const match = categories.find(
      (category) => normalizeCategoryKey(category.name) === canonical
    );
    return match ? String(match.id) : "";
  }

  function normalizeKind(kind?: unknown, taxType?: unknown) {
    const candidate = String(kind ?? taxType ?? "INCOME").toUpperCase();
    if (["INCOME", "EXPENSE", "VAT", "WHT"].includes(candidate)) return candidate;
    return "INCOME";
  }

  function normalizeDate(raw?: unknown) {
    if (!raw) return new Date().toISOString().slice(0, 10);
    const parsed = new Date(String(raw));
    if (Number.isNaN(parsed.getTime())) {
      return new Date().toISOString().slice(0, 10);
    }
    return parsed.toISOString().slice(0, 10);
  }

  async function handleAiDraft() {
    if (!canEdit) {
      setAiError("You have view-only access.");
      return;
    }
    setAiError(null);
    setActionMsg(null);
    if (!aiText.trim()) {
      setAiError("Paste receipt text to generate a draft.");
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/tax-record-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data?.error ?? "Failed to generate draft");
        return;
      }

      const draft = data?.draft ?? {};
      const amountValue = Number(draft.amount);
      const taxRateValue = Number(draft.suggestedTaxRate);

      setEditingRecord(null);
      setDraftValues({
        kind: normalizeKind(draft.kind, draft.taxType),
        amount: Number.isFinite(amountValue) ? amountValue.toFixed(2) : "",
        taxRate: Number.isFinite(taxRateValue) ? String(taxRateValue) : "0",
        occurredOn: normalizeDate(draft.date),
        description: String(draft.description ?? ""),
        currency: String(draft.currency ?? "NGN").toUpperCase(),
        categoryId: findCategoryIdByName(String(draft.category ?? "")),
        vendorName: String(draft.vendorName ?? ""),
        recurring: false,
      });
      setActionMsg("Draft loaded from receipt text.");
    } catch {
      setAiError("Network error generating draft");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleReceiptScan(file: File) {
    if (!canEdit) {
      setImageError("You have view-only access.");
      return;
    }
    setImageError(null);
    setActionMsg(null);
    if (!file.type.startsWith("image/")) {
      setImageError("Please upload a valid image file.");
      return;
    }
    setImageLoading(true);
    setImageFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/ai/receipt-scan", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImageError(data?.error ?? "Failed to scan receipt");
        return;
      }

      const draft = data?.draft ?? {};
      const amountValue = Number(draft.amount);
      const taxRateValue = Number(draft.taxRate);

      setEditingRecord(null);
      setDraftValues({
        kind: normalizeKind(draft.type),
        amount: Number.isFinite(amountValue) ? amountValue.toFixed(2) : "",
        taxRate: Number.isFinite(taxRateValue) ? String(taxRateValue) : "0",
        occurredOn: normalizeDate(draft.date),
        description: String(draft.description ?? ""),
        currency: String(draft.currency ?? "NGN").toUpperCase(),
        categoryId: findCategoryIdByName(String(draft.category ?? "")),
        vendorName: String(draft.vendorName ?? ""),
        recurring: false,
      });
      setActionMsg("Draft loaded from receipt image.");
    } catch {
      setImageError("Network error scanning receipt");
    } finally {
      setImageLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Tax records</h1>
          <p className="text-muted-foreground">
            Capture income, expenses, and tax events.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleNewRecord} disabled={!canEdit}>
            New record
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/settings/categories">Manage categories</Link>
          </Button>
          {canEdit ? (
            <Button asChild variant="secondary">
              <Link href="/dashboard/tax-records/import">Import CSV</Link>
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              Import CSV
            </Button>
          )}
          <Button asChild variant="outline">
            <a href="/api/reports/export">Export CSV</a>
          </Button>
        </div>
      </div>

      {canEdit ? (
        <TaxRecordForm
          key={
            editingRecord
              ? `edit-${editingRecord.id}`
              : `draft-${initialFormValues.kind}-${initialFormValues.amount}-${initialFormValues.occurredOn}-${initialFormValues.categoryId}-${initialFormValues.vendorName}-${initialFormValues.recurring}`
          }
          initialValues={initialFormValues}
          onSubmit={handleSave}
          onCancel={editingRecord ? () => setEditingRecord(null) : undefined}
          saving={saving}
          message={actionMsg}
          error={actionError}
          disabled={!canEdit}
          categories={categories}
        />
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>View-only access</CardTitle>
            <CardDescription>
              You can review records but cannot create or edit them.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canEdit && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Upload receipt image</CardTitle>
            <CardDescription>Automatically extract tax data from an image.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept="image/*"
              disabled={imageLoading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                handleReceiptScan(file);
              }}
            />
            {imageFileName && (
              <p className="text-xs text-muted-foreground">
                Selected: {imageFileName}
              </p>
            )}
            {imageLoading && (
              <p className="text-sm text-muted-foreground">Scanning receipt...</p>
            )}
            {imageError && <p className="text-sm text-destructive">{imageError}</p>}
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Paste receipt text</CardTitle>
            <CardDescription>Generate a draft from pasted receipt text.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              rows={4}
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Paste extracted receipt text here"
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleAiDraft} disabled={aiLoading}>
                {aiLoading ? "Drafting..." : "Generate draft"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAiText("");
                  setAiError(null);
                }}
                disabled={aiLoading}
              >
                Clear
              </Button>
            </div>
            {aiError && <p className="text-sm text-destructive">{aiError}</p>}
          </CardContent>
        </Card>
      )}

      {!canEdit && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Need edit access?</CardTitle>
            <CardDescription>
              Ask an admin or owner to grant you member access.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Records</CardTitle>
          <CardDescription>All entries in your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading records...</p>
          ) : (
            <>
              <TaxRecordsTable
                records={records}
                onEdit={(record) => {
                  if (!canEdit) return;
                  setActionError(null);
                  setActionMsg(null);
                  setDraftValues(null);
                  setEditingRecord(record);
                }}
                onDelete={handleDelete}
                deletingId={deletingId}
                canEdit={canEdit}
              />
              {listError && (
                <p className="mt-3 text-sm text-destructive">{listError}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
