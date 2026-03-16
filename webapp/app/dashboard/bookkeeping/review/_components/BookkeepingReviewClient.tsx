"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

type ReviewMetrics = {
  businessCount: number;
  transactionCount: number;
  queuedUploadCount: number;
  pendingDraftCount: number;
};

type ClientBusinessOption = {
  id: number;
  name: string;
  defaultCurrency: string;
  categories: Array<{
    id: number;
    name: string;
    type: string;
  }>;
};

type ReviewDraft = {
  id: number;
  description: string | null;
  reference: string | null;
  vendorId: number | null;
  vendorName: string | null;
  categoryId: number | null;
  suggestedCategoryName: string | null;
  direction: "MONEY_IN" | "MONEY_OUT" | "JOURNAL";
  amountMinor: number | null;
  taxAmountMinor: number | null;
  taxRate: number;
  currency: string;
  vatAmountMinor: number;
  whtAmountMinor: number;
  vatTreatment: "NONE" | "INPUT" | "OUTPUT" | "EXEMPT";
  whtTreatment: "NONE" | "PAYABLE" | "RECEIVABLE";
  confidence: number | null;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_INFO";
  reviewerNote: string | null;
  proposedDate: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  ledgerTransactionId: number | null;
  reviewedByName: string | null;
};

type ReviewUpload = {
  id: number;
  fileName: string;
  fileType: string | null;
  sourceType: string;
  status:
    | "QUEUED"
    | "PROCESSING"
    | "READY_FOR_REVIEW"
    | "APPROVED"
    | "PARTIALLY_APPROVED"
    | "REJECTED"
    | "FAILED";
  uploadSizeBytes: number | null;
  reviewNotes: string | null;
  rawText: string | null;
  failureReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clientBusiness: {
    id: number;
    name: string;
    defaultCurrency: string;
  };
  uploadedByName: string | null;
  uploadedByEmail: string | null;
  draftCount: number;
  pendingDraftCount: number;
  approvedDraftCount: number;
  rejectedDraftCount: number;
  drafts: ReviewDraft[];
};

type Props = {
  workspaceName: string;
  role: Role;
  initialUploads: ReviewUpload[];
  metrics: ReviewMetrics;
  clientBusinesses: ClientBusinessOption[];
  aiDevelopmentBypass: boolean;
};

type DraftFormState = {
  description: string;
  vendorName: string;
  suggestedCategoryName: string;
  categoryId: string;
  amount: string;
  taxAmount: string;
  vatAmount: string;
  whtAmount: string;
  taxRate: string;
  currency: string;
  transactionDate: string;
  suggestedType: "INCOME" | "EXPENSE";
  vatTreatment: "NONE" | "INPUT" | "OUTPUT" | "EXEMPT";
  whtTreatment: "NONE" | "PAYABLE" | "RECEIVABLE";
  reviewerNote: string;
};

function canEdit(role: Role) {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER";
}

