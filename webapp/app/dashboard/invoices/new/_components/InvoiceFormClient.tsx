"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

type Client = {
  id: number;
  name: string;
  companyName: string | null;
  displayName: string;
  email: string;
};

type LineItem = {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

type Props = {
  role: Role;
};

function formatAmount(amountKobo: number) {
  return `NGN ${(amountKobo / 100).toFixed(2)}`;
}

function toKobo(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export default function InvoiceFormClient({ role }: Props) {
  const router = useRouter();
  const canEdit = role === "OWNER" || role === "ADMIN" || role === "MEMBER";
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [useNewClient, setUseNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientCompanyName, setNewClientCompanyName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "SENT">("SENT");

  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "", taxRate: "0" },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadClients() {
      setLoadingClients(true);
      setClientError(null);
      try {
        const res = await fetch("/api/clients", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Unable to load clients");
        }
        if (mounted) {
          setClients(Array.isArray(data?.clients) ? data.clients : []);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        if (mounted) setClientError(message);
      } finally {
        if (mounted) setLoadingClients(false);
      }
    }

    loadClients();
    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;

    items.forEach((item) => {
      const quantity = Number(item.quantity);
      const unitPriceKobo = toKobo(item.unitPrice);
      const taxRate = Number(item.taxRate);
      if (!Number.isFinite(quantity) || quantity <= 0) return;
      if (unitPriceKobo === null) return;
      const lineSubtotal = quantity * unitPriceKobo;
      const lineTax = Math.round(lineSubtotal * (taxRate / 100));
      subtotal += lineSubtotal;
      taxAmount += lineTax;
    });

    return {
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount,
    };
  }, [items]);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { description: "", quantity: "1", unitPrice: "", taxRate: "0" },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function ensureClient(): Promise<number | null> {
    if (!canEdit) return null;

    if (!useNewClient) {
      const parsedId = Number(selectedClientId);
      if (!Number.isFinite(parsedId) || parsedId <= 0) {
        setError("Select a client.");
        return null;
      }
      return parsedId;
    }

    if (!newClientName.trim() && !newClientCompanyName.trim()) {
      setError("Primary name or company name is required.");
      return null;
    }

    if (!newClientEmail.trim()) {
      setError("Client email is required.");
      return null;
    }

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newClientName,
        companyName: newClientCompanyName,
        email: newClientEmail,
        phone: newClientPhone,
        address: newClientAddress,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "Unable to create client");
      return null;
    }

    setClients((prev) => [data.client, ...prev]);
    setSelectedClientId(String(data.client.id));
    setUseNewClient(false);
    setNewClientName("");
    setNewClientCompanyName("");
    setNewClientEmail("");
    setNewClientPhone("");
    setNewClientAddress("");
    return data.client.id;
  }

  async function handleSubmit() {
    if (!canEdit) return;
    setError(null);

    if (items.length === 0) {
      setError("Add at least one item.");
      return;
    }

    const clientId = await ensureClient();
    if (!clientId) return;

    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          issueDate,
          dueDate,
          notes,
          status,
          items: items.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            taxRate: Number(item.taxRate),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Unable to create invoice");
        return;
      }

      router.push(`/dashboard/invoices/${data.invoice.id}`);
      router.refresh();
    } catch {
      setError("Network error creating invoice");
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Read-only access</CardTitle>
          <CardDescription>
            You need member access or higher to create invoices.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">New invoice</h1>
        <p className="text-muted-foreground">Create and send a client invoice.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
          <CardDescription>Select an existing client or add a new one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {clientError && (
            <p className="text-sm text-destructive">{clientError}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={useNewClient ? "secondary" : "outline"}
              onClick={() => setUseNewClient(false)}
            >
              Select existing
            </Button>
            <Button
              type="button"
              variant={useNewClient ? "outline" : "secondary"}
              onClick={() => setUseNewClient(true)}
            >
              Add new client
            </Button>
          </div>

          {useNewClient ? (
            <div className="grid gap-4 max-w-lg">
              <div className="grid gap-2">
                <Label htmlFor="client-name">Primary name</Label>
                <Input
                  id="client-name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Jane Ade"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-company-name">Company name (optional)</Label>
                <Input
                  id="client-company-name"
                  value={newClientCompanyName}
                  onChange={(e) => setNewClientCompanyName(e.target.value)}
                  placeholder="Acme Ltd"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-email">Client email</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="billing@acme.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-phone">Phone (optional)</Label>
                <Input
                  id="client-phone"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-address">Address (optional)</Label>
                <Input
                  id="client-address"
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-2 max-w-md">
              <Label htmlFor="client-select">Client</Label>
              <select
                id="client-select"
                value={selectedClientId}
                onChange={(event) => setSelectedClientId(event.target.value)}
                disabled={loadingClients}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.displayName ?? client.companyName ?? client.name} ({client.email})
                  </option>
                ))}
              </select>
              {loadingClients && (
                <p className="text-xs text-muted-foreground">Loading clients...</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice details</CardTitle>
          <CardDescription>Set issue, due date, and notes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 max-w-lg">
          <div className="grid gap-2">
            <Label htmlFor="issue-date">Issue date</Label>
            <Input
              id="issue-date"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="due-date">Due date</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invoice-status">Status</Label>
            <select
              id="invoice-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as "DRAFT" | "SENT")}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="SENT">Sent</option>
              <option value="DRAFT">Draft</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Mark as draft if you plan to send later.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
          <CardDescription>Add the services or products billed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-4">
              <div className="grid gap-2">
                <Label>Description</Label>
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  placeholder="Consulting services"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Unit price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tax rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.taxRate}
                    onChange={(e) => updateItem(index, { taxRate: e.target.value })}
                  />
                </div>
              </div>
              {items.length > 1 && (
                <Button type="button" variant="ghost" onClick={() => removeItem(index)}>
                  Remove item
                </Button>
              )}
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addItem}>
            Add another item
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatAmount(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-medium">{formatAmount(totals.taxAmount)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatAmount(totals.totalAmount)}</span>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving..." : "Save invoice"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/invoices")}
>
          Back
        </Button>
      </div>
    </section>
  );
}
