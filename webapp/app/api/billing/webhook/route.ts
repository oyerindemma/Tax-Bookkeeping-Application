import { NextResponse } from "next/server";
import type { PaystackSubscriptionPayload, PaystackTransactionVerificationData } from "@/src/lib/paystack";
import {
  beginPaystackWebhookEvent,
  markBillingWebhookEventFailed,
  markBillingWebhookEventProcessed,
} from "@/src/lib/billing-webhooks";
import {
  attachTraceId,
  buildTraceErrorPayload,
  createRouteLogger,
} from "@/src/lib/observability";
import { verifyPaystackSignature } from "@/src/lib/paystack";
import {
  markWorkspaceSubscriptionStatusFromPaystackEvent,
  parseBillingMetadata,
  syncWorkspaceSubscriptionFromPaystackSubscription,
  syncWorkspaceSubscriptionFromPaystackTransaction,
} from "@/src/lib/paystack-billing";

export const runtime = "nodejs";

type PaystackWebhookEvent = {
  event?: unknown;
  data?: unknown;
};

export async function POST(req: Request) {
  const logger = createRouteLogger("/api/billing/webhook", req);
  const signature = req.headers.get("x-paystack-signature");
  const rawBody = await req.text();

  if (!verifyPaystackSignature(rawBody, signature)) {
    logger.warn("signature verification failed");
    return attachTraceId(
      NextResponse.json(buildTraceErrorPayload("Invalid signature", logger.traceId), {
        status: 401,
      }),
      logger.traceId
    );
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    logger.warn("invalid json payload");
    return attachTraceId(
      NextResponse.json(buildTraceErrorPayload("Invalid payload", logger.traceId), {
        status: 400,
      }),
      logger.traceId
    );
  }

  const eventType = String(event.event ?? "").trim().toLowerCase();
  const webhookEvent = await beginPaystackWebhookEvent({
    eventType: eventType || "unknown",
    rawBody,
    data: event.data,
  });

  if (webhookEvent.shouldSkip) {
    logger.info("duplicate delivery skipped", {
      eventType: eventType || "unknown",
      webhookEventId: webhookEvent.event.id,
      reason: webhookEvent.reason,
    });
    return attachTraceId(
      NextResponse.json({
        received: true,
        duplicate: true,
        eventType: eventType || "unknown",
      }),
      logger.traceId
    );
  }

  let resolvedWorkspaceId: number | null = webhookEvent.event.workspaceId ?? null;

  try {
    switch (eventType) {
      case "charge.success": {
        const transaction = event.data as PaystackTransactionVerificationData;
        const synced = await syncWorkspaceSubscriptionFromPaystackTransaction(
          transaction,
          parseBillingMetadata(transaction.metadata).plan ?? null
        );
        resolvedWorkspaceId = synced?.workspaceId ?? resolvedWorkspaceId;
        break;
      }
      case "subscription.create": {
        const synced = await syncWorkspaceSubscriptionFromPaystackSubscription(
          event.data as PaystackSubscriptionPayload,
          { statusHint: "active" }
        );
        resolvedWorkspaceId = synced?.workspaceId ?? resolvedWorkspaceId;
        break;
      }
      case "subscription.enable": {
        const synced = await syncWorkspaceSubscriptionFromPaystackSubscription(
          event.data as PaystackSubscriptionPayload,
          { statusHint: "active" }
        );
        resolvedWorkspaceId = synced?.workspaceId ?? resolvedWorkspaceId;
        break;
      }
      case "subscription.not_renew": {
        const synced = await syncWorkspaceSubscriptionFromPaystackSubscription(
          event.data as PaystackSubscriptionPayload,
          { statusHint: "non_renewing" }
        );
        resolvedWorkspaceId = synced?.workspaceId ?? resolvedWorkspaceId;
        break;
      }
      case "subscription.disable": {
        const synced = await syncWorkspaceSubscriptionFromPaystackSubscription(
          event.data as PaystackSubscriptionPayload,
          { statusHint: "disabled" }
        );
        resolvedWorkspaceId = synced?.workspaceId ?? resolvedWorkspaceId;
        break;
      }
      case "invoice.payment_failed":
      case "charge.failed": {
        const synced = await markWorkspaceSubscriptionStatusFromPaystackEvent(
          event.data,
          "payment_failed"
        );
        resolvedWorkspaceId = synced?.workspaceId ?? resolvedWorkspaceId;
        break;
      }
      default:
        break;
    }

    await markBillingWebhookEventProcessed(
      webhookEvent.event.id,
      resolvedWorkspaceId ?? undefined
    );
    logger.info("webhook processed", {
      eventType: eventType || "unknown",
      webhookEventId: webhookEvent.event.id,
      workspaceId: resolvedWorkspaceId,
      duplicate: webhookEvent.duplicate,
    });
  } catch (error) {
    await markBillingWebhookEventFailed(
      webhookEvent.event.id,
      error,
      resolvedWorkspaceId ?? undefined
    );
    logger.error("event handling failed", error, {
      eventType: eventType || "unknown",
      webhookEventId: webhookEvent.event.id,
      workspaceId: resolvedWorkspaceId,
    });
    return attachTraceId(
      NextResponse.json(buildTraceErrorPayload("Webhook handler failed", logger.traceId), {
        status: 500,
      }),
      logger.traceId
    );
  }

  return attachTraceId(
    NextResponse.json({
      received: true,
      eventType: eventType || "unknown",
    }),
    logger.traceId
  );
}
