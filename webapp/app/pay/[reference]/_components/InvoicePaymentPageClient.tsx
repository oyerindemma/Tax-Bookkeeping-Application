"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  invoiceNumber: string;
  initialStatus: "DRAFT" | "SENT" | "PAID" | "OVERDUE";
  initialPaidAt: string | null;
  paymentReference: string;
  canSimulate: boolean;
};

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function InvoicePaymentPageClient({
  invoiceNumber,
  initialStatus,
  initialPaidAt,
  paymentReference,
  canSimulate,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [paidAt, setPaidAt] = useState(initialPaidAt);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleConfirmPayment() {
    setConfirming(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const res = await fetch("/api/payments/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "payment.confirmed",
          reference: paymentReference,
          provider: "stub",
          paidAt: now,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Unable to confirm payment");
        return;
      }

      setStatus("PAID");
      setPaidAt(now);
    } catch {
      setError("Network error confirming payment");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Payment status</span>
          <Badge variant={status === "PAID" ? "secondary" : "outline"}>{status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Invoice {invoiceNumber} is linked to payment reference {paymentReference}.
        </p>
      </div>

      {paidAt && (
        <p className="text-sm text-muted-foreground">
          Payment recorded on {formatDate(paidAt)}.
        </p>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {status !== "PAID" && canSimulate ? (
        <div className="space-y-2">
          <Button onClick={handleConfirmPayment} disabled={confirming}>
            {confirming ? "Confirming..." : "Simulate payment confirmation"}
          </Button>
          <p className="text-xs text-muted-foreground">
            This beta page simulates a provider callback by posting to the generic payment
            webhook.
          </p>
        </div>
      ) : status !== "PAID" ? (
        <p className="text-sm text-muted-foreground">
          Payment provider checkout is not connected on this environment yet. A provider can
          confirm payment through the webhook using this reference.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Payment has been confirmed and the invoice is now closed.
        </p>
      )}
    </section>
  );
}
