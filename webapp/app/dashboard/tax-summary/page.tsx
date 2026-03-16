import { Badge } from "@/components/ui/badge";
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
import { requireUser } from "@/src/lib/auth";
import { getWorkspaceTaxSummary } from "@/src/lib/accounting-firm";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";

type SearchParams = {
  from?: string | string[];
  to?: string | string[];
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function parseDateInput(raw?: string | null, endOfDay = false) {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = endOfDay
    ? new Date(year, month, day, 23, 59, 59, 999)
    : new Date(year, month, day, 0, 0, 0, 0);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatAmount(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatPortfolioAmount(amountMinor: number, currencyMode: string) {
  if (currencyMode === "MIXED") {
    return "Mixed portfolio";
  }
  return formatAmount(amountMinor, currencyMode);
}

export default async function TaxSummaryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const user = await requireUser();
  const membership = await getActiveWorkspaceMembership(user.id);

  if (!membership) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Tax summary</h1>
          <p className="text-muted-foreground">No workspace assigned.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Select a workspace</CardTitle>
            <CardDescription>
              Switch to a workspace to review VAT and WHT summaries by client business.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const fallbackFrom = startOfCurrentMonth();
  const fallbackTo = new Date();
  const requestedFrom = parseDateInput(firstValue(resolvedSearchParams.from));
  const requestedTo = parseDateInput(firstValue(resolvedSearchParams.to), true);
  const from = requestedFrom ?? fallbackFrom;
  const to = requestedTo ?? fallbackTo;
  const invalidRange = from.getTime() > to.getTime();

  const summary = invalidRange
    ? null
    : await getWorkspaceTaxSummary(membership.workspaceId, {
        from,
        to,
      });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Tax summary</h1>
          <p className="text-muted-foreground">
            Review VAT and WHT exposure across the client-business portfolio.
          </p>
          <p className="text-sm text-muted-foreground">
            Workspace:{" "}
            <span className="font-medium text-foreground">
              {membership.workspace.name}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Portfolio dashboard</Badge>
          <Badge variant="outline">Ledger-driven</Badge>
        </div>
      </div>

      <Card className="border-border/70 bg-muted/20">
        <CardHeader>
          <CardTitle>Date range</CardTitle>
          <CardDescription>
            Filter the summary by transaction date. Default scope is the current month.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form method="GET" className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="grid gap-2">
              <Label htmlFor="from">From</Label>
              <Input id="from" name="from" type="date" defaultValue={toDateInputValue(from)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="date" defaultValue={toDateInputValue(to)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full md:w-auto">
                Apply range
              </Button>
            </div>
          </form>
          {invalidRange ? (
            <p className="text-sm text-destructive">
              The start date must be on or before the end date.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Output VAT</CardDescription>
            <CardTitle className="text-xl">
              {summary
                ? formatPortfolioAmount(summary.totals.outputVatMinor, summary.currencyMode)
                : "Pending"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Input VAT</CardDescription>
            <CardTitle className="text-xl">
              {summary
                ? formatPortfolioAmount(summary.totals.inputVatMinor, summary.currencyMode)
                : "Pending"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net VAT</CardDescription>
            <CardTitle className="text-xl">
              {summary
                ? formatPortfolioAmount(summary.totals.netVatMinor, summary.currencyMode)
                : "Pending"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>WHT payable</CardDescription>
            <CardTitle className="text-xl">
              {summary
                ? formatPortfolioAmount(summary.totals.whtPayableMinor, summary.currencyMode)
                : "Pending"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>WHT receivable</CardDescription>
            <CardTitle className="text-xl">
              {summary
                ? formatPortfolioAmount(summary.totals.whtReceivableMinor, summary.currencyMode)
                : "Pending"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business breakdown</CardTitle>
          <CardDescription>
            Per-business VAT and WHT totals from ledger transactions in the selected date
            range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!summary ? (
            <p className="text-sm text-muted-foreground">
              Fix the date range to generate the summary.
            </p>
          ) : summary.businesses.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
              No ledger transactions matched the selected range. Create client businesses,
              review AI drafts, and post transactions to populate VAT and WHT reporting.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Client business</th>
                    <th className="px-2 py-2">Transactions</th>
                    <th className="px-2 py-2">Output VAT</th>
                    <th className="px-2 py-2">Input VAT</th>
                    <th className="px-2 py-2">Net VAT</th>
                    <th className="px-2 py-2">WHT payable</th>
                    <th className="px-2 py-2">WHT receivable</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.businesses.map((business) => (
                    <tr key={business.clientBusinessId} className="border-t align-top">
                      <td className="px-2 py-3">
                        <div className="font-medium">{business.clientBusinessName}</div>
                        <div className="text-xs text-muted-foreground">{business.currency}</div>
                      </td>
                      <td className="px-2 py-3">
                        <div>{business.transactionCount}</div>
                        <div className="text-xs text-muted-foreground">
                          {business.postedCount} posted · {business.draftCount} pending
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        {formatAmount(business.outputVatMinor, business.currency)}
                      </td>
                      <td className="px-2 py-3">
                        {formatAmount(business.inputVatMinor, business.currency)}
                      </td>
                      <td className="px-2 py-3">
                        {formatAmount(business.netVatMinor, business.currency)}
                      </td>
                      <td className="px-2 py-3">
                        {formatAmount(business.whtPayableMinor, business.currency)}
                      </td>
                      <td className="px-2 py-3">
                        {formatAmount(business.whtReceivableMinor, business.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
