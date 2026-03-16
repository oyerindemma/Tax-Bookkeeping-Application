import { NextResponse } from "next/server";
import { logRouteError } from "@/src/lib/logger";
import type { PaystackSubscriptionPayload, PaystackTransactionVerificationData } from "@/src/lib/paystack";
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
  const signature = req.headers.get("x-paystack-signature");
  const rawBody = await req.text();

  if (!verifyPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const eventType = String(event.event ?? "").trim().toLowerCase();
    switch (eventType) {
      case "charge.success": {
        const transaction = event.data as PaystackTransactionVerificationData;
        await syncWorkspaceSubscriptionFromPaystackTransaction(
          transaction,
          parseBillingMetadata(transaction.metadata).plan ?? null
        );
        break;
      }
      case "subscription.create": {
        await syncWorkspaceSubscriptionFromPaystackSubscription(
          event.data as PaystackSubscriptionPayload,
          { statusHint: "active" }
        );
        break;
      }
      case "subscription.enable": {
        await syncWorkspaceSubscriptionFromPaystackSubscription(
          event.data as PaystackSubscriptionPayload,
          { statusHint: "active" }
        );
        break;
      }
      case "subscription.not_renew": {
        await syncWorkspaceSubscriptionFromPaystackSubscription(
          event.data as PaystackSubscriptionPayload,
          { statusHint: "non_renewing" }
        );
        break;
      }
      case "subscription.disable": {
        await syncWorkspaceSubscriptionFromPaystackSubscription(
          event.data as PaystackSubscriptionPayload,
          { statusHint: "disabled" }
        );
        break;
      }
      case "invoice.payment_failed":
      case "charge.failed": {
        await markWorkspaceSubscriptionStatusFromPaystackEvent(
          event.data,
          "payment_failed"
        );
        break;
      }
      default:
        break;
    }
  } catch (error) {
    logRouteError("billing webhook event handling failed", error, {
      eventType: String(event.event ?? "unknown"),
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
