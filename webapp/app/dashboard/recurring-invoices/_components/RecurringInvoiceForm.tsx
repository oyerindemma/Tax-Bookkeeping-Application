"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ClientOption = {
  id: number;
  displayName: string;
  email: string;
};

type RecurringLineItemFormValue = {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

export type RecurringInvoiceFormValues = {
  clientId: string;
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY";
  nextRunAt: string;
  dueInDays: string;
  invoiceStatus: "DRAFT" | "SENT";
  active: boolean;
  notes: string;
  items: RecurringLineItemFormValue[];
};

type Props = {
  title: string;
  description: string;
  submitLabel: string;
  clients: ClientOption[];
  initialValues: RecurringInvoiceFormValues;
  saving: boolean;
  error?: string | null;
  disabled?: boolean;
  onSubmit: (values: RecurringInvoiceFormValues) => Promise<void>;
  onCancel?: () => void;
};

export const EMPTY_RECURRING_INVOICE_FORM_VALUES: RecurringInvoiceFormValues = {
  clientId: "",
  frequency: "MONTHLY",
  nextRunAt: new Date().toISOString().slice(0, 10),
  dueInDays: "0",
  invoiceStatus: "DRAFT",
  active: true,
  notes: "",
  items: [{ description: "", quantity: "1", unitPrice: "", taxRate: "0" }],
};

function formatAmount(amountKobo: number) {
  return `NGN ${(amountKobo / 100).toFixed(2)}`;
}

function toKobo(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export default function RecurringInvoiceForm({
  title,
  description,
  submitLabel,
  clients,
  initialValues,
  saving,
  error,
  disabled = false,
  onSubmit,
  onCancel,
}: Props) {
  const idPrefix = useId().replace(/:/g, "");
  const [values, setValues] = useState(() => initialValues);
  const [localError, setLocalError] = useState<string | null>(null);

  const preview = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;

    values.items.forEach((item) => {
      const quantity = Number(item.quantity);
      const unitPriceKobo = toKobo(item.unitPrice);
      const taxRate = Number(item.taxRate);
      if (!Number.isFinite(quantity) || quantity <= 0) return;
      if (unitPriceKobo === null) return;
      if (!Number.isFinite(taxRate)) return;

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
  }, [values.items]);

  function updateField<K extends keyof RecurringInvoiceFormValues>(
    field: K,
    value: RecurringInvoiceFormValues[K]
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateItem(index: number, patch: Partial<RecurringLineItemFormValue>) {
    setValues((current) => ({
      ...current,
      items: current.items.map((item, currentIndex) =>
        currentIndex === index ? { ...item, ...patch } : item
      ),
    }));
  }

  function addItem() {
    setValues((current) => ({
      ...current,
      items: [
        ...current.items,
        { description: "", quantity: "1", unitPrice: "", taxRate: "0" },
      ],
    }));
  }

  function removeItem(index: number) {
    setValues((current) => ({
      ...current,
      items: current.items.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  function validate() {
    if (!values.clientId) {
      return "Select a client.";
    }
    if (!values.nextRunAt) {
      return "Next run date is required.";
    }
    if (values.items.length === 0) {
      return "Add at least one line item.";
    }
    const dueInDays = Number(values.dueInDays);
    if (!Number.isFinite(dueInDays) || dueInDays < 0) {
      return "Due in days must be 0 or more.";
    }
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled) return;
    const validationError = validate();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    await onSubmit(values);
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(error || localError) && (
            <p className="text-sm text-destructive">{error ?? localError}</p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-client`}>Client</Label>
              <select
                id={`${idPrefix}-client`}
                value={values.clientId}
                onChange={(event) => updateField("clientId", event.target.value)}
                disabled={disabled || clients.length === 0}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.displayName} ({client.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-frequency`}>Frequency</Label>
              <select
                id={`${idPrefix}-frequency`}
                value={values.frequency}
                onChange={(event) =>
                  updateField(
                    "frequency",
                    event.target.value as RecurringInvoiceFormValues["frequency"]
                  )
                }
                disabled={disabled}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-next-run`}>Next run</Label>
              <Input
                id={`${idPrefix}-next-run`}
                type="date"
                value={values.nextRunAt}
                onChange={(event) => updateField("nextRunAt", event.target.value)}
                disabled={disabled}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-due-days`}>Due in days</Label>
              <Input
                id={`${idPrefix}-due-days`}
                type="number"
                min="0"
                value={values.dueInDays}
                onChange={(event) => updateField("dueInDays", event.target.value)}
                disabled={disabled}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-invoice-status`}>Generated invoice status</Label>
              <select
                id={`${idPrefix}-invoice-status`}
                value={values.invoiceStatus}
                onChange={(event) =>
                  updateField(
                    "invoiceStatus",
                    event.target.value as RecurringInvoiceFormValues["invoiceStatus"]
                  )
                }
                disabled={disabled}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.active}
              onChange={(event) => updateField("active", event.target.checked)}
              disabled={disabled}
            />
            Active template
          </label>

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
            <textarea
              id={`${idPrefix}-notes`}
              rows={3}
              value={values.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Optional notes copied into each generated invoice"
              disabled={disabled}
              className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Template items</p>
                <p className="text-xs text-muted-foreground">
                  These lines will be copied into each generated invoice.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={disabled}>
                Add item
              </Button>
            </div>

            <div className="space-y-3">
              {values.items.map((item, index) => (
                <div key={`${idPrefix}-item-${index}`} className="rounded-lg border p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2 md:col-span-2">
                      <Label htmlFor={`${idPrefix}-description-${index}`}>Description</Label>
                      <Input
                        id={`${idPrefix}-description-${index}`}
                        value={item.description}
                        onChange={(event) =>
                          updateItem(index, { description: event.target.value })
                        }
                        disabled={disabled}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`${idPrefix}-quantity-${index}`}>Quantity</Label>
                      <Input
                        id={`${idPrefix}-quantity-${index}`}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, { quantity: event.target.value })
                        }
                        disabled={disabled}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`${idPrefix}-unit-price-${index}`}>Unit price</Label>
                      <Input
                        id={`${idPrefix}-unit-price-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateItem(index, { unitPrice: event.target.value })
                        }
                        disabled={disabled}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`${idPrefix}-tax-rate-${index}`}>Tax rate (%)</Label>
                      <Input
                        id={`${idPrefix}-tax-rate-${index}`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={item.taxRate}
                        onChange={(event) =>
                          updateItem(index, { taxRate: event.target.value })
                        }
                        disabled={disabled}
                      />
                    </div>
                  </div>
                  {values.items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      disabled={disabled}
                      className="mt-3"
                    >
                      Remove item
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="py-4">
              <CardHeader className="pb-0">
                <CardDescription>Subtotal</CardDescription>
                <CardTitle className="text-lg">{formatAmount(preview.subtotal)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="py-4">
              <CardHeader className="pb-0">
                <CardDescription>Tax</CardDescription>
                <CardTitle className="text-lg">{formatAmount(preview.taxAmount)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="py-4">
              <CardHeader className="pb-0">
                <CardDescription>Total</CardDescription>
                <CardTitle className="text-lg">{formatAmount(preview.totalAmount)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={disabled || saving || clients.length === 0}>
              {saving ? "Saving..." : submitLabel}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={disabled || saving}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
