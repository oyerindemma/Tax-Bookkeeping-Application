"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
type BankTransactionStatus =
  | "UNMATCHED"
  | "SUGGESTED"
  | "MATCHED"
  | "IGNORED"
  | "SPLIT"
  | "REVIEW_REQUIRED";
type SuggestedType = "INCOME" | "EXPENSE" | "TRANSFER" | "OWNER_DRAW" | "UNKNOWN";
type VatTreatment = "NONE" | "INPUT" | "OUTPUT" | "EXEMPT";
type WhtTreatment = "NONE" | "PAYABLE" | "RECEIVABLE";

type BankAccount = {
  id: number;
  name: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  clientBusinessId: number | null;
  clientBusinessName: string | null;
  createdAt: string;
  updatedAt: string;
};

type ClientBusiness = {
  id: number;
  name: string;
  defaultCurrency: string;
  categories: Array<{
    id: number;
    name: string;
    type: string;
  }>;
};

type ImportHistory = {
  id: number;
  fileName: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
  failedCount: number;
  warningCount: number;
  bankAccount: {
    id: number;
    name: string;
  };
  clientBusiness: {
    id: number;
    name: string;
  } | null;
  uploadedByName: string | null;
};

type MatchSuggestion = {
  id: number;
  matchType: string;
  status: string;
  score: number;
  rationale: string | null;
  matchedAmountMinor: number | null;
  createdAt: string;
  approvedAt: string | null;
  target: {
    title: string;
    subtitle: string | null;
    amountMinor: number | null;
    reference: string | null;
    kind: string;
    linkedId: number | null;
    clientBusinessName: string | null;
  };
};

type Transaction = {
  id: number;
  transactionDate: string;
  description: string;
  reference: string | null;
  amountMinor: number;
  debitAmountMinor: number | null;
  creditAmountMinor: number | null;
  balanceAmountMinor: number | null;
  type: "CREDIT" | "DEBIT";
  status: BankTransactionStatus;
  currency: string;
  sourceRowNumber: number | null;
  reviewNotes: string | null;
  bankAccount: {
    id: number;
    name: string;
    bankName: string;
    accountNumber: string;
    currency: string;
  };
  clientBusiness: {
    id: number;
    name: string;
    defaultCurrency: string;
  } | null;
  statementImport: {
    id: number;
    fileName: string;
    status: string;
    createdAt: string;
    importedCount: number;
    duplicateCount: number;
    failedCount: number;
  } | null;
  categorization: {
    suggestedType: SuggestedType;
    counterpartyName: string | null;
    suggestedCategoryName: string | null;
    suggestedVatTreatment: VatTreatment;
    suggestedWhtTreatment: WhtTreatment;
    narrationMeaning: string | null;
    confidenceScore: number | null;
    provider: string | null;
    vatRelevance: "RELEVANT" | "NOT_RELEVANT" | "UNCERTAIN";
    whtRelevance: "RELEVANT" | "NOT_RELEVANT" | "UNCERTAIN";
    vatRate: number;
    whtRate: number;
  };
  approvedMatch: MatchSuggestion | null;
  suggestions: MatchSuggestion[];
  splitLines: Array<{
    id: number;
    description: string;
    reference: string | null;
    amountMinor: number;
    direction: string;
    currency: string;
    vatAmountMinor: number;
    whtAmountMinor: number;
    vatTreatment: VatTreatment;
    whtTreatment: WhtTreatment;
    vendorName: string | null;
    categoryName: string | null;
    ledgerTransactionId: number | null;
  }>;
};

type DashboardResponse = {
  accounts: BankAccount[];
  clientBusinesses: ClientBusiness[];
  imports: ImportHistory[];
  transactions: Transaction[];
  summary: {
    total: number;
    byStatus: Record<BankTransactionStatus, number>;
  };
  aiConfigured: boolean;
};

type PreviewResponse = {
  preview: {
    headers: string[];
    suggestedMapping: Record<string, string | null>;
    previewRows: Array<Record<string, string>>;
    guidance: string[];
  };
};

type AccountForm = {
  name: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  clientBusinessId: string;
};

type Filters = {
  status: string;
  bankAccountId: string;
  clientBusinessId: string;
  importId: string;
  query: string;
};

type TransactionForm = {
  clientBusinessId: string;
  description: string;
  reference: string;
  vendorName: string;
  categoryName: string;
  categoryId: string;
  suggestedType: SuggestedType;
  vatTreatment: VatTreatment;
  whtTreatment: WhtTreatment;
  vatAmount: string;
  whtAmount: string;
  notes: string;
  splitLines: Array<{
    description: string;
    reference: string;
    amount: string;
    vendorName: string;
    categoryName: string;
    categoryId: string;
    suggestedType: SuggestedType;
    vatTreatment: VatTreatment;
    whtTreatment: WhtTreatment;
    vatAmount: string;
    whtAmount: string;
    notes: string;
  }>;
};

type ImportDiagnostics = {
  kind: "error" | "warning";
  guidance: string[];
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
};

type MappingFieldKey =
  | "transactionDate"
  | "description"
  | "debit"
  | "credit"
  | "amount"
  | "balance"
  | "reference";

const FIELD_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "", label: "Not mapped" },
  { key: "transactionDate", label: "Transaction date" },
  { key: "description", label: "Description" },
  { key: "debit", label: "Debit" },
  { key: "credit", label: "Credit" },
  { key: "amount", label: "Amount" },
  { key: "balance", label: "Balance" },
  { key: "reference", label: "Reference" },
];

type Props = {
  role: Role;
  developmentBillingBypass?: boolean;
};

function canEdit(role: Role) {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER";
}

