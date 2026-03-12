"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

type InvoiceItem = {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
};

type Invoice = {
  id: number;
  invoiceNumber: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE";
  paymentReference: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  client: {
    id: number;
    name: string;
    companyName: string | null;
    email: string;
    phone: string | null;
    address: string | null;
  } | null;
  items: InvoiceItem[];
};

type Props = {
  invoiceId: number;
  role: Role;
};

function formatAmount(amountKobo: number) {
  return `NGN ${(amountKobo / 100).toFixed(2)}`;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function statusVariant(status: Invoice["status"]) {
  switch (status) {
    case "PAID":
      return "secondary" as const;
    case "SENT":
      return "outline" as const;
    case "OVERDUE":
      return "destructive" as const;
    default:
      return "default" as const;
  }
}

export default function InvoiceDetailClient({ invoiceId, role }: Props) {
  const canEdit = role === "OWNER" || role === "ADMIN" || role === "MEMBER";
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadInvoice() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/invoices/${invoiceId}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Unable to load invoice");
        }
        if (mounted) {
          setInvoice(data?.invoice ?? null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        if (mounted) setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadInvoice();
    return () => {
      mounted = false;
    };
  }, [invoiceId]);

  async function updateStatus(status: Invoice["status"]) {
    if (!canEdit || !invoice) return;
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Unable to update invoice");
      }
      setInvoice(data?.invoice ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setError(message);
    } finally {
      setUpdating(false);
    }
  }

  async function createPaymentLink() {
    if (!canEdit || !invoice) return;
    setCreatingPaymentLink(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payment-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Unable to create payment link");
      }
      setInvoice(data?.invoice ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setError(message);
    } finally {
      setCreatingPaymentLink(false);
    }
  }

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading invoice...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unable to load invoice</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!invoice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice not found</CardTitle>
          <CardDescription>The invoice might have been removed.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">Invoice {invoice.invoiceNumber}</h1>
            <Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge>
          </div>
          <p className="text-muted-foreground">
            Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)}
          </p>
          {invoice.paidAt && (
            <p className="text-sm text-muted-foreground">
              Paid {formatDate(invoice.paidAt)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2" data-print-hide="true">
          {invoice.status !== "PAID" && invoice.paymentUrl && (
            <Button variant="default" asChild>
              <a href={invoice.paymentUrl} target="_blank" rel="noreferrer">
                Open payment link
              </a>
            </Button>
          )}
          {canEdit && invoice.status !== "PAID" && !invoice.paymentUrl && (
            <Button
              variant="default"
              disabled={creatingPaymentLink}
              onClick={createPaymentLink}
            >
              {creatingPaymentLink ? "Creating link..." : "Create payment link"}
            </Button>
          )}
          {canEdit && invoice.status !== "PAID" && (
            <Button
              variant="outline"
              disabled={updating}
              onClick={() => updateStatus("PAID")}
            >
              Mark paid
            </Button>
          )}
          {canEdit && invoice.status === "PAID" && (
            <Button
              variant="ghost"
              disabled={updating}
              onClick={() => updateStatus("SENT")}
            >
              Mark unpaid
            </Button>
          )}
          {canEdit && invoice.status === "DRAFT" && (
            <Button
              variant="ghost"
              disabled={updating}
              onClick={() => updateStatus("SENT")}
            >
              Mark sent
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint}>
            Print / PDF
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/invoices">Back to invoices</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
            <CardDescription>Billing information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-medium text-base">
              {invoice.client ? (
                <Link
                  href={`/dashboard/clients/${invoice.client.id}`}
                  className="text-primary hover:underline"
                >
                  {invoice.client.companyName ?? invoice.client.name}
                </Link>
              ) : (
                "Client"
              )}
            </div>
            {invoice.client?.companyName &&
              invoice.client.name !== invoice.client.companyName && (
                <div className="text-muted-foreground">{invoice.client.name}</div>
              )}
            <div className="text-muted-foreground">{invoice.client?.email ?? ""}</div>
            {invoice.client?.phone && (
              <div className="text-muted-foreground">{invoice.client.phone}</div>
            )}
            {invoice.client?.address && (
              <div className="text-muted-foreground whitespace-pre-line">
                {invoice.client.address}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice details</CardTitle>
            <CardDescription>Summary and totals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatAmount(invoice.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">{formatAmount(invoice.taxAmount)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total due</span>
              <span>{formatAmount(invoice.totalAmount)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
          <CardDescription>Share a payment link or track when funds arrive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Payment reference</span>
            <span className="font-medium">{invoice.paymentReference ?? "Not generated"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Paid at</span>
            <span className="font-medium">
              {invoice.paidAt ? formatDate(invoice.paidAt) : "Not paid yet"}
            </span>
          </div>
          {invoice.paymentUrl ? (
            <div className="space-y-2">
              <div className="text-muted-foreground">Hosted payment page</div>
              <a
                href={invoice.paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-primary hover:underline"
              >
                {invoice.paymentUrl}
              </a>
            </div>
          ) : invoice.status !== "PAID" ? (
            <p className="text-muted-foreground">
              Generate a payment link to give clients a provider-ready payment action.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Payment has been confirmed for this invoice.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice items</CardTitle>
          <CardDescription>Line items billed on this invoice.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoice.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line items recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Qty</th>
                  <th className="pb-3 font-medium">Unit price</th>
                  <th className="pb-3 font-medium">Tax</th>
                  <th className="pb-3 font-medium">Line total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="py-3">{item.description}</td>
                    <td className="py-3">{item.quantity}</td>
                    <td className="py-3">{formatAmount(item.unitPrice)}</td>
                    <td className="py-3">{item.taxRate}%</td>
                    <td className="py-3 font-medium">
                      {formatAmount(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Additional instructions or memo.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {invoice.notes?.trim() || "No notes added."}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