function formatAmount(amountMinor: number | null | undefined, currency: string) {
  if (typeof amountMinor !== "number") return "";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function amountInputValue(amountMinor: number | null | undefined) {
  if (typeof amountMinor !== "number") return "";
  return (amountMinor / 100).toFixed(2);
}

function toDateInputValue(isoDate: string | null) {
  if (!isoDate) return "";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function suggestedTypeFromDirection(direction: ReviewDraft["direction"]) {
  return direction === "MONEY_IN" ? "INCOME" : "EXPENSE";
}

function uploadStatusVariant(status: ReviewUpload["status"]) {
  if (status === "APPROVED") return "secondary";
  if (status === "REJECTED" || status === "FAILED") return "destructive";
  if (status === "READY_FOR_REVIEW") return "default";
  return "outline";
}

function draftStatusVariant(status: ReviewDraft["reviewStatus"]) {
  if (status === "APPROVED") return "secondary";
  if (status === "REJECTED") return "destructive";
  if (status === "NEEDS_INFO") return "outline";
  return "default";
}

function buildDraftFormState(draft: ReviewDraft, defaultCurrency: string): DraftFormState {
  return {
    description: draft.description ?? "",
    vendorName: draft.vendorName ?? "",
    suggestedCategoryName: draft.suggestedCategoryName ?? "",
    categoryId: draft.categoryId ? String(draft.categoryId) : "",
    amount: amountInputValue(draft.amountMinor),
    taxAmount: amountInputValue(draft.taxAmountMinor),
    vatAmount: amountInputValue(draft.vatAmountMinor),
    whtAmount: amountInputValue(draft.whtAmountMinor),
    taxRate: String(draft.taxRate ?? 0),
    currency: draft.currency || defaultCurrency,
    transactionDate: toDateInputValue(draft.proposedDate),
    suggestedType: suggestedTypeFromDirection(draft.direction),
    vatTreatment: draft.vatTreatment,
    whtTreatment: draft.whtTreatment,
    reviewerNote: draft.reviewerNote ?? "",
  };
}

function DraftReviewCard({
  draft,
  clientBusiness,
  editable,
}: {
  draft: ReviewDraft;
  clientBusiness: ClientBusinessOption | undefined;
  editable: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() =>
    buildDraftFormState(draft, clientBusiness?.defaultCurrency ?? "NGN")
  );
  const [savingAction, setSavingAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitReview(action: "approve" | "reject") {
    if (!editable || savingAction) return;

    setSavingAction(action);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/bookkeeping/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Unable to review draft.");
        return;
      }

      setMessage(
        action === "approve"
          ? "Draft approved and posted into the ledger."
          : "Draft rejected and kept out of the ledger."
      );
      router.refresh();
    } catch {
      setError("Network error reviewing draft.");
    } finally {
      setSavingAction(null);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">
              {draft.description ?? "Untitled extracted draft"}
            </h3>
            <Badge variant={draftStatusVariant(draft.reviewStatus)}>
              {draft.reviewStatus.replace(/_/g, " ")}
            </Badge>
            {draft.ledgerTransactionId ? (
              <Badge variant="secondary">Ledger #{draft.ledgerTransactionId}</Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Confidence {Math.round((draft.confidence ?? 0) * 100)}%
            {draft.reviewedByName ? ` · Reviewed by ${draft.reviewedByName}` : ""}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{formatAmount(draft.amountMinor, draft.currency || "NGN") || "Pending amount"}</div>
          <div>{draft.proposedDate ? new Date(draft.proposedDate).toLocaleDateString() : "Date pending"}</div>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="grid gap-2 xl:col-span-2">
          <Label htmlFor={`description-${draft.id}`}>Description</Label>
          <Input
            id={`description-${draft.id}`}
            name="description"
            value={form.description}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`transactionDate-${draft.id}`}>Transaction date</Label>
          <Input
            id={`transactionDate-${draft.id}`}
            name="transactionDate"
            type="date"
            value={form.transactionDate}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`vendorName-${draft.id}`}>Vendor</Label>
          <Input
            id={`vendorName-${draft.id}`}
            name="vendorName"
            value={form.vendorName}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`suggestedType-${draft.id}`}>Suggested type</Label>
          <select
            id={`suggestedType-${draft.id}`}
            name="suggestedType"
            value={form.suggestedType}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`categoryId-${draft.id}`}>Category</Label>
          <select
            id={`categoryId-${draft.id}`}
            name="categoryId"
            value={form.categoryId}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Use suggested category</option>
            {(clientBusiness?.categories ?? []).map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`suggestedCategoryName-${draft.id}`}>Suggested category name</Label>
          <Input
            id={`suggestedCategoryName-${draft.id}`}
            name="suggestedCategoryName"
            value={form.suggestedCategoryName}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`amount-${draft.id}`}>Amount</Label>
          <Input
            id={`amount-${draft.id}`}
            name="amount"
            inputMode="decimal"
            value={form.amount}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`taxAmount-${draft.id}`}>Tax amount</Label>
          <Input
            id={`taxAmount-${draft.id}`}
            name="taxAmount"
            inputMode="decimal"
            value={form.taxAmount}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`taxRate-${draft.id}`}>Tax rate %</Label>
          <Input
            id={`taxRate-${draft.id}`}
            name="taxRate"
            inputMode="decimal"
            value={form.taxRate}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`vatAmount-${draft.id}`}>VAT amount</Label>
          <Input
            id={`vatAmount-${draft.id}`}
            name="vatAmount"
            inputMode="decimal"
            value={form.vatAmount}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`whtAmount-${draft.id}`}>WHT amount</Label>
          <Input
            id={`whtAmount-${draft.id}`}
            name="whtAmount"
            inputMode="decimal"
            value={form.whtAmount}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`currency-${draft.id}`}>Currency</Label>
          <Input
            id={`currency-${draft.id}`}
            name="currency"
            value={form.currency}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`vatTreatment-${draft.id}`}>VAT treatment</Label>
          <select
            id={`vatTreatment-${draft.id}`}
            name="vatTreatment"
            value={form.vatTreatment}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="NONE">None</option>
            <option value="INPUT">Input VAT</option>
            <option value="OUTPUT">Output VAT</option>
            <option value="EXEMPT">Exempt</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`whtTreatment-${draft.id}`}>WHT treatment</Label>
          <select
            id={`whtTreatment-${draft.id}`}
            name="whtTreatment"
            value={form.whtTreatment}
            onChange={handleChange}
            disabled={!editable || Boolean(draft.ledgerTransactionId)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="NONE">None</option>
            <option value="PAYABLE">Payable</option>
            <option value="RECEIVABLE">Receivable</option>
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <Label htmlFor={`reviewerNote-${draft.id}`}>Reviewer note</Label>
        <textarea
          id={`reviewerNote-${draft.id}`}
          name="reviewerNote"
          value={form.reviewerNote}
          onChange={handleChange}
          disabled={!editable || Boolean(draft.ledgerTransactionId)}
          rows={3}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {draft.approvedAt
            ? `Approved ${new Date(draft.approvedAt).toLocaleString()}`
            : draft.rejectedAt
              ? `Rejected ${new Date(draft.rejectedAt).toLocaleString()}`
              : "Pending review"}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => submitReview("reject")}
            disabled={!editable || Boolean(draft.ledgerTransactionId) || savingAction !== null}
          >
            {savingAction === "reject" ? "Rejecting..." : "Reject draft"}
          </Button>
          <Button
            type="button"
            onClick={() => submitReview("approve")}
            disabled={!editable || Boolean(draft.ledgerTransactionId) || savingAction !== null}
          >
            {savingAction === "approve" ? "Approving..." : "Approve to ledger"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BookkeepingReviewClient({
  workspaceName,
  role,
  initialUploads,
  metrics,
  clientBusinesses,
  aiDevelopmentBypass,
}: Props) {
  const router = useRouter();
  const editable = canEdit(role);
  const [selectedClientBusinessId, setSelectedClientBusinessId] = useState(
    clientBusinesses[0]?.id ? String(clientBusinesses[0].id) : ""
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const approvedDraftCount = initialUploads.reduce(
    (total, upload) => total + upload.approvedDraftCount,
    0
  );

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!editable || uploading) return;

    if (!selectedClientBusinessId) {
      setUploadError("Select a client business before uploading.");
      return;
    }
    if (!file) {
      setUploadError("Choose a receipt, invoice image, or PDF.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.set("clientBusinessId", selectedClientBusinessId);
      formData.set("file", file);

      const res = await fetch("/api/ai/bookkeeping-extract", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data?.error ?? "Unable to extract bookkeeping draft.");
        return;
      }

      setUploadMessage("Upload processed and sent to the bookkeeping review queue.");
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      router.refresh();
    } catch {
      setUploadError("Network error uploading document.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Bookkeeping review</h1>
          <p className="text-muted-foreground">
            Upload receipts or invoices, then approve AI drafts into the ledger.
          </p>
          <p className="text-sm text-muted-foreground">
            Workspace: <span className="font-medium text-foreground">{workspaceName}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Review queue</Badge>
          <Button asChild variant="outline">
            <Link href="/dashboard/client-businesses">Client businesses</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/tax-summary">Tax summary</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Businesses in scope</CardDescription>
            <CardTitle className="text-xl">{metrics.businessCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Queue items</CardDescription>
            <CardTitle className="text-xl">{metrics.queuedUploadCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drafts needing review</CardDescription>
            <CardTitle className="text-xl">{metrics.pendingDraftCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved drafts</CardDescription>
            <CardTitle className="text-xl">{approvedDraftCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload document</CardTitle>
          <CardDescription>
            Supports receipt images, invoice images, and text-based PDF receipts or invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiDevelopmentBypass ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Development mode: AI receipt scanning is temporarily available without the paid
              plan gate for local testing.
            </div>
          ) : null}
          {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
          {uploadMessage ? <p className="text-sm text-emerald-700">{uploadMessage}</p> : null}
          {clientBusinesses.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
              Create a client business before uploading source documents.
            </div>
          ) : (
            <form onSubmit={handleUpload} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <div className="grid gap-2">
                <Label htmlFor="clientBusinessId">Client business</Label>
                <select
                  id="clientBusinessId"
                  value={selectedClientBusinessId}
                  onChange={(event) => setSelectedClientBusinessId(event.target.value)}
                  disabled={!editable || uploading}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {clientBusinesses.map((business) => (
                    <option key={business.id} value={String(business.id)}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bookkeeping-file">Receipt / invoice file</Label>
                <input
                  ref={fileInputRef}
                  id="bookkeeping-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  disabled={!editable || uploading}
                  className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={!editable || uploading}>
                  {uploading ? "Extracting..." : "Extract draft"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-muted/20">
        <CardHeader>
          <CardTitle>Review workflow</CardTitle>
          <CardDescription>
            Uploads always land in review first. Nothing auto-posts to the ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div className="rounded-lg border border-dashed px-4 py-3">
            1. Upload a receipt, invoice image, or text PDF for a selected client business.
          </div>
          <div className="rounded-lg border border-dashed px-4 py-3">
            2. Review extracted vendor, category, amount, VAT, and WHT fields before posting.
          </div>
          <div className="rounded-lg border border-dashed px-4 py-3">
            3. Approve to create a ledger transaction, or reject to keep the document out of books.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload queue</CardTitle>
          <CardDescription>
            Latest bookkeeping uploads across this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {initialUploads.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
              No uploads yet. The first extracted document will appear here with editable draft
              fields for accountant review.
            </div>
          ) : (
            initialUploads.map((upload) => {
              const clientBusiness = clientBusinesses.find(
                (business) => business.id === upload.clientBusiness.id
              );

              return (
                <div key={upload.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold">{upload.fileName}</h2>
                        <Badge variant={uploadStatusVariant(upload.status)}>
                          {upload.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {upload.clientBusiness.name} · {upload.sourceType.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitted {new Date(upload.createdAt).toLocaleString()}
                        {upload.uploadedByName
                          ? ` by ${upload.uploadedByName}`
                          : upload.uploadedByEmail
                            ? ` by ${upload.uploadedByEmail}`
                            : ""}
                      </p>
                    </div>
                    <div className="grid gap-1 text-right text-xs text-muted-foreground">
                      <span>{upload.draftCount} draft lines</span>
                      <span>{upload.pendingDraftCount} pending review</span>
                      <span>{upload.approvedDraftCount} approved</span>
                    </div>
                  </div>

                  {upload.failureReason ? (
                    <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                      {upload.failureReason}
                    </div>
                  ) : null}
                  {upload.reviewNotes ? (
                    <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap">
                      {upload.reviewNotes}
                    </div>
                  ) : null}
                  {upload.rawText ? (
                    <details className="mt-3 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      <summary className="cursor-pointer font-medium text-foreground">
                        Raw extracted text
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-xs">
                        {upload.rawText}
                      </pre>
                    </details>
                  ) : null}

                  <div className="mt-4 grid gap-4">
                    {upload.drafts.map((draft) => (
                      <DraftReviewCard
                        key={draft.id}
                        draft={draft}
                        clientBusiness={clientBusiness}
                        editable={editable}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </section>
  );
}
