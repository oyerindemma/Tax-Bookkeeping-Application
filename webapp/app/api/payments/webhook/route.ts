import { NextResponse } from "next/server";
import { getPaymentRuntimeConfig } from "@/src/lib/env";
import { confirmInvoicePaymentByReference } from "@/src/lib/invoice-payments";
import { logRouteError } from "@/src/lib/logger";

export const runtime = "nodejs";

type PaymentWebhookBody = {
  eventType?: unknown;
  reference?: unknown;
  provider?: unknown;
  paidAt?: unknown;
  amountKobo?: unknown;
  eventId?: unknown;
};

function parseNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(req: Request) {
  const { webhookSecret: configuredSecret } = getPaymentRuntimeConfig();
  if (configuredSecret) {
    const providedSecret = req.headers.get("x-payment-webhook-secret");
    if (providedSecret !== configuredSecret) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }
  }

  try {
    const body = (await req.json()) as PaymentWebhookBody;
    const eventType = String(body.eventType ?? "").trim().toLowerCase();
    if (eventType !== "payment.confirmed") {
      return NextResponse.json(
        { error: "Unsupported payment event" },
        { status: 400 }
      );
    }

    const reference = String(body.reference ?? "").trim();
    if (!reference) {
      return NextResponse.json({ error: "reference is required" }, { status: 400 });
    }

    const paidAtInput =
      typeof body.paidAt === "string" && body.paidAt.trim()
        ? new Date(body.paidAt)
        : new Date();
    if (Number.isNaN(paidAtInput.getTime())) {
      return NextResponse.json({ error: "Invalid paidAt" }, { status: 400 });
    }

    const amountKobo = parseNumber(body.amountKobo);
    if (body.amountKobo !== undefined && amountKobo === null) {
      return NextResponse.json({ error: "Invalid amountKobo" }, { status: 400 });
    }

    const confirmed = await confirmInvoicePaymentByReference({
      paymentReference: reference,
      provider:
        typeof body.provider === "string" && body.provider.trim()
          ? body.provider.trim()
          : "stub",
      paidAt: paidAtInput,
      amountKobo,
      eventId:
        typeof body.eventId === "string" && body.eventId.trim()
          ? body.eventId.trim()
          : null,
    });

    if ("error" in confirmed) {
      const status =
        confirmed.error === "Invoice not found"
          ? 404
          : confirmed.error === "Payment amount does not match invoice total"
            ? 400
            : 500;
      return NextResponse.json({ error: confirmed.error }, { status });
    }

    return NextResponse.json({
      received: true,
      invoiceId: confirmed.invoice.id,
      status: confirmed.invoice.status,
      alreadyProcessed: confirmed.alreadyPaid,
    });
  } catch (error) {
    logRouteError("payments webhook failed", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
