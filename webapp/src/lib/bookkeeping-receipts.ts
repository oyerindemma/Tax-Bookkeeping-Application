import "server-only";

import { prisma } from "@/src/lib/prisma";
import type {
  BookkeepingExtraction,
  BookkeepingFieldConfidences,
  BookkeepingExtractionLineItem,
  ExtractionMetadata,
  ExtractedDocumentType,
  ExtractedSuggestedType,
  ExtractedVatTreatment,
  ExtractedWhtTreatment,
} from "@/src/lib/bookkeeping-extract";

export type DuplicateDetectionResult = {
  duplicateOfUploadId: number | null;
  confidence: number | null;
  reason: string | null;
  duplicateUpload:
    | {
        id: number;
        fileName: string;
        createdAt: string;
        status: string;
        clientBusinessName: string;
      }
    | null;
};

export type HistorySuggestionResult = {
  vendorId: number | null;
  vendorName: string | null;
  categoryId: number | null;
  suggestedCategoryName: string | null;
  vatTreatment: ExtractedVatTreatment;
  whtTreatment: ExtractedWhtTreatment;
  deductibilityHint: string | null;
  notes: string[];
  vendorConfidence: number;
  categoryConfidence: number;
};

export type ReceiptScannerPayload = {
  version: 2;
  extraction: BookkeepingExtraction;
  metadata: ExtractionMetadata;
  historySuggestion: HistorySuggestionResult;
  duplicateDetection: DuplicateDetectionResult;
  rawResponse: unknown | null;
};

export function safeJsonParse<T>(value: unknown): T | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string | null | undefined) {
  return normalizeName(value)
    .split(" ")
    .filter((token) => token.length > 2);
}

function similarity(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }

  return overlap / new Set([...leftTokens, ...rightTokens]).size;
}

function sameDayDistance(left: string | null, right: Date | null) {
  if (!left || !right) return null;
  const leftDate = new Date(`${left}T12:00:00.000Z`);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(right.getTime())) return null;
  return Math.abs(leftDate.getTime() - right.getTime()) / (24 * 60 * 60 * 1000);
}

function amountSimilarity(leftMinor: number | null, rightMinor: number | null) {
  if (leftMinor === null || rightMinor === null || leftMinor <= 0 || rightMinor <= 0) return 0;
  const delta = Math.abs(leftMinor - rightMinor) / Math.max(leftMinor, rightMinor);
  if (delta === 0) return 1;
  if (delta <= 0.01) return 0.8;
  if (delta <= 0.05) return 0.45;
  return 0;
}

function buildDeductibilityHint(
  categoryName: string | null,
  documentType: ExtractedDocumentType
) {
  if (documentType === "CREDIT_NOTE") {
    return "Review this credit note against the original claim so any expense and VAT treatment is reversed appropriately.";
  }

  if (!categoryName) {
    return "Confirm the spend was wholly business-related and supported before treating it as deductible.";
  }

  const normalized = categoryName.toLowerCase();
  if (/(travel|transport|rent|utilities|software|office|professional|operations)/.test(normalized)) {
    return "Usually deductible when the receipt supports an ordinary business operating cost.";
  }
  if (/(tax|compliance)/.test(normalized)) {
    return "Usually deductible when it relates to business compliance or advisory work, subject to local rules.";
  }

  return "Review the business purpose and evidence before confirming deductibility.";
}

