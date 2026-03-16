import { NextResponse } from "next/server";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { logAudit } from "@/src/lib/audit";
import { enforceAiScanLimit, getWorkspaceFeatureAccess } from "@/src/lib/billing";
import {
  buildFallbackBookkeepingExtraction,
  buildStoredDraftAmounts,
  deriveLedgerDirection,
  deriveUploadSourceType,
  extractBookkeepingFromImage,
  extractBookkeepingFromText,
  extractPdfText,
  MAX_BOOKKEEPING_IMAGE_BYTES,
  MAX_BOOKKEEPING_PDF_BYTES,
  SUPPORTED_BOOKKEEPING_MIME_TYPES,
} from "@/src/lib/bookkeeping-extract";
import { getWorkspaceBookkeepingReviewUpload } from "@/src/lib/bookkeeping-review";
import { hasOpenAiServerConfig } from "@/src/lib/env";
import { logRouteError } from "@/src/lib/logger";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

function isSupportedMimeType(fileType: string) {
  return SUPPORTED_BOOKKEEPING_MIME_TYPES.includes(
    fileType as (typeof SUPPORTED_BOOKKEEPING_MIME_TYPES)[number]
  );
}

function matchExistingCategoryId(
  categories: Array<{ id: number; name: string }>,
  suggestedCategoryName: string | null
) {
  const normalized = suggestedCategoryName?.trim().toLowerCase();
  if (!normalized) return null;
  return (
    categories.find((category) => category.name.trim().toLowerCase() === normalized)?.id ??
    null
  );
}

