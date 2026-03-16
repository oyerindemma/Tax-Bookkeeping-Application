import "server-only";

import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import {
  BOOKKEEPING_CATEGORY_GUIDANCE,
  buildFallbackTextSuggestion,
  extractOutputText,
  getSuggestedTaxRate,
} from "@/src/lib/bookkeeping-ai";
import { getOpenAiServerConfig } from "@/src/lib/env";
import { NIGERIA_TAX_CONFIG } from "@/src/lib/nigeria-tax-config";

export type ExtractedDocumentType = "RECEIPT" | "INVOICE" | "OTHER";
export type ExtractedSuggestedType = "INCOME" | "EXPENSE";
export type ExtractedVatTreatment = "NONE" | "INPUT" | "OUTPUT" | "EXEMPT";
export type ExtractedWhtTreatment = "NONE" | "PAYABLE" | "RECEIVABLE";

export type BookkeepingExtraction = {
  documentType: ExtractedDocumentType;
  vendorName: string | null;
  amount: number | null;
  taxAmount: number | null;
  taxRate: number;
  currency: string;
  transactionDate: string | null;
  description: string;
  suggestedCategory: string | null;
  suggestedType: ExtractedSuggestedType;
  vatTreatment: ExtractedVatTreatment;
  whtTreatment: ExtractedWhtTreatment;
  confidenceScore: number;
  rawText: string | null;
  vatAmount: number | null;
  whtAmount: number | null;
  notes: string[];
};

export type ExtractionMetadata = {
  provider: "openai" | "heuristic-fallback" | "unavailable";
  model: string | null;
  warnings: string[];
  fileName: string | null;
  mimeType: string | null;
};

export type BookkeepingExtractionResult = {
  extraction: BookkeepingExtraction;
  metadata: ExtractionMetadata;
  rawResponse: string | null;
};

export const SUPPORTED_BOOKKEEPING_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const MAX_BOOKKEEPING_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_BOOKKEEPING_PDF_BYTES = 15 * 1024 * 1024;

const CLIENT_BUSINESS_CATEGORY_GUIDANCE =
  "When a category fits, prefer one of these exact names: Revenue, Cost of sales, Operations, Payroll, Rent and utilities, Professional fees, Tax and compliance, Travel and logistics.";