export async function detectDuplicateBookkeepingUpload(input: {
  workspaceId: number;
  currentUploadId: number;
  clientBusinessId: number;
  fileHash: string | null;
  documentNumber: string | null;
  vendorName: string | null;
  reference: string | null;
  totalAmountMinor: number | null;
  transactionDate: string | null;
}) {
  const normalizedDocumentNumber = normalizeName(input.documentNumber);
  const normalizedVendorName = normalizeName(input.vendorName);
  const normalizedReference = normalizeName(input.reference);

  const candidates = await prisma.bookkeepingUpload.findMany({
    where: {
      workspaceId: input.workspaceId,
      id: { not: input.currentUploadId },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      fileName: true,
      fileHash: true,
      status: true,
      createdAt: true,
      clientBusiness: {
        select: {
          id: true,
          name: true,
        },
      },
      drafts: {
        take: 1,
        orderBy: [{ createdAt: "asc" }],
        select: {
          documentNumber: true,
          vendorName: true,
          reference: true,
          amountMinor: true,
          totalAmountMinor: true,
          proposedDate: true,
        },
      },
    },
  });

  for (const candidate of candidates) {
    if (input.fileHash && candidate.fileHash && input.fileHash === candidate.fileHash) {
      return {
        duplicateOfUploadId: candidate.id,
        confidence: 0.99,
        reason: "Exact file hash match with an earlier upload in this workspace.",
        duplicateUpload: {
          id: candidate.id,
          fileName: candidate.fileName,
          createdAt: candidate.createdAt.toISOString(),
          status: candidate.status,
          clientBusinessName: candidate.clientBusiness.name,
        },
      } satisfies DuplicateDetectionResult;
    }
  }

  let bestMatch: DuplicateDetectionResult | null = null;

  for (const candidate of candidates) {
    const draft = candidate.drafts[0];
    if (!draft) continue;

    let score = 0;
    const reasons: string[] = [];
    const candidateDocumentNumber = normalizeName(draft.documentNumber);
    const candidateVendorName = normalizeName(draft.vendorName);
    const candidateReference = normalizeName(draft.reference);
    const candidateAmount = draft.totalAmountMinor ?? draft.amountMinor ?? null;

    if (normalizedDocumentNumber && candidateDocumentNumber === normalizedDocumentNumber) {
      score += 0.45;
      reasons.push("same document number");
    }
    if (normalizedVendorName && candidateVendorName === normalizedVendorName) {
      score += 0.2;
      reasons.push("same vendor");
    }
    if (normalizedReference && candidateReference === normalizedReference) {
      score += 0.18;
      reasons.push("same reference");
    }

    const amountScore = amountSimilarity(input.totalAmountMinor, candidateAmount);
    if (amountScore >= 0.8) {
      score += 0.22;
      reasons.push("same amount");
    } else if (amountScore > 0) {
      score += 0.12;
      reasons.push("very similar amount");
    }

    const dateDistance = sameDayDistance(input.transactionDate, draft.proposedDate);
    if (dateDistance !== null && dateDistance <= 1) {
      score += 0.12;
      reasons.push("same date");
    } else if (dateDistance !== null && dateDistance <= 7) {
      score += 0.06;
      reasons.push("close transaction date");
    }

    if (candidate.clientBusiness.id === input.clientBusinessId) {
      score += 0.02;
    }

    if (!bestMatch || (bestMatch.confidence ?? 0) < score) {
      bestMatch = {
        duplicateOfUploadId: score >= 0.62 ? candidate.id : null,
        confidence: score,
        reason:
          score >= 0.62
            ? `Likely duplicate: ${reasons.join(", ")}.`
            : null,
        duplicateUpload:
          score >= 0.62
            ? {
                id: candidate.id,
                fileName: candidate.fileName,
                createdAt: candidate.createdAt.toISOString(),
                status: candidate.status,
                clientBusinessName: candidate.clientBusiness.name,
              }
            : null,
      };
    }
  }

  return bestMatch ?? {
    duplicateOfUploadId: null,
    confidence: null,
    reason: null,
    duplicateUpload: null,
  };
}

