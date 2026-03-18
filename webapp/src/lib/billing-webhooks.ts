import "server-only";

import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { parseBillingMetadata } from "@/src/lib/paystack-billing";

const WEBHOOK_PROCESSING_STALE_MS = 5 * 60 * 1000;

function parseString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hashPayload(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function extractEventIdentifiers(data: unknown) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const nestedSubscription =
    record.subscription && typeof record.subscription === "object"
      ? (record.subscription as Record<string, unknown>)
      : null;
  const nestedCustomer =
    record.customer && typeof record.customer === "object"
      ? (record.customer as Record<string, unknown>)
      : null;

  const metadata = parseBillingMetadata(record.metadata ?? nestedSubscription?.metadata);

  return {
    workspaceId: metadata.workspaceId ?? null,
    reference: parseString(record.reference),
    subscriptionCode:
      parseString(record.subscription_code) ??
      parseString(nestedSubscription?.subscription_code),
    customerCode:
      parseString(record.customer_code) ?? parseString(nestedCustomer?.customer_code),
  };
}

function buildEventKey(eventType: string, payloadHash: string) {
  return `paystack:${eventType}:${payloadHash}`;
}

function buildErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Unknown billing webhook error";
}

export async function beginPaystackWebhookEvent(input: {
  eventType: string;
  rawBody: string;
  data: unknown;
}) {
  const payloadHash = hashPayload(input.rawBody);
  const identifiers = extractEventIdentifiers(input.data);
  const eventKey = buildEventKey(input.eventType, payloadHash);
  const baseData = {
    provider: "PAYSTACK",
    workspaceId: identifiers.workspaceId ?? undefined,
    eventType: input.eventType,
    eventKey,
    payloadHash,
    reference: identifiers.reference ?? undefined,
    subscriptionCode: identifiers.subscriptionCode ?? undefined,
    customerCode: identifiers.customerCode ?? undefined,
    status: "PROCESSING",
    payload: input.rawBody,
    lastError: null,
    processedAt: null,
  } satisfies Prisma.BillingWebhookEventUncheckedCreateInput;

  try {
    const event = await prisma.billingWebhookEvent.create({
      data: baseData,
    });

    return {
      event,
      duplicate: false,
      shouldSkip: false,
      reason: null as "processed" | "in_flight" | null,
    };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }

    const existing = await prisma.billingWebhookEvent.findUnique({
      where: { eventKey },
    });

    if (!existing) {
      throw error;
    }

    if (existing.status === "PROCESSED") {
      return {
        event: existing,
        duplicate: true,
        shouldSkip: true,
        reason: "processed" as const,
      };
    }

    const isFreshProcessingAttempt =
      existing.status === "PROCESSING" &&
      Date.now() - existing.updatedAt.getTime() < WEBHOOK_PROCESSING_STALE_MS;

    if (isFreshProcessingAttempt) {
      return {
        event: existing,
        duplicate: true,
        shouldSkip: true,
        reason: "in_flight" as const,
      };
    }

    const event = await prisma.billingWebhookEvent.update({
      where: { eventKey },
      data: {
        workspaceId: existing.workspaceId ?? identifiers.workspaceId ?? undefined,
        reference: existing.reference ?? identifiers.reference ?? undefined,
        subscriptionCode: existing.subscriptionCode ?? identifiers.subscriptionCode ?? undefined,
        customerCode: existing.customerCode ?? identifiers.customerCode ?? undefined,
        status: "PROCESSING",
        payload: input.rawBody,
        lastError: null,
        processedAt: null,
      },
    });

    return {
      event,
      duplicate: true,
      shouldSkip: false,
      reason: null as "processed" | "in_flight" | null,
    };
  }
}

export async function markBillingWebhookEventProcessed(
  eventId: number,
  workspaceId?: number | null
) {
  return prisma.billingWebhookEvent.update({
    where: { id: eventId },
    data: {
      workspaceId: workspaceId ?? undefined,
      status: "PROCESSED",
      processedAt: new Date(),
      lastError: null,
    },
  });
}

export async function markBillingWebhookEventFailed(
  eventId: number,
  error: unknown,
  workspaceId?: number | null
) {
  return prisma.billingWebhookEvent.update({
    where: { id: eventId },
    data: {
      workspaceId: workspaceId ?? undefined,
      status: "FAILED",
      lastError: buildErrorMessage(error),
    },
  });
}
export async function handlePaystackEvent(event: any) {
  const eventType = event.event;
  const data = event.data;

  const rawBody = JSON.stringify(event);

  try {
    await beginPaystackWebhookEvent({
      eventType,
      rawBody,
      data,
    });
  } catch (error) {
    console.error("Webhook handling failed:", error);
    throw error;
  }
}