const PDF_PARSE_WORKER_SRC = pathToFileURL(
  path.resolve(process.cwd(), "node_modules/pdf-parse/dist/worker/pdf.worker.mjs")
).toString();

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDate(value: unknown) {
  const raw = normalizeString(value);
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizeDocumentType(value: unknown): ExtractedDocumentType {
  const raw = normalizeString(value).toUpperCase();
  if (raw === "RECEIPT" || raw === "INVOICE") return raw;
  return "OTHER";
}

function normalizeSuggestedType(value: unknown): ExtractedSuggestedType {
  const raw = normalizeString(value).toUpperCase();
  return raw === "INCOME" ? "INCOME" : "EXPENSE";
}

function normalizeVatTreatment(value: unknown): ExtractedVatTreatment {
  const raw = normalizeString(value).toUpperCase();
  if (raw === "INPUT" || raw === "OUTPUT" || raw === "EXEMPT") return raw;
  return "NONE";
}

function normalizeWhtTreatment(value: unknown): ExtractedWhtTreatment {
  const raw = normalizeString(value).toUpperCase();
  if (raw === "PAYABLE" || raw === "RECEIVABLE") return raw;
  return "NONE";
}

function normalizeConfidenceScore(value: unknown) {
  const numberValue = normalizeNumber(value);
  if (numberValue === null) return 0.35;
  if (numberValue > 1) {
    return Math.max(0, Math.min(1, numberValue / 100));
  }
  return Math.max(0, Math.min(1, numberValue));
}

function normalizeNotes(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((entry) => normalizeString(entry))
    .filter(Boolean)
    .slice(0, 6);
}

function inferDocumentType(text: string, fileName?: string | null): ExtractedDocumentType {
  const normalized = `${fileName ?? ""}\n${text}`.toLowerCase();
  if (normalized.includes("invoice")) return "INVOICE";
  if (normalized.includes("receipt")) return "RECEIPT";
  return "OTHER";
}

function mapSuggestionToTreatments(
  suggestedType: ExtractedSuggestedType,
  vatRelevant: boolean,
  whtRelevant: boolean
) {
  const vatTreatment: ExtractedVatTreatment = vatRelevant
    ? suggestedType === "INCOME"
      ? "OUTPUT"
      : "INPUT"
    : "NONE";
  const whtTreatment: ExtractedWhtTreatment = whtRelevant
    ? suggestedType === "INCOME"
      ? "RECEIVABLE"
      : "PAYABLE"
    : "NONE";

  return {
    vatTreatment,
    whtTreatment,
  };
}

export function buildFallbackBookkeepingExtraction(
  text: string,
  options?: {
    fileName?: string | null;
    rawText?: string | null;
    warnings?: string[];
  }
): BookkeepingExtraction {
  const suggestion = buildFallbackTextSuggestion(text);
  const suggestedType: ExtractedSuggestedType = suggestion.classification;
  const taxRate = getSuggestedTaxRate(suggestion);
  const { vatTreatment, whtTreatment } = mapSuggestionToTreatments(
    suggestedType,
    suggestion.vat.relevance !== "NOT_RELEVANT",
    suggestion.wht.relevance !== "NOT_RELEVANT"
  );

  return {
    documentType: inferDocumentType(text, options?.fileName),
    vendorName: suggestion.vendorName,
    amount: suggestion.amount,
    taxAmount: null,
    taxRate,
    currency: suggestion.currency,
    transactionDate: suggestion.transactionDate,
    description: suggestion.description,
    suggestedCategory: suggestion.suggestedCategory,
    suggestedType,
    vatTreatment,
    whtTreatment,
    confidenceScore: suggestion.confidence === "HIGH" ? 0.9 : suggestion.confidence === "MEDIUM" ? 0.65 : 0.35,
    rawText: options?.rawText ?? text,
    vatAmount: null,
    whtAmount: null,
    notes: [...suggestion.notes, ...(options?.warnings ?? [])].slice(0, 6),
  };
}

export function normalizeBookkeepingExtraction(
  input: unknown,
  fallback: {
    fileName?: string | null;
    rawText?: string | null;
  }
): BookkeepingExtraction {
  const value =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const suggestedType = normalizeSuggestedType(value.suggestedType);

  return {
    documentType:
      normalizeString(value.documentType) === ""
        ? inferDocumentType(fallback.rawText ?? "", fallback.fileName)
        : normalizeDocumentType(value.documentType),
    vendorName: normalizeString(value.vendorName) || null,
    amount: normalizeNumber(value.amount),
    taxAmount: normalizeNumber(value.taxAmount),
    taxRate: Math.max(0, normalizeNumber(value.taxRate) ?? 0),
    currency: normalizeString(value.currency).toUpperCase() || "NGN",
    transactionDate: normalizeDate(value.transactionDate),
    description: normalizeString(value.description) || "Business transaction",
    suggestedCategory: normalizeString(value.suggestedCategory) || null,
    suggestedType,
    vatTreatment: normalizeVatTreatment(value.vatTreatment),
    whtTreatment: normalizeWhtTreatment(value.whtTreatment),
    confidenceScore: normalizeConfidenceScore(value.confidenceScore),
    rawText: normalizeString(value.rawText) || fallback.rawText || null,
    vatAmount: normalizeNumber(value.vatAmount),
    whtAmount: normalizeNumber(value.whtAmount),
    notes: normalizeNotes(value.notes),
  };
}

async function requestOpenAiExtraction(requestBody: unknown) {
  const { apiKey } = getOpenAiServerConfig();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? "AI request failed");
  }

  const outputText = extractOutputText(data);
  if (!outputText) {
    throw new Error("AI response missing output");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("AI response was not valid JSON");
  }

  return {
    rawResponse: data,
    parsed,
  };
}

function buildExtractionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      documentType: {
        type: "string",
        enum: ["RECEIPT", "INVOICE", "OTHER"],
      },
      vendorName: {
        type: ["string", "null"],
      },
      amount: {
        type: ["number", "null"],
      },
      taxAmount: {
        type: ["number", "null"],
      },
      taxRate: {
        type: "number",
      },
      currency: {
        type: "string",
      },
      transactionDate: {
        type: ["string", "null"],
      },
      description: {
        type: "string",
      },
      suggestedCategory: {
        type: ["string", "null"],
      },
      suggestedType: {
        type: "string",
        enum: ["INCOME", "EXPENSE"],
      },
      vatTreatment: {
        type: "string",
        enum: ["NONE", "INPUT", "OUTPUT", "EXEMPT"],
      },
      whtTreatment: {
        type: "string",
        enum: ["NONE", "PAYABLE", "RECEIVABLE"],
      },
      confidenceScore: {
        type: "number",
      },
      rawText: {
        type: ["string", "null"],
      },
      vatAmount: {
        type: ["number", "null"],
      },
      whtAmount: {
        type: ["number", "null"],
      },
      notes: {
        type: "array",
        items: { type: "string" },
        maxItems: 6,
      },
    },
    required: [
      "documentType",
      "vendorName",
      "amount",
      "taxAmount",
      "taxRate",
      "currency",
      "transactionDate",
      "description",
      "suggestedCategory",
      "suggestedType",
      "vatTreatment",
      "whtTreatment",
      "confidenceScore",
      "rawText",
      "vatAmount",
      "whtAmount",
      "notes",
    ],
  };
}

