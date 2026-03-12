import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPaymentRuntimeConfig } from "@/src/lib/env";
import { prisma } from "@/src/lib/prisma";
import InvoicePaymentPageClient from "./_components/InvoicePaymentPageClient";

type PageProps = {
  params: Promise<{ reference?: string }>;
};

function formatAmount(amountKobo: number) {
  return `NGN ${(amountKobo / 100).toFixed(2)}`;
}

function formatDate(value: Date | null) {
  if (!value) return null;
  return value.toLocaleString();
}

export default async function InvoicePaymentPage({ params }: PageProps) {
  const { reference } = await params;
  const paymentReference = reference?.trim() ?? "";

  if (!paymentReference) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Payment link not found</CardTitle>
            <CardDescription>The payment reference is invalid.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const invoice = await prisma.invoice.findFirst({
    where: { paymentReference },
    include: { client: true },
  });

  if (!invoice) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Payment link unavailable</CardTitle>
            <CardDescription>
              This payment reference does not match an active invoice.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const { allowStubPayments } = getPaymentRuntimeConfig();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-2xl">Invoice {invoice.invoiceNumber}</CardTitle>
            <Badge variant={invoice.status === "PAID" ? "secondary" : "outline"}>
              {invoice.status}
            </Badge>
          </div>
          <CardDescription>
            Payment reference <span className="font-medium text-foreground">{paymentReference}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div className="font-medium text-base">
                {invoice.client?.companyName ?? invoice.client?.name ?? "Client"}
              </div>
              <div className="text-muted-foreground">{invoice.client?.email ?? ""}</div>
              {invoice.client?.phone && (
                <div className="text-muted-foreground">{invoice.client.phone}</div>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total due</span>
                <span className="font-semibold">{formatAmount(invoice.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Issue date</span>
                <span>{invoice.issueDate.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Due date</span>
                <span>{invoice.dueDate.toLocaleDateString()}</span>
              </div>
              {invoice.paidAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Paid at</span>
                  <span>{formatDate(invoice.paidAt)}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <InvoicePaymentPageClient
            invoiceNumber={invoice.invoiceNumber}
            initialStatus={invoice.status}
            initialPaidAt={invoice.paidAt?.toISOString() ?? null}
            paymentReference={paymentReference}
            canSimulate={allowStubPayments}
          />

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              This hosted page is provider-agnostic. A real payment gateway can be connected by
              posting confirmation events to the payment webhook.
            </p>
            <Button variant="ghost" asChild>
              <Link href="/">TaxBook</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
