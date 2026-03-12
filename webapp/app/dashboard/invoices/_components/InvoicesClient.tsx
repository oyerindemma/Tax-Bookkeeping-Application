"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

type Invoice = {
  id: number;
  invoiceNumber: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE";
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  client: { id: number; name: string; companyName: string | null };
};

type Props = {
  role: Role;
};

function formatAmount(amountKobo: number) {
  return `NGN ${(amountKobo / 100).toFixed(2)}`;
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

export default function InvoicesClient({ role }: Props) {
  const canEdit = role === "OWNER" || role === "ADMIN" || role === "MEMBER";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadInvoices() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/invoices", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Unable to load invoices");
        }
        if (mounted) {
          setInvoices(Array.isArray(data?.invoices) ? data.invoices : []);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        if (mounted) setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadInvoices();
    return () => {
      mounted = false;
    };
  }, []);

  async function updateStatus(invoiceId: number, status: Invoice["status"]) {
    if (!canEdit) return;
    setUpdatingId(invoiceId);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Unable to update invoice");
      }

      setInvoices((prev) =>
        prev.map((invoice) =>
          invoice.id === invoiceId ? { ...invoice, status } : invoice
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  }

  const totalOutstanding = useMemo(() => {
    return invoices
      .filter((invoice) => invoice.status !== "PAID")
      .reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  }, [invoices]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-muted-foreground">
            Track client billing and payment status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button asChild>
              <Link href="/dashboard/invoices/new">New invoice</Link>
            </Button>
          ) : (
            <Button disabled>New invoice</Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total invoices</CardDescription>
            <CardTitle className="text-xl">{invoices.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding balance</CardDescription>
            <CardTitle className="text-xl">{formatAmount(totalOutstanding)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid invoices</CardDescription>
            <CardTitle className="text-xl">
              {invoices.filter((invoice) => invoice.status === "PAID").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoice list</CardTitle>
          <CardDescription>Recent invoices for this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading invoices...</p>
          ) : invoices.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
              {canEdit && (
                <p className="text-xs text-muted-foreground">
                  Create your first invoice to start billing clients.
                </p>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-3 font-medium">Invoice</th>
                  <th className="pb-3 font-medium">Client</th>
                  <th className="pb-3 font-medium">Issue</th>
                  <th className="pb-3 font-medium">Due</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Status</th>
                  {canEdit && <th className="pb-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b last:border-b-0">
                    <td className="py-3">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-3">
                      {invoice.client ? (
                        <Link
                          href={`/dashboard/clients/${invoice.client.id}`}
                          className="hover:underline"
                        >
                          {invoice.client.companyName ?? invoice.client.name}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3">
                      {new Date(invoice.issueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3">{formatAmount(invoice.totalAmount)}</td>
                    <td className="py-3">
                      <Badge variant={statusVariant(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </td>
                    {canEdit && (
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {invoice.status !== "PAID" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updatingId === invoice.id}
                              onClick={() => updateStatus(invoice.id, "PAID")}
                            >
                              Mark paid
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={updatingId === invoice.id}
                              onClick={() => updateStatus(invoice.id, "SENT")}
                            >
                              Mark unpaid
                            </Button>
                          )}
                          {invoice.status === "DRAFT" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={updatingId === invoice.id}
                              onClick={() => updateStatus(invoice.id, "SENT")}
                            >
                              Mark sent
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
