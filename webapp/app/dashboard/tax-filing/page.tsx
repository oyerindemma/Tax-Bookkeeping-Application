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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/src/lib/auth";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";
import {
  getWorkspaceTaxRecords,
  normalizeSearchParam,
  resolveSummaryCurrency,
  summarizeTaxFiling,
} from "@/src/lib/tax-reporting";

type SearchParams = {
  from?: string | string[];
  to?: string | string[];
};

function formatAmount(amountKobo: number, currency: string) {
  return `${currency} ${(amountKobo / 100).toFixed(2)}`;
}

function toDateInputValue(value: string | undefined) {
  return value ?? "";
}

export default async function TaxFilingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedParams = await searchParams;
  const user = await requireUser();
  const membership = await getActiveWorkspaceMembership(user.id);

  if (!membership) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Tax filing assistant</h1>
          <p className="text-muted-foreground">No workspace assigned.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Select a workspace</CardTitle>
            <CardDescription>
              Switch to a workspace to prepare VAT and WHT filing packs.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const fromParam = normalizeSearchParam(resolvedParams.from);
  const toParam = normalizeSearchParam(resolvedParams.to);
  const { records, errorMsg } = await getWorkspaceTaxRecords(
    membership.workspaceId,
    { fromParam, toParam }
  );
  const filingSummary = summarizeTaxFiling(records);
  const vatCurrency = "NGN";
  const whtCurrency = resolveSummaryCurrency(filingSummary.whtTotals);

  const exportParams = new URLSearchParams();
  if (fromParam) exportParams.set("from", fromParam);
  if (toParam) exportParams.set("to", toParam);

  const csvUrl = `/api/tax-filing/export?format=csv${
    exportParams.toString() ? `&${exportParams.toString()}` : ""
  }`;
  const printUrl = `/api/tax-filing/export?format=print${
    exportParams.toString() ? `&${exportParams.toString()}` : ""
  }`;

  const isEmpty = records.length === 0 && !errorMsg;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Tax filing assistant</h1>
          <p className="text-muted-foreground">
            Prepare VAT and WHT filing summaries for the selected period.
          </p>
          <p className="text-sm text-muted-foreground">
            Workspace:{" "}
            <span className="font-medium text-foreground">
              {membership.workspace.name}
            </span>
          </p>
        </div>
        <Badge variant="secondary">Workspace scope</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filing period</CardTitle>
          <CardDescription>
            Filter VAT and WHT summaries by date range before exporting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="grid gap-2">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                name="from"
                defaultValue={toDateInputValue(fromParam)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                name="to"
                defaultValue={toDateInputValue(toParam)}
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit">Apply filters</Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard/tax-filing">Clear</Link>
              </Button>
              <Button asChild variant="outline">
                <a href={csvUrl}>Export CSV</a>
              </Button>
              <Button asChild variant="outline">
                <a href={printUrl} target="_blank" rel="noreferrer">
                  Printable view
                </a>
              </Button>
            </div>
          </form>
          {errorMsg && <p className="mt-3 text-sm text-destructive">{errorMsg}</p>}
        </CardContent>
      </Card>

      {isEmpty && (
        <Card>
          <CardHeader>
            <CardTitle>No filing records yet</CardTitle>
            <CardDescription>
              Add income, expense, VAT, or WHT records for this period to generate a filing pack.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/dashboard/tax-records">Open tax records</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/reports">Open reports</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>VAT collected</CardDescription>
            <CardTitle className="text-xl">
              {formatAmount(filingSummary.vatCollected, vatCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Derived from tax amounts on income records in this period.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>VAT paid</CardDescription>
            <CardTitle className="text-xl">
              {formatAmount(filingSummary.vatPaid, vatCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Derived from tax amounts on expense records in this period.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>VAT payable</CardDescription>
            <CardTitle className="text-xl">
              {formatAmount(filingSummary.vatPayable, vatCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Calculated as VAT collected minus VAT paid.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>WHT total</CardDescription>
            <CardTitle className="text-xl">
              {formatAmount(filingSummary.whtTotals.tax, whtCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Withholding tax total from WHT records in this period.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>VAT filing notes</CardTitle>
            <CardDescription>
              Use this as a filing preparation summary. Government submission is not included yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">VAT collected</span>
              <span className="font-medium">
                {formatAmount(filingSummary.vatCollected, vatCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">VAT paid</span>
              <span className="font-medium">
                {formatAmount(filingSummary.vatPaid, vatCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold">
              <span>VAT payable</span>
              <span>{formatAmount(filingSummary.vatPayable, vatCurrency)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>WHT filing notes</CardTitle>
            <CardDescription>
              WHT totals are aggregated directly from withholding tax records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gross base</span>
              <span className="font-medium">
                {formatAmount(filingSummary.whtTotals.gross, whtCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">WHT total</span>
              <span className="font-medium">
                {formatAmount(filingSummary.whtTotals.tax, whtCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Net amount</span>
              <span className="font-medium">
                {formatAmount(filingSummary.whtTotals.net, whtCurrency)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