function formatMoney(amountMinor: number | null | undefined, currency: string) {
  if (typeof amountMinor !== "number") return "Not set";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function minorToInput(amountMinor: number | null | undefined) {
  if (typeof amountMinor !== "number") return "";
  return (amountMinor / 100).toFixed(2);
}

function inputToMinor(value: string) {
  const parsed = Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function getMappedHeader(
  mapping: Record<string, string | null>,
  field: MappingFieldKey
) {
  return mapping[field] ?? null;
}

function getMappedFieldForHeader(
  mapping: Record<string, string | null>,
  header: string
) {
  return (
    (Object.entries(mapping).find(([, value]) => value === header)?.[0] as MappingFieldKey | undefined) ??
    null
  );
}

function getHeaderSamples(
  preview: PreviewResponse["preview"],
  header: string
) {
  return preview.previewRows
    .map((row) => row[header] ?? "")
    .filter((value) => value.trim() !== "")
    .slice(0, 2);
}

function getMappingReadiness(
  preview: PreviewResponse["preview"] | null,
  mapping: Record<string, string | null>
) {
  if (!preview) {
    return {
      ready: false,
      blockers: ["Preview the CSV before importing."],
      mappedCount: 0,
      totalCount: FIELD_OPTIONS.length - 1,
    };
  }

  const blockers: string[] = [];
  if (!getMappedHeader(mapping, "transactionDate")) {
    blockers.push("Map the transaction date column.");
  }
  if (!getMappedHeader(mapping, "description")) {
    blockers.push("Map the narration or description column.");
  }
  if (
    !getMappedHeader(mapping, "amount") &&
    !getMappedHeader(mapping, "debit") &&
    !getMappedHeader(mapping, "credit")
  ) {
    blockers.push("Map a single amount column or the debit/credit columns.");
  }

  const uniqueHeaders = new Map<string, string[]>();
  Object.entries(mapping).forEach(([field, header]) => {
    if (!header) return;
    uniqueHeaders.set(header, [...(uniqueHeaders.get(header) ?? []), field]);
  });

  uniqueHeaders.forEach((fields, header) => {
    if (fields.length > 1) {
      blockers.push(`Column "${header}" is mapped more than once.`);
    }
  });

  const mappedCount = FIELD_OPTIONS.filter((option) => option.key).reduce((count, option) => {
    return mapping[option.key] ? count + 1 : count;
  }, 0);

  return {
    ready: blockers.length === 0,
    blockers,
    mappedCount,
    totalCount: FIELD_OPTIONS.length - 1,
  };
}

function hasActiveFilters(filters: Filters) {
  return Boolean(
    filters.status ||
      filters.bankAccountId ||
      filters.clientBusinessId ||
      filters.importId ||
      filters.query.trim()
  );
}

function sumSplitLineAmounts(lines: TransactionForm["splitLines"]) {
  return lines.reduce((sum, line) => sum + (inputToMinor(line.amount) ?? 0), 0);
}

function getConfidenceMeta(
  score: number | null | undefined,
  kind: "categorization" | "match"
) {
  if (typeof score !== "number") {
    return {
      label: "Needs review",
      helper: "No confidence score is available yet.",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (kind === "match") {
    if (score >= 0.85) {
      return {
        label: "Strong match",
        helper: `${Math.round(score * 100)}% confidence`,
        className: "border-emerald-200 bg-emerald-50 text-emerald-900",
      };
    }
    if (score >= 0.7) {
      return {
        label: "Good match",
        helper: `${Math.round(score * 100)}% confidence`,
        className: "border-sky-200 bg-sky-50 text-sky-900",
      };
    }
    return {
      label: "Possible match",
      helper: `${Math.round(score * 100)}% confidence`,
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (score >= 0.8) {
    return {
      label: "High confidence",
      helper: `${Math.round(score * 100)}% confidence`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }
  if (score >= 0.6) {
    return {
      label: "Medium confidence",
      helper: `${Math.round(score * 100)}% confidence`,
      className: "border-sky-200 bg-sky-50 text-sky-900",
    };
  }
  return {
    label: "Low confidence",
    helper: `${Math.round(score * 100)}% confidence`,
    className: "border-amber-200 bg-amber-50 text-amber-900",
  };
}

function getSuggestedActionLabel(suggestion: MatchSuggestion) {
  if (suggestion.matchType === "INVOICE") {
    return "Approve invoice match";
  }
  if (suggestion.matchType === "LEDGER_TRANSACTION") {
    return "Approve ledger match";
  }
  if (suggestion.matchType === "BOOKKEEPING_DRAFT") {
    return "Approve draft match";
  }
  return "Approve suggested match";
}

function badgeVariant(status: BankTransactionStatus) {
  switch (status) {
    case "MATCHED":
      return "secondary" as const;
    case "IGNORED":
      return "outline" as const;
    case "REVIEW_REQUIRED":
      return "destructive" as const;
    case "SPLIT":
      return "secondary" as const;
    default:
      return "default" as const;
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function buildTransactionForm(transaction: Transaction): TransactionForm {
  return {
    clientBusinessId: transaction.clientBusiness ? String(transaction.clientBusiness.id) : "",
    description: transaction.description,
    reference: transaction.reference ?? "",
    vendorName: transaction.categorization.counterpartyName ?? "",
    categoryName: transaction.categorization.suggestedCategoryName ?? "",
    categoryId: "",
    suggestedType: transaction.categorization.suggestedType,
    vatTreatment: transaction.categorization.suggestedVatTreatment,
    whtTreatment: transaction.categorization.suggestedWhtTreatment,
    vatAmount: "",
    whtAmount: "",
    notes: transaction.reviewNotes ?? transaction.categorization.narrationMeaning ?? "",
    splitLines: [
      {
        description: transaction.description,
        reference: transaction.reference ?? "",
        amount: minorToInput(transaction.amountMinor),
        vendorName: transaction.categorization.counterpartyName ?? "",
        categoryName: transaction.categorization.suggestedCategoryName ?? "",
        categoryId: "",
        suggestedType: transaction.categorization.suggestedType,
        vatTreatment: transaction.categorization.suggestedVatTreatment,
        whtTreatment: transaction.categorization.suggestedWhtTreatment,
        vatAmount: "",
        whtAmount: "",
        notes: "",
      },
      {
        description: "",
        reference: "",
        amount: "0.00",
        vendorName: "",
        categoryName: "",
        categoryId: "",
        suggestedType: transaction.type === "CREDIT" ? "INCOME" : "EXPENSE",
        vatTreatment: "NONE",
        whtTreatment: "NONE",
        vatAmount: "",
        whtAmount: "",
        notes: "",
      },
    ],
  };
}

function buildInitialFilters(): Filters {
  return {
    status: "",
    bankAccountId: "",
    clientBusinessId: "",
    importId: "",
    query: "",
  };
}

export default function ReconcileClient({
  role,
  developmentBillingBypass = false,
}: Props) {
  const editable = canEdit(role);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => buildInitialFilters());
  const [accountForm, setAccountForm] = useState<AccountForm>({
    name: "",
    bankName: "",
    accountNumber: "",
    currency: "NGN",
    clientBusinessId: "",
  });
  const [savingAccount, setSavingAccount] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse["preview"] | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDiagnostics, setImportDiagnostics] = useState<ImportDiagnostics | null>(null);
  const [forms, setForms] = useState<Record<number, TransactionForm>>({});
  const [splittingTransactionId, setSplittingTransactionId] = useState<number | null>(null);
  const [workingTransactionId, setWorkingTransactionId] = useState<number | null>(null);

  async function loadDashboard(activeFilters = filters) {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (activeFilters.status) params.set("status", activeFilters.status);
      if (activeFilters.bankAccountId) params.set("bankAccountId", activeFilters.bankAccountId);
      if (activeFilters.clientBusinessId) {
        params.set("clientBusinessId", activeFilters.clientBusinessId);
      }
      if (activeFilters.importId) params.set("importId", activeFilters.importId);
      if (activeFilters.query) params.set("query", activeFilters.query);

      const response = await fetch(
        `/api/banking/reconcile${params.toString() ? `?${params.toString()}` : ""}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as DashboardResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load reconciliation dashboard");
      }

      setDashboard(data);
      setForms((current) => {
        const next = { ...current };
        data.transactions.forEach((transaction) => {
          if (!next[transaction.id]) {
            next[transaction.id] = buildTransactionForm(transaction);
          }
        });
        return next;
      });

      if (!selectedBusinessId && data.clientBusinesses.length === 1) {
        setSelectedBusinessId(String(data.clientBusinesses[0].id));
      }

      if (!selectedAccountId && data.accounts.length === 1) {
        setSelectedAccountId(String(data.accounts[0].id));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // Initial load only; filter application is explicit from the review controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitAccount() {
    if (!editable || savingAccount) return;
    setSavingAccount(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/banking/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...accountForm,
          clientBusinessId: accountForm.clientBusinessId || null,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create bank account");
      }

      setAccountForm({
        name: "",
        bankName: "",
        accountNumber: "",
        currency: "NGN",
        clientBusinessId: "",
      });
      setMessage("Bank account created.");
      await loadDashboard();
    } catch (accountError) {
      setError(accountError instanceof Error ? accountError.message : "Network error");
    } finally {
      setSavingAccount(false);
    }
  }

  async function previewImport() {
    if (!editable || previewing) return;
    if (!selectedFile) {
      setError("Choose a CSV file to preview.");
      return;
    }
    if (!selectedAccountId) {
      setError("Select a bank account before previewing the CSV.");
      return;
    }
    if (!selectedBusinessId) {
      setError("Select a client business before previewing the CSV.");
      return;
    }

    setPreviewing(true);
    setError(null);
    setMessage(null);
    setImportDiagnostics(null);

    try {
      const formData = new FormData();
      formData.append("mode", "preview");
      formData.append("file", selectedFile);

      const response = await fetch("/api/banking/import", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as PreviewResponse & { error?: string };

      if (!response.ok || !data.preview) {
        throw new Error(data.error ?? "Failed to preview CSV");
      }

      setPreview(data.preview);
      setMapping(data.preview.suggestedMapping);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Network error");
    } finally {
      setPreviewing(false);
    }
  }

  async function importStatement() {
    if (!editable || importing) return;
    if (!selectedFile || !selectedAccountId || !selectedBusinessId) {
      setError("Choose the CSV file, bank account, and client business before importing.");
      return;
    }
    if (!preview) {
      setError("Preview the CSV and confirm the column mapping before importing.");
      return;
    }

    setImporting(true);
    setError(null);
    setMessage(null);
    setImportDiagnostics(null);

    try {
      const formData = new FormData();
      formData.append("mode", "import");
      formData.append("file", selectedFile);
      formData.append("bankAccountId", selectedAccountId);
      formData.append("clientBusinessId", selectedBusinessId);
      formData.append("mapping", JSON.stringify(mapping));

      const response = await fetch("/api/banking/import", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        error?: string;
        inserted?: number;
        duplicateCount?: number;
        failedCount?: number;
        guidance?: string[];
        errors?: ImportDiagnostics["errors"];
      };

      if (!response.ok) {
        setImportDiagnostics({
          kind: "error",
          guidance: data.guidance ?? [],
          errors: data.errors ?? [],
        });
        throw new Error(data.error ?? "Failed to import statement");
      }

      setPreview(null);
      setSelectedFile(null);
      setMapping({});
      setImportDiagnostics(
        (data.guidance?.length ?? 0) > 0 || (data.errors?.length ?? 0) > 0 || (data.failedCount ?? 0) > 0
          ? {
              kind: "warning",
              guidance: data.guidance ?? [],
              errors: data.errors ?? [],
            }
          : null
      );
      setMessage(
        `Imported ${data.inserted ?? 0} transactions. Duplicates skipped: ${
          data.duplicateCount ?? 0
        }. Failed rows: ${data.failedCount ?? 0}.`
      );
      await loadDashboard();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Network error");
    } finally {
      setImporting(false);
    }
  }

  function updateForm(
    transactionId: number,
    field: keyof TransactionForm,
    value: string | TransactionForm["splitLines"]
  ) {
    setForms((current) => {
      const existing = current[transactionId];
      if (existing) {
        return {
          ...current,
          [transactionId]: {
            ...existing,
            [field]: value,
          },
        };
      }

      const baseTransaction = dashboard?.transactions.find(
        (transaction) => transaction.id === transactionId
      );
      if (!baseTransaction) return current;

      return {
        ...current,
        [transactionId]: {
          ...buildTransactionForm(baseTransaction),
          [field]: value,
        },
      };
    });
  }

  function updateSplitLine(
    transactionId: number,
    index: number,
    field: keyof TransactionForm["splitLines"][number],
    value: string
  ) {
    setForms((current) => {
      const form = current[transactionId];
      if (!form) return current;
      const nextLines = [...form.splitLines];
      nextLines[index] = {
        ...nextLines[index],
        [field]: value,
      };
      return {
        ...current,
        [transactionId]: {
          ...form,
          splitLines: nextLines,
        },
      };
    });
  }

  function addSplitLine(transaction: Transaction, form: TransactionForm) {
    const remainingMinor = transaction.amountMinor - sumSplitLineAmounts(form.splitLines);
    updateForm(transaction.id, "splitLines", [
      ...form.splitLines,
      {
        description: "",
        reference: "",
        amount: minorToInput(remainingMinor > 0 ? remainingMinor : 0),
        vendorName: "",
        categoryName: "",
        categoryId: "",
        suggestedType: transaction.type === "CREDIT" ? "INCOME" : "EXPENSE",
        vatTreatment: "NONE",
        whtTreatment: "NONE",
        vatAmount: "",
        whtAmount: "",
        notes: "",
      },
    ]);
  }

  function removeSplitLine(transactionId: number, index: number) {
    setForms((current) => {
      const form = current[transactionId];
      if (!form || form.splitLines.length <= 2) return current;

      return {
        ...current,
        [transactionId]: {
          ...form,
          splitLines: form.splitLines.filter((_, lineIndex) => lineIndex !== index),
        },
      };
    });
  }

  function updateMappingField(field: MappingFieldKey, header: string) {
    setMapping((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        if (next[key] === header && key !== field) {
          next[key] = null;
        }
      });
      next[field] = header || null;
      return next;
    });
  }

  async function runTransactionAction(
    transactionId: number,
    action: "reclassify" | "create_ledger" | "ignore" | "split",
    payload?: Record<string, unknown>
  ) {
    if (!editable || workingTransactionId) return;
    setWorkingTransactionId(transactionId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/banking/reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          transactionId,
          ...payload,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update the bank transaction");
      }

      setMessage(
        action === "ignore"
          ? "Transaction ignored."
          : action === "split"
            ? "Transaction split and posted."
            : action === "create_ledger"
              ? "Ledger transaction created."
              : "Classification updated."
      );
      if (action === "split") {
        setSplittingTransactionId(null);
      }
      await loadDashboard();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Network error");
    } finally {
      setWorkingTransactionId(null);
    }
  }

  async function approveMatch(transactionId: number, matchId: number) {
    if (!editable || workingTransactionId) return;
    setWorkingTransactionId(transactionId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/banking/matches/${matchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to approve suggestion");
      }

      setMessage("Suggested match approved.");
      await loadDashboard();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Network error");
    } finally {
      setWorkingTransactionId(null);
    }
  }

  const transactions = dashboard?.transactions ?? [];
  const accounts = dashboard?.accounts ?? [];
  const clientBusinesses = dashboard?.clientBusinesses ?? [];
  const imports = dashboard?.imports ?? [];
  const mappingFields = FIELD_OPTIONS.filter(
    (option): option is { key: MappingFieldKey; label: string } => option.key !== ""
  );
  const requiredMappingFields = mappingFields.filter(
    (option) => option.key === "transactionDate" || option.key === "description"
  );
  const optionalMappingFields = mappingFields.filter(
    (option) => !requiredMappingFields.some((requiredField) => requiredField.key === option.key)
  );
  const mappingReadiness = getMappingReadiness(preview, mapping);
  const queueHasFilters = hasActiveFilters(filters);
  const noAccounts = accounts.length === 0;
  const noBusinesses = clientBusinesses.length === 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Bank Statement Reconciliation</h1>
          <p className="text-muted-foreground">
            Import CSV statements, classify them for Nigerian bookkeeping, and reconcile each
            line before it reaches the ledger.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">CSV first</Badge>
          <Badge variant={dashboard?.aiConfigured ? "secondary" : "outline"}>
            {dashboard?.aiConfigured ? "AI categorization enabled" : "Fallback heuristics mode"}
          </Badge>
        </div>
      </div>

      {!dashboard?.aiConfigured && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            `OPENAI_API_KEY` is not configured. Statement import still works, but categorization
            confidence is reduced and suggestions come from local heuristics.
          </CardContent>
        </Card>
      )}

      {developmentBillingBypass ? (
        <Card className="border-dashed border-amber-300 bg-amber-50/60">
          <CardContent className="pt-6 text-sm text-amber-950">
            Development billing bypass is active. Banking reconciliation is unlocked locally
            without the Business plan, but production plan checks still apply.
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <div>{error}</div>
          <Button type="button" size="sm" variant="outline" onClick={() => loadDashboard()}>
            Retry
          </Button>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total transactions</CardDescription>
            <CardTitle className="text-xl">{dashboard?.summary.total ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Suggested</CardDescription>
            <CardTitle className="text-xl">{dashboard?.summary.byStatus.SUGGESTED ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Review required</CardDescription>
            <CardTitle className="text-xl">
              {dashboard?.summary.byStatus.REVIEW_REQUIRED ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Matched or split</CardDescription>
            <CardTitle className="text-xl">
              {(dashboard?.summary.byStatus.MATCHED ?? 0) + (dashboard?.summary.byStatus.SPLIT ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Import bank statement</CardTitle>
            <CardDescription>
            Preview the CSV, confirm the column mapping, then import transactions into the
            review queue. Sample file:{" "}
            <Link href="/docs/sample-bank-statement.csv" className="underline underline-offset-2">
              sample-bank-statement.csv
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {noBusinesses ? (
            <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
              Create or select a client business before importing bank statements.
            </div>
          ) : null}
          {noAccounts ? (
            <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
              Create a bank account in the panel on the right before you preview a CSV.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="clientBusinessId">Client business</Label>
              <select
                  id="clientBusinessId"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedBusinessId}
                onChange={(event) => {
                  setSelectedBusinessId(event.target.value);
                  const businessId = Number(event.target.value);
                  const account = accounts.find(
                    (candidate) => candidate.clientBusinessId === businessId
                  );
                  if ((!selectedAccountId || account?.id !== Number(selectedAccountId)) && account) {
                    setSelectedAccountId(String(account.id));
                  }
                }}
                disabled={!editable}
              >
                  <option value="">Select a business</option>
                  {clientBusinesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bankAccountId">Bank account</Label>
                <select
                  id="bankAccountId"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedAccountId}
                  onChange={(event) => setSelectedAccountId(event.target.value)}
                  disabled={!editable}
                >
                  <option value="">Select an account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.bankName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="csvFile">CSV file</Label>
                <Input
                  id="csvFile"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  disabled={!editable}
                />
                {selectedFile ? (
                  <div className="text-xs text-muted-foreground">
                    {selectedFile.name} · {(selectedFile.size / 1024).toFixed(1)} KB
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={previewImport} disabled={!editable || previewing}>
                {previewing ? "Previewing..." : "Preview mapping"}
              </Button>
              <Button
                type="button"
                onClick={importStatement}
                disabled={!editable || importing || !preview || !mappingReadiness.ready}
              >
                {importing ? "Importing..." : "Import statement"}
              </Button>
            </div>

            {preview ? (
              <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                <div
                  className={cn(
                    "rounded-lg border px-4 py-3",
                    mappingReadiness.ready
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-amber-200 bg-amber-50"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">
                        {mappingReadiness.ready ? "Mapping looks ready" : "Mapping needs attention"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {mappingReadiness.mappedCount} of {mappingReadiness.totalCount} import fields mapped
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMapping(preview.suggestedMapping)}
                        disabled={!editable}
                      >
                        Use suggested mapping
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMapping({})}
                        disabled={!editable}
                      >
                        Clear mapping
                      </Button>
                    </div>
                  </div>
                  {!mappingReadiness.ready ? (
                    <div className="mt-3 space-y-1 text-sm text-amber-900">
                      {mappingReadiness.blockers.map((blocker) => (
                        <div key={blocker}>{blocker}</div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 text-sm font-medium">Required mapping</div>
                      <div className="space-y-3">
                        {requiredMappingFields.map((field) => {
                          const mappedHeader = getMappedHeader(mapping, field.key);
                          const suggestedHeader = getMappedHeader(preview.suggestedMapping, field.key);
                          const samples = mappedHeader ? getHeaderSamples(preview, mappedHeader) : [];

                          return (
                            <div key={field.key} className="rounded-md border border-slate-200 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-sm font-medium">{field.label}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {field.key === "amount"
                                      ? "Use this for a signed amount column, or leave it empty and map debit/credit below."
                                      : "Required to import the statement."}
                                  </div>
                                </div>
                                <Badge variant={mappedHeader ? "secondary" : "outline"}>
                                  {mappedHeader ? "Mapped" : "Missing"}
                                </Badge>
                              </div>
                              <div className="mt-3 grid gap-3">
                                <select
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={mappedHeader ?? ""}
                                  onChange={(event) => updateMappingField(field.key, event.target.value)}
                                  disabled={!editable}
                                >
                                  <option value="">Not mapped</option>
                                  {preview.headers.map((header) => (
                                    <option key={`${field.key}-${header}`} value={header}>
                                      {header}
                                      {suggestedHeader === header ? " • suggested" : ""}
                                    </option>
                                  ))}
                                </select>
                                <div className="text-xs text-muted-foreground">
                                  {samples.length > 0
                                    ? `Examples: ${samples.join(" • ")}`
                                    : suggestedHeader
                                      ? `Suggested from column "${suggestedHeader}".`
                                      : "No sample values available for this field yet."}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 text-sm font-medium">Optional or supporting columns</div>
                      <div className="space-y-3">
                        {optionalMappingFields.map((field) => {
                          const mappedHeader = getMappedHeader(mapping, field.key);
                          const suggestedHeader = getMappedHeader(preview.suggestedMapping, field.key);
                          const samples = mappedHeader ? getHeaderSamples(preview, mappedHeader) : [];

                          return (
                            <div key={field.key} className="rounded-md border border-slate-200 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-medium">{field.label}</div>
                                {suggestedHeader ? (
                                  <div className="text-xs text-muted-foreground">
                                    Suggested: {suggestedHeader}
                                  </div>
                                ) : null}
                              </div>
                              <div className="mt-3 grid gap-3">
                                <select
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={mappedHeader ?? ""}
                                  onChange={(event) => updateMappingField(field.key, event.target.value)}
                                  disabled={!editable}
                                >
                                  <option value="">Not mapped</option>
                                  {preview.headers.map((header) => (
                                    <option key={`${field.key}-${header}`} value={header}>
                                      {header}
                                    </option>
                                  ))}
                                </select>
                                <div className="text-xs text-muted-foreground">
                                  {samples.length > 0
                                    ? `Examples: ${samples.join(" • ")}`
                                    : "Map this only if the export includes it."}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 text-sm font-medium">Preview rows</div>
                      {preview.previewRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No data rows available.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-md border border-slate-200">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-muted/40 text-muted-foreground">
                              <tr>
                                {preview.headers.map((header) => {
                                  const mappedField = getMappedFieldForHeader(mapping, header);
                                  return (
                                    <th
                                      key={header}
                                      className={cn(
                                        "px-3 py-2 font-medium",
                                        mappedField ? "bg-sky-50 text-sky-900" : undefined
                                      )}
                                    >
                                      <div className="space-y-1">
                                        <div>{header}</div>
                                        {mappedField ? (
                                          <div className="text-[10px] uppercase tracking-wide text-sky-700">
                                            {statusLabel(mappedField)}
                                          </div>
                                        ) : null}
                                      </div>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {preview.previewRows.map((row, rowIndex) => (
                                <tr key={`${rowIndex}-${Object.keys(row).join("-")}`} className="border-t">
                                  {preview.headers.map((header) => (
                                    <td key={header} className="px-3 py-2 text-slate-700">
                                      {row[header] || "—"}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-muted/20 p-4">
                      <div className="mb-2 text-sm font-medium">Import guidance</div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {preview.guidance.map((item) => (
                          <div key={item}>{item}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {importDiagnostics ? (
              <div
                className={cn(
                  "rounded-lg border px-4 py-4",
                  importDiagnostics.kind === "error"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-amber-200 bg-amber-50"
                )}
              >
                <div className="text-sm font-medium">
                  {importDiagnostics.kind === "error" ? "Import needs fixes" : "Import completed with warnings"}
                </div>
                {importDiagnostics.guidance.length > 0 ? (
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {importDiagnostics.guidance.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                ) : null}
                {importDiagnostics.errors.length > 0 ? (
                  <div className="mt-3 space-y-2 text-sm">
                    {importDiagnostics.errors.slice(0, 8).map((issue, index) => (
                      <div key={`${issue.row}-${issue.field}-${index}`} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                        Row {issue.row} · {issue.field}: {issue.message}
                      </div>
                    ))}
                    {importDiagnostics.errors.length > 8 ? (
                      <div className="text-xs text-muted-foreground">
                        Showing the first 8 row issues.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create bank account</CardTitle>
            <CardDescription>
              Keep each account linked to the client business that owns the statement activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="accountName">Account name</Label>
                <Input
                  id="accountName"
                  value={accountForm.name}
                  onChange={(event) =>
                    setAccountForm((current) => ({ ...current, name: event.target.value }))
                  }
                  disabled={!editable}
                  placeholder="Main operating account"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bankName">Bank</Label>
                <Input
                  id="bankName"
                  value={accountForm.bankName}
                  onChange={(event) =>
                    setAccountForm((current) => ({ ...current, bankName: event.target.value }))
                  }
                  disabled={!editable}
                  placeholder="Access Bank"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accountNumber">Account number</Label>
                <Input
                  id="accountNumber"
                  value={accountForm.accountNumber}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      accountNumber: event.target.value,
                    }))
                  }
                  disabled={!editable}
                  placeholder="0123456789"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accountCurrency">Currency</Label>
                <Input
                  id="accountCurrency"
                  value={accountForm.currency}
                  onChange={(event) =>
                    setAccountForm((current) => ({ ...current, currency: event.target.value }))
                  }
                  disabled={!editable}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accountBusiness">Client business</Label>
                <select
                  id="accountBusiness"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={accountForm.clientBusinessId}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      clientBusinessId: event.target.value,
                    }))
                  }
                  disabled={!editable}
                >
                  <option value="">Select a business</option>
                  {clientBusinesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="button" onClick={submitAccount} disabled={!editable || savingAccount}>
              {savingAccount ? "Saving..." : "Save account"}
            </Button>

            <div className="space-y-2">
              {accounts.length === 0 ? (
                <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  No bank accounts yet. Create one here so imported statements are tied to the
                  right business account.
                </div>
              ) : (
                accounts.map((account) => (
                  <div key={account.id} className="rounded-md border border-slate-200 px-3 py-3">
                    <div className="font-medium">{account.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {account.bankName} · {account.accountNumber} · {account.currency}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {account.clientBusinessName ?? "Client business not linked"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import history</CardTitle>
          <CardDescription>Recent bank statement imports and their row outcomes.</CardDescription>
        </CardHeader>
        <CardContent>
          {imports.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-5 text-sm text-muted-foreground">
              No statement imports yet. Preview and import a CSV to start the reconciliation queue.
            </div>
          ) : (
            <div className="space-y-3">
              {imports.map((statementImport) => (
                <div key={statementImport.id} className="rounded-md border border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{statementImport.fileName}</div>
                      <div className="text-sm text-muted-foreground">
                        {statementImport.bankAccount.name}
                        {statementImport.clientBusiness ? ` · ${statementImport.clientBusiness.name}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline">{statusLabel(statementImport.status)}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                    <div>Rows: {statementImport.rowCount}</div>
                    <div>Imported: {statementImport.importedCount}</div>
                    <div>Duplicates: {statementImport.duplicateCount}</div>
                    <div>Failed: {statementImport.failedCount}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
          <CardDescription>
            Filter by status, import batch, bank account, or free-text narration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="grid gap-2">
              <Label htmlFor="filterStatus">Status</Label>
              <select
                id="filterStatus"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="">All statuses</option>
                {[
                  "UNMATCHED",
                  "SUGGESTED",
                  "MATCHED",
                  "SPLIT",
                  "REVIEW_REQUIRED",
                  "IGNORED",
                ].map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="filterBankAccount">Bank account</Label>
              <select
                id="filterBankAccount"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={filters.bankAccountId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, bankAccountId: event.target.value }))
                }
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="filterBusiness">Client business</Label>
              <select
                id="filterBusiness"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={filters.clientBusinessId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    clientBusinessId: event.target.value,
                  }))
                }
              >
                <option value="">All businesses</option>
                {clientBusinesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="filterImport">Import batch</Label>
              <select
                id="filterImport"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={filters.importId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, importId: event.target.value }))
                }
              >
                <option value="">All imports</option>
                {imports.map((statementImport) => (
                  <option key={statementImport.id} value={statementImport.id}>
                    {statementImport.fileName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="filterQuery">Search</Label>
              <Input
                id="filterQuery"
                value={filters.query}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, query: event.target.value }))
                }
                placeholder="Narration, reference, vendor"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => loadDashboard(filters)}>
              Apply filters
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const nextFilters = buildInitialFilters();
                setFilters(nextFilters);
                loadDashboard(nextFilters);
              }}
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Loading reconciliation queue...
            </CardContent>
          </Card>
        ) : transactions.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
              <div>
                {noAccounts
                  ? "Create a bank account first, then import a CSV statement to populate the review queue."
                  : imports.length === 0
                    ? "Import a bank statement CSV to start reconciliation."
                    : queueHasFilters
                      ? "No bank transactions match the current filters."
                      : "All imported transactions are currently cleared from the active queue."}
              </div>
              {queueHasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const nextFilters = buildInitialFilters();
                    setFilters(nextFilters);
                    loadDashboard(nextFilters);
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          transactions.map((transaction) => {
            const form = forms[transaction.id] ?? buildTransactionForm(transaction);
            const transactionBusy = workingTransactionId === transaction.id;
            const anyTransactionBusy = workingTransactionId !== null;
            const categorizationConfidence = getConfidenceMeta(
              transaction.categorization.confidenceScore,
              "categorization"
            );
            const bestSuggestion = transaction.suggestions[0] ?? null;
            const bestSuggestionConfidence = bestSuggestion
              ? getConfidenceMeta(bestSuggestion.score, "match")
              : null;
            const actionable =
              transaction.status !== "MATCHED" &&
              transaction.status !== "IGNORED" &&
              transaction.status !== "SPLIT";
            const splitTotalMinor = sumSplitLineAmounts(form.splitLines);
            const splitDifferenceMinor = transaction.amountMinor - splitTotalMinor;
            const splitBalanced = splitDifferenceMinor === 0;

            return (
              <Card key={transaction.id}>
                <CardHeader className="gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">{transaction.description}</CardTitle>
                        <Badge variant={badgeVariant(transaction.status)}>
                          {statusLabel(transaction.status)}
                        </Badge>
                        {bestSuggestionConfidence ? (
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                              bestSuggestionConfidence.className
                            )}
                          >
                            {bestSuggestionConfidence.label}
                          </span>
                        ) : null}
                      </div>
                      <CardDescription>
                        {new Date(transaction.transactionDate).toLocaleDateString()} ·{" "}
                        {transaction.bankAccount.name}
                        {transaction.reference ? ` · Ref ${transaction.reference}` : ""}
                        {transaction.sourceRowNumber ? ` · Row ${transaction.sourceRowNumber}` : ""}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        {formatMoney(transaction.amountMinor, transaction.currency)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {transaction.type}
                        {transaction.balanceAmountMinor !== null
                          ? ` · Balance ${formatMoney(transaction.balanceAmountMinor, transaction.currency)}`
                          : ""}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  {actionable ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-muted/20 px-4 py-3">
                      <div className="space-y-1">
                        {bestSuggestion ? (
                          <>
                            <div className="text-sm font-medium">
                              Best suggestion: {bestSuggestion.target.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {bestSuggestionConfidence?.helper}
                              {bestSuggestion.target.reference
                                ? ` · Ref ${bestSuggestion.target.reference}`
                                : ""}
                              {bestSuggestion.rationale ? ` · ${bestSuggestion.rationale}` : ""}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-medium">No clear match yet</div>
                            <div className="text-xs text-muted-foreground">
                              Reclassify, post manually, ignore, or split this bank line.
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {bestSuggestion ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => approveMatch(transaction.id, bestSuggestion.id)}
                            disabled={!editable || anyTransactionBusy}
                          >
                            {transactionBusy ? "Working..." : getSuggestedActionLabel(bestSuggestion)}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant={splittingTransactionId === transaction.id ? "secondary" : "outline"}
                          onClick={() =>
                            setSplittingTransactionId((current) =>
                              current === transaction.id ? null : transaction.id
                            )
                          }
                          disabled={!editable || anyTransactionBusy}
                        >
                          {splittingTransactionId === transaction.id ? "Hide split" : "Split"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => runTransactionAction(transaction.id, "ignore")}
                          disabled={!editable || anyTransactionBusy}
                        >
                          Mark ignored
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">AI or heuristic categorization</div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                              categorizationConfidence.className
                            )}
                          >
                            {categorizationConfidence.label}
                          </span>
                          <Badge variant="outline">
                            {transaction.categorization.provider === "openai"
                              ? "AI"
                              : "Heuristic"}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <div>
                          Suggested type:{" "}
                          <span className="font-medium text-foreground">
                            {statusLabel(transaction.categorization.suggestedType)}
                          </span>
                        </div>
                        <div>
                          Counterparty:{" "}
                          <span className="font-medium text-foreground">
                            {transaction.categorization.counterpartyName ?? "Not clear"}
                          </span>
                        </div>
                        <div>
                          Category:{" "}
                          <span className="font-medium text-foreground">
                            {transaction.categorization.suggestedCategoryName ?? "Not set"}
                          </span>
                        </div>
                        <div>
                          VAT:{" "}
                          <span className="font-medium text-foreground">
                            {transaction.categorization.vatRelevance} ({transaction.categorization.suggestedVatTreatment})
                          </span>
                        </div>
                        <div>
                          WHT:{" "}
                          <span className="font-medium text-foreground">
                            {transaction.categorization.whtRelevance} ({transaction.categorization.suggestedWhtTreatment})
                          </span>
                        </div>
                        <div>
                          Confidence:{" "}
                          <span className="font-medium text-foreground">
                            {categorizationConfidence.helper}
                          </span>
                        </div>
                        <div>
                          Meaning:{" "}
                          <span className="font-medium text-foreground">
                            {transaction.categorization.narrationMeaning ?? "No narration summary"}
                          </span>
                        </div>
                      </div>
                      {transaction.approvedMatch ? (
                        <div className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                          Approved match: {transaction.approvedMatch.target.title}
                          {transaction.approvedMatch.target.reference
                            ? ` · Ref ${transaction.approvedMatch.target.reference}`
                            : ""}
                        </div>
                      ) : null}
                      {transaction.status === "IGNORED" ? (
                        <div className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700">
                          This bank transaction has been ignored and will not be posted to the ledger.
                        </div>
                      ) : null}
                      {transaction.splitLines.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Split lines</div>
                          {transaction.splitLines.map((line) => (
                            <div key={line.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                              <div className="font-medium">{line.description}</div>
                              <div className="text-muted-foreground">
                                {formatMoney(line.amountMinor, line.currency)}
                                {line.categoryName ? ` · ${line.categoryName}` : ""}
                                {line.vendorName ? ` · ${line.vendorName}` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                      <div className="text-sm font-medium">Reconciliation suggestions</div>
                      {transaction.suggestions.length === 0 ? (
                        <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                          No strong suggestions yet. Reclassify this line, create a manual ledger
                          entry, or split it before posting.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {transaction.suggestions.map((suggestion) => (
                            <div
                              key={suggestion.id}
                              className={cn(
                                "rounded-md border px-3 py-3",
                                suggestion.id === bestSuggestion?.id
                                  ? "border-emerald-200 bg-emerald-50/60"
                                  : "border-slate-200"
                              )}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-medium">{suggestion.target.title}</div>
                                    <span
                                      className={cn(
                                        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                                        getConfidenceMeta(suggestion.score, "match").className
                                      )}
                                    >
                                      {getConfidenceMeta(suggestion.score, "match").label}
                                    </span>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {suggestion.target.subtitle ?? suggestion.target.kind}
                                  </div>
                                  {suggestion.target.reference ? (
                                    <div className="text-xs text-muted-foreground">
                                      Reference: {suggestion.target.reference}
                                    </div>
                                  ) : null}
                                  {suggestion.rationale ? (
                                    <div className="text-xs text-muted-foreground">
                                      Why: {suggestion.rationale}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium">
                                    {getConfidenceMeta(suggestion.score, "match").helper}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {suggestion.target.amountMinor !== null
                                      ? formatMoney(
                                          suggestion.target.amountMinor,
                                          transaction.currency
                                        )
                                      : "No amount"}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => approveMatch(transaction.id, suggestion.id)}
                                  disabled={!editable || anyTransactionBusy}
                                >
                                  {suggestion.id === bestSuggestion?.id
                                    ? getSuggestedActionLabel(suggestion)
                                    : "Approve this match"}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {actionable ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                        <details
                          {...(transaction.suggestions.length === 0 ||
                          transaction.status === "REVIEW_REQUIRED"
                            ? { open: true }
                            : {})}
                          className="rounded-lg border border-slate-200 p-4"
                        >
                          <summary className="cursor-pointer list-none text-sm font-medium">
                            Reclassify and refresh suggestions
                          </summary>
                          <div className="mt-4 space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="grid gap-2">
                                <Label htmlFor={`business-${transaction.id}`}>Client business</Label>
                                <select
                                  id={`business-${transaction.id}`}
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={form.clientBusinessId}
                                  onChange={(event) =>
                                    updateForm(transaction.id, "clientBusinessId", event.target.value)
                                  }
                                  disabled={!editable}
                                >
                                  <option value="">Select business</option>
                                  {clientBusinesses.map((business) => (
                                    <option key={business.id} value={business.id}>
                                      {business.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor={`type-${transaction.id}`}>Suggested type</Label>
                                <select
                                  id={`type-${transaction.id}`}
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={form.suggestedType}
                                  onChange={(event) =>
                                    updateForm(
                                      transaction.id,
                                      "suggestedType",
                                      event.target.value as SuggestedType
                                    )
                                  }
                                  disabled={!editable}
                                >
                                  {["INCOME", "EXPENSE", "TRANSFER", "OWNER_DRAW", "UNKNOWN"].map((type) => (
                                    <option key={type} value={type}>
                                      {statusLabel(type)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor={`counterparty-${transaction.id}`}>Counterparty</Label>
                                <Input
                                  id={`counterparty-${transaction.id}`}
                                  value={form.vendorName}
                                  onChange={(event) =>
                                    updateForm(transaction.id, "vendorName", event.target.value)
                                  }
                                  disabled={!editable}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor={`category-${transaction.id}`}>Category</Label>
                                <Input
                                  id={`category-${transaction.id}`}
                                  value={form.categoryName}
                                  onChange={(event) =>
                                    updateForm(transaction.id, "categoryName", event.target.value)
                                  }
                                  disabled={!editable}
                                  placeholder="Revenue, Operations, Professional fees"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor={`vat-${transaction.id}`}>VAT treatment</Label>
                                <select
                                  id={`vat-${transaction.id}`}
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={form.vatTreatment}
                                  onChange={(event) =>
                                    updateForm(
                                      transaction.id,
                                      "vatTreatment",
                                      event.target.value as VatTreatment
                                    )
                                  }
                                  disabled={!editable}
                                >
                                  {["NONE", "INPUT", "OUTPUT", "EXEMPT"].map((value) => (
                                    <option key={value} value={value}>
                                      {value}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor={`wht-${transaction.id}`}>WHT treatment</Label>
                                <select
                                  id={`wht-${transaction.id}`}
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={form.whtTreatment}
                                  onChange={(event) =>
                                    updateForm(
                                      transaction.id,
                                      "whtTreatment",
                                      event.target.value as WhtTreatment
                                    )
                                  }
                                  disabled={!editable}
                                >
                                  {["NONE", "PAYABLE", "RECEIVABLE"].map((value) => (
                                    <option key={value} value={value}>
                                      {value}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor={`notes-${transaction.id}`}>Review notes</Label>
                              <textarea
                                id={`notes-${transaction.id}`}
                                className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={form.notes}
                                onChange={(event) =>
                                  updateForm(transaction.id, "notes", event.target.value)
                                }
                                disabled={!editable}
                              />
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                runTransactionAction(transaction.id, "reclassify", {
                                  clientBusinessId: form.clientBusinessId || null,
                                  suggestedType: form.suggestedType,
                                  counterpartyName: form.vendorName,
                                  categoryName: form.categoryName,
                                  vatTreatment: form.vatTreatment,
                                  whtTreatment: form.whtTreatment,
                                  notes: form.notes,
                                })
                              }
                              disabled={!editable || anyTransactionBusy}
                            >
                              {transactionBusy ? "Refreshing..." : "Save classification and refresh"}
                            </Button>
                          </div>
                        </details>

                        <details
                          {...(transaction.suggestions.length === 0 ? { open: true } : {})}
                          className="rounded-lg border border-slate-200 p-4"
                        >
                          <summary className="cursor-pointer list-none text-sm font-medium">
                            Post manually
                          </summary>
                          <div className="mt-4 space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="grid gap-2">
                                <Label htmlFor={`description-${transaction.id}`}>Ledger description</Label>
                                <Input
                                  id={`description-${transaction.id}`}
                                  value={form.description}
                                  onChange={(event) =>
                                    updateForm(transaction.id, "description", event.target.value)
                                  }
                                  disabled={!editable}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor={`reference-${transaction.id}`}>Reference</Label>
                                <Input
                                  id={`reference-${transaction.id}`}
                                  value={form.reference}
                                  onChange={(event) =>
                                    updateForm(transaction.id, "reference", event.target.value)
                                  }
                                  disabled={!editable}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor={`vatAmount-${transaction.id}`}>VAT amount</Label>
                                <Input
                                  id={`vatAmount-${transaction.id}`}
                                  value={form.vatAmount}
                                  onChange={(event) =>
                                    updateForm(transaction.id, "vatAmount", event.target.value)
                                  }
                                  disabled={!editable}
                                  placeholder={`Suggested ${transaction.categorization.vatRate}% if relevant`}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor={`whtAmount-${transaction.id}`}>WHT amount</Label>
                                <Input
                                  id={`whtAmount-${transaction.id}`}
                                  value={form.whtAmount}
                                  onChange={(event) =>
                                    updateForm(transaction.id, "whtAmount", event.target.value)
                                  }
                                  disabled={!editable}
                                  placeholder={`Suggested ${transaction.categorization.whtRate}% if relevant`}
                                />
                              </div>
                            </div>

                            <Button
                              type="button"
                              onClick={() =>
                                runTransactionAction(transaction.id, "create_ledger", {
                                  clientBusinessId: form.clientBusinessId || null,
                                  description: form.description,
                                  reference: form.reference,
                                  vendorName: form.vendorName,
                                  categoryId: form.categoryId || null,
                                  categoryName: form.categoryName,
                                  suggestedType: form.suggestedType,
                                  vatTreatment: form.vatTreatment,
                                  whtTreatment: form.whtTreatment,
                                  vatAmountMinor: inputToMinor(form.vatAmount),
                                  whtAmountMinor: inputToMinor(form.whtAmount),
                                  notes: form.notes,
                                })
                              }
                              disabled={!editable || anyTransactionBusy}
                            >
                              {transactionBusy ? "Posting..." : "Create new ledger transaction"}
                            </Button>
                          </div>
                        </details>
                      </div>

                      {splittingTransactionId === transaction.id ? (
                        <div className="space-y-3 rounded-lg border border-dashed border-slate-300 px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">Split transaction</div>
                              <div className="text-xs text-muted-foreground">
                                Allocate the full bank amount across multiple accounting lines.
                              </div>
                            </div>
                            <div
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs font-medium",
                                splitBalanced
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                  : "border-amber-200 bg-amber-50 text-amber-900"
                              )}
                            >
                              Allocated {formatMoney(splitTotalMinor, transaction.currency)} · Remaining{" "}
                              {formatMoney(splitDifferenceMinor, transaction.currency)}
                            </div>
                          </div>

                          {form.splitLines.map((line, index) => (
                            <div
                              key={`${transaction.id}-${index}`}
                              className="grid gap-3 rounded-md border border-slate-200 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm font-medium">Split line {index + 1}</div>
                                {form.splitLines.length > 2 ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeSplitLine(transaction.id, index)}
                                    disabled={!editable || anyTransactionBusy}
                                  >
                                    Remove line
                                  </Button>
                                ) : null}
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="grid gap-2">
                                  <Label>Line description</Label>
                                  <Input
                                    value={line.description}
                                    onChange={(event) =>
                                      updateSplitLine(
                                        transaction.id,
                                        index,
                                        "description",
                                        event.target.value
                                      )
                                    }
                                    disabled={!editable}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Line amount</Label>
                                  <Input
                                    value={line.amount}
                                    onChange={(event) =>
                                      updateSplitLine(
                                        transaction.id,
                                        index,
                                        "amount",
                                        event.target.value
                                      )
                                    }
                                    disabled={!editable}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Vendor or counterparty</Label>
                                  <Input
                                    value={line.vendorName}
                                    onChange={(event) =>
                                      updateSplitLine(
                                        transaction.id,
                                        index,
                                        "vendorName",
                                        event.target.value
                                      )
                                    }
                                    disabled={!editable}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Category</Label>
                                  <Input
                                    value={line.categoryName}
                                    onChange={(event) =>
                                      updateSplitLine(
                                        transaction.id,
                                        index,
                                        "categoryName",
                                        event.target.value
                                      )
                                    }
                                    disabled={!editable}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => addSplitLine(transaction, form)}
                              disabled={!editable || anyTransactionBusy}
                            >
                              Add split line
                            </Button>
                            <Button
                              type="button"
                              onClick={() =>
                                runTransactionAction(transaction.id, "split", {
                                  clientBusinessId: form.clientBusinessId || null,
                                  lines: form.splitLines.map((line) => ({
                                    description: line.description,
                                    reference: line.reference,
                                    amountMinor: inputToMinor(line.amount),
                                    vendorName: line.vendorName,
                                    categoryId: line.categoryId || null,
                                    categoryName: line.categoryName,
                                    suggestedType: line.suggestedType,
                                    vatTreatment: line.vatTreatment,
                                    whtTreatment: line.whtTreatment,
                                    vatAmountMinor: inputToMinor(line.vatAmount),
                                    whtAmountMinor: inputToMinor(line.whtAmount),
                                    notes: line.notes,
                                  })),
                                })
                              }
                              disabled={!editable || anyTransactionBusy || !splitBalanced}
                            >
                              {transactionBusy ? "Saving..." : "Save split"}
                            </Button>
                            {!splitBalanced ? (
                              <div className="text-xs text-amber-700">
                                The split total must equal the bank transaction amount before you can save it.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}