function matchExistingVendorId(
  vendors: Array<{ id: number; name: string }>,
  vendorName: string | null
) {
  const normalized = vendorName?.trim().toLowerCase();
  if (!normalized) return null;
  return vendors.find((vendor) => vendor.name.trim().toLowerCase() === normalized)?.id ?? null;
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

  const featureAccess = await getWorkspaceFeatureAccess(ctx.workspaceId, "AI_ASSISTANT");
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
  const aiScanLimit = await enforceAiScanLimit(ctx.workspaceId, 1);
  if (!aiScanLimit.ok) {
    return NextResponse.json(
      {
        error: aiScanLimit.error,
        currentPlan: aiScanLimit.plan,
        maxAiScansPerMonth: aiScanLimit.max,
        currentAiScansThisMonth: aiScanLimit.current,
        recommendedPlan: aiScanLimit.recommendedPlan,
      },
      { status: 402 }
    );
  }

  let uploadId: number | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const rawClientBusinessId = formData.get("clientBusinessId");
    const clientBusinessId =
      typeof rawClientBusinessId === "string" ? Number(rawClientBusinessId) : NaN;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!Number.isInteger(clientBusinessId)) {
      return NextResponse.json({ error: "clientBusinessId is required" }, { status: 400 });
    }

    const clientBusiness = await prisma.clientBusiness.findFirst({
      where: {
        id: clientBusinessId,
        workspaceId: ctx.workspaceId,
      },
      select: {
        id: true,
        name: true,
        categories: {
          select: {
            id: true,
            name: true,
          },
        },
        vendors: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!clientBusiness) {
      return NextResponse.json({ error: "Client business not found" }, { status: 404 });
    }

    const fileType = file.type?.trim() || "application/octet-stream";
    const upload = await prisma.bookkeepingUpload.create({
      data: {
        clientBusinessId,
        uploadedByUserId: ctx.userId,
        fileName: file.name || "bookkeeping-document",
        fileType,
        sourceType: "OTHER",
        status: "PROCESSING",
        uploadSizeBytes: file.size,
      },
      select: { id: true },
    });
    uploadId = upload.id;

    if (!isSupportedMimeType(fileType)) {
      await prisma.bookkeepingUpload.update({
        where: { id: upload.id },
        data: {
          status: "FAILED",
          failureReason: "Unsupported file type. Upload a receipt or invoice image, or a text PDF.",
          reviewNotes:
            "This file type is not supported for bookkeeping extraction. Use JPG, PNG, WEBP, HEIC, or PDF.",
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json(
        { error: "Unsupported file type", uploadId: upload.id },
        { status: 400 }
      );
    }

    if (fileType === "application/pdf" && file.size > MAX_BOOKKEEPING_PDF_BYTES) {
      await prisma.bookkeepingUpload.update({
        where: { id: upload.id },
        data: {
          status: "FAILED",
          failureReason: "PDF exceeds 15MB limit.",
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({ error: "PDF must be 15MB or smaller" }, { status: 400 });
    }

    if (fileType.startsWith("image/") && file.size > MAX_BOOKKEEPING_IMAGE_BYTES) {
      await prisma.bookkeepingUpload.update({
        where: { id: upload.id },
        data: {
          status: "FAILED",
          failureReason: "Image exceeds 8MB limit.",
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({ error: "Image must be 8MB or smaller" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const openAiAvailable = hasOpenAiServerConfig();

    let extractionResult:
      | Awaited<ReturnType<typeof extractBookkeepingFromImage>>
      | Awaited<ReturnType<typeof extractBookkeepingFromText>>
      | null = null;
    const warnings: string[] = [];
    let rawText: string | null = null;

    if (fileType === "application/pdf") {
      rawText = await extractPdfText(buffer);

      if (!rawText) {
        await prisma.bookkeepingUpload.update({
          where: { id: upload.id },
          data: {
            status: "FAILED",
            failureReason:
              "PDF text could not be extracted. Image-only PDFs are not supported in this MVP.",
            reviewedAt: new Date(),
          },
        });

        return NextResponse.json(
          {
            error:
              "PDF text could not be extracted. Use a text PDF or upload the document as an image.",
            uploadId: upload.id,
          },
          { status: 422 }
        );
      }

      if (openAiAvailable) {
        try {
          extractionResult = await extractBookkeepingFromText({
            text: rawText,
            fileName: file.name,
            mimeType: fileType,
          });
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? error.message
              : "AI extraction failed; using local fallback for PDF text."
          );
        }
      }

      if (!extractionResult) {
        extractionResult = {
          extraction: buildFallbackBookkeepingExtraction(rawText, {
            fileName: file.name,
            rawText,
            warnings: openAiAvailable
              ? warnings
              : ["OPENAI_API_KEY is not configured. Using local PDF text heuristics."],
          }),
          metadata: {
            provider: openAiAvailable ? "heuristic-fallback" : "unavailable",
            model: null,
            warnings,
            fileName: file.name,
            mimeType: fileType,
          },
          rawResponse: null,
        };
      }
    } else {
      if (!openAiAvailable) {
        await prisma.bookkeepingUpload.update({
          where: { id: upload.id },
          data: {
            status: "FAILED",
            failureReason:
              "OPENAI_API_KEY is not configured. Image extraction is unavailable without AI OCR.",
            reviewedAt: new Date(),
          },
        });

        return NextResponse.json(
          {
            error:
              "OPENAI_API_KEY is not configured. Image extraction is unavailable in this environment.",
            uploadId: upload.id,
          },
          { status: 503 }
        );
      }

      const dataUrl = `data:${fileType};base64,${buffer.toString("base64")}`;
      extractionResult = await extractBookkeepingFromImage({
        dataUrl,
        fileName: file.name,
        mimeType: fileType,
      });
      rawText = extractionResult.extraction.rawText;
    }

    const extraction = extractionResult.extraction;
    const storedAmounts = buildStoredDraftAmounts(extraction);
    const vendorId = matchExistingVendorId(clientBusiness.vendors, extraction.vendorName);
    const categoryId = matchExistingCategoryId(
      clientBusiness.categories,
      extraction.suggestedCategory
    );
    const sourceType = deriveUploadSourceType(extraction.documentType);

    const draftPayload = {
      documentType: extraction.documentType,
      vendorName: extraction.vendorName,
      amount: extraction.amount,
      taxAmount: extraction.taxAmount,
      taxRate: extraction.taxRate,
      currency: extraction.currency,
      transactionDate: extraction.transactionDate,
      description: extraction.description,
      suggestedCategory: extraction.suggestedCategory,
      suggestedType: extraction.suggestedType,
      vatTreatment: extraction.vatTreatment,
      whtTreatment: extraction.whtTreatment,
      confidenceScore: extraction.confidenceScore,
      rawText: extraction.rawText,
      notes: extraction.notes,
      metadata: extractionResult.metadata,
    };

    await prisma.$transaction(async (tx) => {
      await tx.bookkeepingUpload.update({
        where: { id: upload.id },
        data: {
          sourceType,
          status: "READY_FOR_REVIEW",
          rawText: rawText,
          aiPayload: JSON.stringify({
            extraction,
            metadata: extractionResult.metadata,
            rawResponse: extractionResult.rawResponse,
          }),
          reviewNotes:
            extraction.notes.length > 0 ? extraction.notes.join("\n") : warnings.join("\n") || null,
          failureReason: null,
        },
      });

      await tx.bookkeepingDraft.create({
        data: {
          uploadId: upload.id,
          vendorId,
          categoryId,
          proposedDate: extraction.transactionDate ? new Date(extraction.transactionDate) : null,
          description: extraction.description,
          reference: file.name || null,
          vendorName: extraction.vendorName,
          suggestedCategoryName: extraction.suggestedCategory,
          direction: deriveLedgerDirection(extraction.suggestedType),
          amountMinor: storedAmounts.amountMinor,
          taxAmountMinor: storedAmounts.taxAmountMinor,
          taxRate: extraction.taxRate,
          currency: extraction.currency,
          vatAmountMinor: storedAmounts.vatAmountMinor,
          whtAmountMinor: storedAmounts.whtAmountMinor,
          vatTreatment: extraction.vatTreatment,
          whtTreatment: extraction.whtTreatment,
          confidence: extraction.confidenceScore,
          reviewStatus: "PENDING",
          aiPayload: JSON.stringify(draftPayload),
        },
      });
    });

    await logAudit({
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      action: "BOOKKEEPING_UPLOAD_EXTRACTED",
      metadata: {
        uploadId: upload.id,
        clientBusinessId,
        fileName: file.name,
        fileType,
        provider: extractionResult.metadata.provider,
        documentType: extraction.documentType,
        suggestedType: extraction.suggestedType,
      },
    });

    const hydratedUpload = await getWorkspaceBookkeepingReviewUpload(
      ctx.workspaceId,
      upload.id
    );

    return NextResponse.json({
      upload: hydratedUpload,
      uploadId: upload.id,
      status: hydratedUpload?.status ?? "READY_FOR_REVIEW",
    });
  } catch (error) {
    if (uploadId) {
      await prisma.bookkeepingUpload.update({
        where: { id: uploadId },
        data: {
          status: "FAILED",
          failureReason:
            error instanceof Error ? error.message : "Bookkeeping extraction failed",
          reviewedAt: new Date(),
        },
      });
    }

    logRouteError("bookkeeping extract failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      uploadId,
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Bookkeeping extraction failed",
      },
      { status: 500 }
    );
  }
}
