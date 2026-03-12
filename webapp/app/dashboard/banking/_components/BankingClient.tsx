"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

type BankAccount = {
  id: number;
  name: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  createdAt: string;
};

type Transaction = {
  id: number;
  transactionDate: string;
  description: string;
  reference: string | null;
  amount: number;
  type: "CREDIT" | "DEBIT";
  status: "UNMATCHED" | "MATCHED" | "IGNORED";
  bankAccount: BankAccount;
  match?: {
    id: number;
    invoiceId: number | null;
    taxRecordId: number | null;
    matchType: string;
  } | null;
};

type Props = {
  role: Role;
};

function formatAmount(amountKobo: number, currency: string) {
  return `${currency} ${(amountKobo / 100).toFixed(2)}`;
}

function statusVariant(status: Transaction["status"]) {
  switch (status) {
    case "MATCHED":
      return "secondary" as const;
    case "IGNORED":
      return "outline" as const;
    default:
      return "default" as const;
  }
}

export default function BankingClient({ role }: Props) {
  const canEdit = role === "OWNER" || role === "ADMIN" || role === "MEMBER";
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [saving, setSaving] = useState(false);

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [accountsRes, txRes] = await Promise.all([
        fetch("/api/banking/accounts", { cache: "no-store" }),
        fetch("/api/banking/transactions", { cache: "no-store" }),
      ]);

      const accountsData = await accountsRes.json();
      const txData = await txRes.json();

      if (!accountsRes.ok) {
        throw new Error(accountsData?.error ?? "Failed to load accounts");
      }
      if (!txRes.ok) {
        throw new Error(txData?.error ?? "Failed to load transactions");
      }

      setAccounts(Array.isArray(accountsData?.accounts) ? accountsData.accounts : []);
      setTransactions(Array.isArray(txData?.transactions) ? txData.transactions : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateAccount() {
    if (!canEdit) return;
    setImportMessage(null);
    if (!name.trim() || !bankName.trim() || !accountNumber.trim()) {
      setError("Name, bank name, and account number are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/banking/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bankName, accountNumber, currency }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to create account");
        return;
      }

      setAccounts((prev) => [data.account, ...prev]);
      setName("");
      setBankName("");
      setAccountNumber("");
      setCurrency("NGN");
    } catch {
      setError("Network error creating account");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    if (!canEdit) return;
    if (!selectedAccountId) {
      setImportMessage("Select a bank account.");
      return;
    }
    if (!file) {
      setImportMessage("Choose a CSV file.");
      return;
    }

    setImporting(true);
    setImportMessage(null);
    try {
      const formData = new FormData();
      formData.append("bankAccountId", selectedAccountId);
      formData.append("file", file);

      const res = await fetch("/api/banking/transactions/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data?.error ?? "Failed to import";
        setImportMessage(errorMsg);
        return;
      }

      setImportMessage(`Imported ${data.inserted ?? 0} transactions.`);
      setFile(null);
      await loadData();
    } catch {
      setImportMessage("Network error importing transactions");
    } finally {
      setImporting(false);
    }
  }

  async function updateTransactionStatus(transactionId: number, status: "UNMATCHED" | "IGNORED") {
    if (!canEdit) return;
    try {
      await fetch("/api/banking/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, status }),
      });
      await loadData();
    } catch {
      setError("Failed to update transaction status");
    }
  }

  const totalCredits = useMemo(
    () => transactions.filter((t) => t.type === "CREDIT").length,
    [transactions]
  );
  const totalDebits = useMemo(
    () => transactions.filter((t) => t.type === "DEBIT").length,
    [transactions]
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Banking</h1>
          <p className="text-muted-foreground">
            Import statements and reconcile transactions.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/banking/reconcile">Reconcile</Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total transactions</CardDescription>
            <CardTitle className="text-xl">{transactions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Credits</CardDescription>
            <CardTitle className="text-xl">{totalCredits}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Debits</CardDescription>
            <CardTitle className="text-xl">{totalDebits}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bank accounts</CardTitle>
          <CardDescription>Add the bank accounts you want to import.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canEdit && (
            <p className="text-sm text-muted-foreground">View-only access.</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="account-name">Account name</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canEdit}
                placeholder="Operating account"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bank-name">Bank</Label>
              <Input
                id="bank-name"
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
                disabled={!canEdit}
                placeholder="GT Bank"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="account-number">Account number</Label>
              <Input
                id="account-number"
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
          <Button type="button" onClick={handleCreateAccount} disabled={!canEdit || saving}>
            {saving ? "Saving..." : "Save account"}
          </Button>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts added yet.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-wrap items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{account.name}</div>
                    <div className="text-muted-foreground">
                      {account.bankName} · {account.accountNumber} · {account.currency}
                    </div>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import statement</CardTitle>
          <CardDescription>Upload a CSV bank statement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 max-w-md">
            <Label htmlFor="bank-account">Bank account</Label>
            <select
              id="bank-account"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              disabled={!canEdit}
            >
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 max-w-md">
            <Label htmlFor="bank-file">CSV file</Label>
            <Input
              id="bank-file"
              type="file"
              accept=".csv"
              disabled={!canEdit}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          {importMessage && (
            <p className="text-sm text-muted-foreground">{importMessage}</p>
          )}
          <Button type="button" onClick={handleImport} disabled={!canEdit || importing}>
            {importing ? "Importing..." : "Import CSV"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>Imported transactions across accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions imported yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Account</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b last:border-b-0">
                    <td className="py-3">
                      {new Date(transaction.transactionDate).toLocaleDateString()}
                    </td>
                    <td className="py-3">{transaction.bankAccount?.name ?? "-"}</td>
                    <td className="py-3">
                      <div className="font-medium">{transaction.description}</div>
                      {transaction.reference && (
                        <div className="text-xs text-muted-foreground">
                          Ref: {transaction.reference}
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      {formatAmount(
                        transaction.amount,
                        transaction.bankAccount?.currency ?? "NGN"
                      )}
                    </td>
                    <td className="py-3">{transaction.type}</td>
                    <td className="py-3">
                      <Badge variant={statusVariant(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href="/dashboard/banking/reconcile">Reconcile</Link>
                        </Button>
                        {canEdit && transaction.status === "UNMATCHED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateTransactionStatus(transaction.id, "IGNORED")}
                          >
                            Ignore
                          </Button>
                        )}
                        {canEdit && transaction.status === "MATCHED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateTransactionStatus(transaction.id, "UNMATCHED")}
                          >
                            Unmatch
                          </Button>
                        )}
                      </div>
                    </td>
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