function buildBaseInstructions() {
  return (
    "You are TaxBook AI, an extraction assistant for Nigerian accounting firms. " +
    "Return exactly one conservative bookkeeping draft from the supplied document. " +
    "Do not invent fields. If a field is not visible or cannot be supported, return null or use NONE. " +
    "Use NGN when currency is missing. " +
    `Use ${NIGERIA_TAX_CONFIG.vat.standardRate}% as the default VAT rate only when VAT is explicit or strongly implied. ` +
    `Use ${NIGERIA_TAX_CONFIG.wht.heuristicDefaultRate}% as the default WHT rate only when withholding is explicit or strongly implied. ` +
    "For expense documents, VAT usually maps to INPUT and WHT usually maps to PAYABLE. " +
    "For income documents, VAT usually maps to OUTPUT and WHT usually maps to RECEIVABLE. " +
    `${BOOKKEEPING_CATEGORY_GUIDANCE} ${CLIENT_BUSINESS_CATEGORY_GUIDANCE} ` +
    "Set confidenceScore between 0 and 1. " +
    "Populate rawText with the best available OCR or parsed text, trimmed to useful content."
  );
}

export async function extractBookkeepingFromImage(options: {
  dataUrl: string;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<BookkeepingExtractionResult> {
  const { visionModel: model } = getOpenAiServerConfig();
  const prompt =
    `${buildBaseInstructions()} ` +
    "The document is an image receipt or invoice. Determine whether it is a receipt, invoice, or other document.";

  const { parsed, rawResponse } = await requestOpenAiExtraction({
    model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: options.dataUrl },
        ],
      },
    ],
    temperature: 0.1,
    text: {
      format: {
        type: "json_schema",
        name: "bookkeeping_extract_image",
        strict: true,
        schema: buildExtractionSchema(),
      },
    },
  });

  return {
    extraction: normalizeBookkeepingExtraction(parsed, {
      fileName: options.fileName,
      rawText: null,
    }),
    metadata: {
      provider: "openai" as const,
      model,
      warnings: [] as string[],
      fileName: options.fileName ?? null,
      mimeType: options.mimeType ?? null,
    },
    rawResponse,
  };
}

export async function extractBookkeepingFromText(options: {
  text: string;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<BookkeepingExtractionResult> {
  const { model } = getOpenAiServerConfig();
  const prompt =
    `${buildBaseInstructions()} ` +
    "The document text came from a receipt, invoice, or PDF parse. Infer documentType from the text." +
    `\n\nDocument text:\n${options.text}`;

  const { parsed, rawResponse } = await requestOpenAiExtraction({
    model,
    input: prompt,
    temperature: 0.1,
    text: {
      format: {
        type: "json_schema",
        name: "bookkeeping_extract_text",
        strict: true,
        schema: buildExtractionSchema(),
      },
    },
  });

  return {
    extraction: normalizeBookkeepingExtraction(parsed, {
      fileName: options.fileName,
      rawText: options.text,
    }),
    metadata: {
      provider: "openai" as const,
      model,
      warnings: [] as string[],
      fileName: options.fileName ?? null,
      mimeType: options.mimeType ?? null,
    },
    rawResponse,
  };
}

export async function extractPdfText(buffer: Buffer) {
  PDFParse.setWorker(PDF_PARSE_WORKER_SRC);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text.trim() || null;
  } finally {
    await parser.destroy();
  }
}

export function deriveUploadSourceType(documentType: ExtractedDocumentType) {
  if (documentType === "RECEIPT") return "RECEIPT" as const;
  if (documentType === "INVOICE") return "INVOICE" as const;
  return "OTHER" as const;
}

export function deriveLedgerDirection(suggestedType: ExtractedSuggestedType) {
  return suggestedType === "INCOME" ? "MONEY_IN" : "MONEY_OUT";
}

export function toMinorUnits(amount: number | null) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

export function buildStoredDraftAmounts(extraction: BookkeepingExtraction) {
  const taxAmountMinor = toMinorUnits(extraction.taxAmount);
  const explicitVatAmountMinor = toMinorUnits(extraction.vatAmount);
  const explicitWhtAmountMinor = toMinorUnits(extraction.whtAmount);

  return {
    amountMinor: toMinorUnits(extraction.amount),
    taxAmountMinor,
    vatAmountMinor:
      explicitVatAmountMinor ??
      (extraction.vatTreatment !== "NONE" && extraction.whtTreatment === "NONE"
        ? taxAmountMinor ?? 0
        : 0),
    whtAmountMinor:
      explicitWhtAmountMinor ??
      (extraction.whtTreatment !== "NONE" && extraction.vatTreatment === "NONE"
        ? taxAmountMinor ?? 0
        : 0),
  };
}