export async function buildWorkspaceHistorySuggestion(input: {
  clientBusinessId: number;
  vendorName: string | null;
  description: string;
  reference: string | null;
  suggestedCategoryName: string | null;
  amountMinor: number | null;
  transactionDate: string | null;
  suggestedType: ExtractedSuggestedType;
  documentType: ExtractedDocumentType;
  vatTreatment: ExtractedVatTreatment;
  whtTreatment: ExtractedWhtTreatment;
}) {
  const [vendors, categories, recentTransactions] = await Promise.all([
    prisma.vendor.findMany({
      where: { clientBusinessId: input.clientBusinessId },
      select: { id: true, name: true },
    }),
    prisma.transactionCategory.findMany({
      where: { clientBusinessId: input.clientBusinessId },
      select: { id: true, name: true },
    }),
    prisma.ledgerTransaction.findMany({
      where: { clientBusinessId: input.clientBusinessId },
      orderBy: [{ transactionDate: "desc" }],
      take: 80,
      select: {
        vendorId: true,
        categoryId: true,
        description: true,
        reference: true,
        amountMinor: true,
        transactionDate: true,
        vatTreatment: true,
        whtTreatment: true,
        vendor: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const normalizedVendorName = normalizeName(input.vendorName);
  const normalizedSuggestedCategory = normalizeName(input.suggestedCategoryName);
  const exactVendor = vendors.find((vendor) => normalizeName(vendor.name) === normalizedVendorName) ?? null;
  const exactCategory =
    categories.find((category) => normalizeName(category.name) === normalizedSuggestedCategory) ?? null;

  let bestScore = 0;
  let bestTransaction: (typeof recentTransactions)[number] | null = null;

  for (const transaction of recentTransactions) {
    let score = 0;
    if (normalizedVendorName && normalizeName(transaction.vendor?.name) === normalizedVendorName) {
      score += 0.42;
    }
    if (normalizedSuggestedCategory && normalizeName(transaction.category?.name) === normalizedSuggestedCategory) {
      score += 0.18;
    }
    score += similarity(input.description, transaction.description) * 0.28;
    score += similarity(input.reference, transaction.reference) * 0.12;
    score += amountSimilarity(input.amountMinor, transaction.amountMinor) * 0.12;

    const dateDistance = sameDayDistance(input.transactionDate, transaction.transactionDate);
    if (dateDistance !== null && dateDistance <= 7) {
      score += 0.08;
    }

    if (score > bestScore) {
      bestScore = score;
      bestTransaction = transaction;
    }
  }

  const notes: string[] = [];
  const vendorId = exactVendor?.id ?? bestTransaction?.vendorId ?? null;
  let vendorName = exactVendor?.name ?? bestTransaction?.vendor?.name ?? input.vendorName ?? null;
  const categoryId = exactCategory?.id ?? bestTransaction?.categoryId ?? null;
  let suggestedCategoryName =
    exactCategory?.name ?? bestTransaction?.category?.name ?? input.suggestedCategoryName ?? null;

  if (exactVendor) {
    notes.push("Matched the vendor against an existing vendor profile for this business.");
  } else if (bestTransaction?.vendor?.name && bestScore >= 0.45) {
    notes.push("Reused vendor context from a similar ledger posting.");
  }

  if (exactCategory) {
    notes.push("Matched the suggested category to an existing business category.");
  } else if (bestTransaction?.category?.name && bestScore >= 0.45) {
    notes.push("Suggested a category from similar prior bookkeeping history.");
  }

  let vatTreatment = input.vatTreatment;
  let whtTreatment = input.whtTreatment;

  if (bestTransaction && bestScore >= 0.6) {
    if (vatTreatment === "NONE" && bestTransaction.vatTreatment !== "NONE") {
      vatTreatment = bestTransaction.vatTreatment;
      notes.push("VAT treatment was strengthened from similar posted history.");
    }
    if (whtTreatment === "NONE" && bestTransaction.whtTreatment !== "NONE") {
      whtTreatment = bestTransaction.whtTreatment;
      notes.push("WHT treatment was strengthened from similar posted history.");
    }
  }

  if (!vendorId && input.vendorName) {
    vendorName = input.vendorName;
  }
  if (!categoryId && input.suggestedCategoryName) {
    suggestedCategoryName = input.suggestedCategoryName;
  }

  return {
    vendorId,
    vendorName,
    categoryId,
    suggestedCategoryName,
    vatTreatment,
    whtTreatment,
    deductibilityHint: buildDeductibilityHint(suggestedCategoryName, input.documentType),
    notes,
    vendorConfidence: exactVendor ? 0.92 : bestScore >= 0.45 ? Math.min(0.88, bestScore) : 0.22,
    categoryConfidence: exactCategory ? 0.9 : bestScore >= 0.45 ? Math.min(0.84, bestScore) : 0.2,
  } satisfies HistorySuggestionResult;
}

export function buildReceiptScannerPayload(input: {
  extraction: BookkeepingExtraction;
  metadata: ExtractionMetadata;
  historySuggestion: HistorySuggestionResult;
  duplicateDetection: DuplicateDetectionResult;
  rawResponse: unknown | null;
}) {
  return {
    version: 2,
    extraction: input.extraction,
    metadata: input.metadata,
    historySuggestion: input.historySuggestion,
    duplicateDetection: input.duplicateDetection,
    rawResponse: input.rawResponse,
  } satisfies ReceiptScannerPayload;
}

export function parseReceiptScannerPayload(raw: unknown) {
  return safeJsonParse<ReceiptScannerPayload>(raw);
}

export function parseFieldConfidences(raw: unknown) {
  return safeJsonParse<BookkeepingFieldConfidences>(raw);
}

export function parseLineItems(raw: unknown) {
  return safeJsonParse<BookkeepingExtractionLineItem[]>(raw) ?? [];
}
