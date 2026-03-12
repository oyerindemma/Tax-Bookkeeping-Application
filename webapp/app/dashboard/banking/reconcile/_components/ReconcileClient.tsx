"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

type InvoiceSuggestion = {
  id: number;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  clientName: string | null;
};

type TaxSuggestion = {
  id: number;
  kind: string;
  amountKobo: number;
  occurredOn: string;
  description: string | null;
};

type Transaction = {
  id: number;
  transactionDate: string;
  description: string;
  reference: string | null;
  amount: number;
  type: "CREDIT" | "DEBIT";
  status: "UNMATCHED" | "MATCHED" | "IGNORED";
  bankAccount: { name: string; currency: string };
  suggestions: {
    invoices: InvoiceSuggestion[];
    taxRecords: TaxSuggestion[];
  };
};

type Props = {
  role: Role;
};

function formatAmount(amountKobo: number, currency: string) {
  return `${currency} ${(amountKobo / 100).toFixed(2)}`;
}

export default function ReconcileClient({ role }: Props) {
  const canEdit = role === "OWNER" || role === "ADMIN" || role === "MEMBER";
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualInvoice, setManualInvoice] = useState<Record<number, string>>({});
  const [manualTaxRecord, setManualTaxRecord] = useState<Record<number, string>>({});

  async function loadTransactions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/banking/transactions?status=UNMATCHED", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to load transactions");
      }
      setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  async function reconcileTransaction(payload: {
    transactionId: number;
    status: "MATCHED" | "IGNORED" | "UNMATCHED";
    invoiceId?: number;
    taxRecordId?: number;
    matchType?: string;
  }) {
    if (!canEdit) return;
    try {
      const res = await fetch("/api/banking/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to reconcile");
      }
      await loadTransactions();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setError(message);
    }
  }

  function manualMatch(transactionId: number) {
    const invoiceId = Number(manualInvoice[transactionId]);
    const taxRecordId = Number(manualTaxRecord[transactionId]);
    const validInvoiceId = Number.isFinite(invoiceId) && invoiceId > 0;
    const validTaxRecordId = Number.isFinite(taxRecordId) && taxRecordId > 0;

    if (!validInvoiceId && !validTaxRecordId) {
      setError("Provide an invoice ID or tax record ID.");
      return;
    }

    reconcileTransaction({
      transactionId,
      status: "MATCHED",
      invoiceId: validInvoiceId ? invoiceId : undefined,
      taxRecordId: validTaxRecordId ? taxRecordId : undefined,
      matchType: "MANUAL",
    });
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Reconcile</h1>
        <p className="text-muted-foreground">
          Match bank transactions to invoices or tax records.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Unmatched transactions</CardTitle>
          <CardDescription>Suggestions are based on amount and type.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unmatched transactions.</p>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{transaction.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(transaction.transactionDate).toLocaleDateString()} ·
                      {" "}
                      {transaction.bankAccount?.name}
                    </div>
                    {transaction.reference && (
                      <div className="text-xs text-muted-foreground">
                        Ref: {transaction.reference}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold">
                      {formatAmount(
                        transaction.amount,
                        transaction.bankAccount?.currency ?? "NGN"
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{transaction.type}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Invoice suggestions</div>
                    {transaction.suggestions.invoices.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No invoice matches.</p>
                    ) : (
                      <div className="space-y-2">
                        {transaction.suggestions.invoices.map((invoice) => (
                          <div
                            key={invoice.id}
                            className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                          >
                            <div>
                              <div className="font-medium">{invoice.invoiceNumber}</div>
                              <div className="text-xs text-muted-foreground">
                                {invoice.clientName ?? "Client"} · {invoice.status}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canEdit}
                              onClick={() =>
                                reconcileTransaction({
                                  transactionId: transaction.id,
                                  status: "MATCHED",
                                  invoiceId: invoice.id,
                                  matchType: "INVOICE",
                                })
                              }
                            >
                              Match
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Tax record suggestions</div>
                    {transaction.suggestions.taxRecords.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No tax record matches.</p>
                    ) : (
                      <div className="space-y-2">
                        {transaction.suggestions.taxRecords.map((record) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                          >
                            <div>
                              <div className="font-medium">{record.description ?? "Tax record"}</div>
                              <div className="text-xs text-muted-foreground">
                                {record.kind} · {new Date(record.occurredOn).toLocaleDateString()}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canEdit}
                              onClick={() =>
                                reconcileTransaction({
                                  transactionId: transaction.id,
                                  status: "MATCHED",
                                  taxRecordId: record.id,
                                  matchType: "TAX_RECORD",
                                })
                              }
                            >
                              Match
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor={`invoice-${transaction.id}`}>Manual invoice ID</Label>
                    <Input
                      id={`invoice-${transaction.id}`}
                      value={manualInvoice[transaction.id] ?? ""}
                      onChange={(event) =>
                        setManualInvoice((prev) => ({
                          ...prev,
                          [transaction.id]: event.target.value,
                        }))
                      }
                      disabled={!canEdit}
                      placeholder="e.g. 12"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`tax-${transaction.id}`}>Manual tax record ID</Label>
                    <Input
                      id={`tax-${transaction.id}`}
                      value={manualTaxRecord[transaction.id] ?? ""}
                      onChange={(event) =>
                        setManualTaxRecord((prev) => ({
                          ...prev,
                          [transaction.id]: event.target.value,
                        }))
                      }
                      disabled={!canEdit}
                      placeholder="e.g. 45"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => manualMatch(transaction.id)}
                      disabled={!canEdit}
                    >
                      Manual match
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        reconcileTransaction({
                          transactionId: transaction.id,
                          status: "IGNORED",
                        })
                      }
                      disabled={!canEdit}
                    >
                      Ignore
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
