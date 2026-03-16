import Link from "next/link";
import { FeatureGateCard } from "@/components/billing/feature-gate-card";
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
import { getWorkspaceFeatureAccess } from "@/src/lib/billing";
import {
  buildTaxComplianceSummary,
  buildTaxExportQueryString,
  getReadinessBadgeVariant,
  getReadinessLabel,
  resolveTaxPeriodState,
} from "@/src/lib/tax-compliance";
import {
  getCommonWhtRatePresets,
  getFiscalMonthLabel,
  NIGERIA_TAX_CONFIG,
} from "@/src/lib/nigeria-tax-config";
import { getWorkspaceTaxRecords } from "@/src/lib/tax-reporting";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";

type SearchParams = {
  period?: string | string[];
  month?: string | string[];
  quarter?: string | string[];
  year?: string | string[];
  from?: string | string[];
  to?: string | string[];
};

function formatAmount(amountKobo: number, currency: string) {
  const amount = (amountKobo / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "MIXED" ? amount : `${currency} ${amount}`;
}

function quarterLabel(value: string) {
  return `Q${value}`;
}

function directionLabel(value: string) {
  return value.replace(/_/g, " ");
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
          <h1 className="text-2xl font-semibold">Tax compliance</h1>
          <p className="text-muted-foreground">No workspace assigned.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Select a workspace</CardTitle>
            <CardDescription>
              Switch to a workspace to generate VAT, WHT, and company tax review packs.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const access = await getWorkspaceFeatureAccess(
    membership.workspaceId,
    "TAX_FILING_ASSISTANT"
  );
  if (!access.ok) {
    return (
      <section className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Tax compliance</h1>
          <p className="text-muted-foreground">
            Advanced tax filing review packs and assisted exports are available from Professional.
          </p>
        </div>
        <FeatureGateCard
          feature="TAX_FILING_ASSISTANT"
          currentPlan={access.plan}
          requiredPlan={access.requiredPlan}
          note="Starter and Growth still keep VAT summaries and core reports, but the filing assistant stays on Professional and Enterprise."
        />
      </section>
    );
  }

  const period = resolveTaxPeriodState(resolvedParams);
  let filterError = period.errorMsg;
  let records = [] as Awaited<ReturnType<typeof getWorkspaceTaxRecords>>["records"];

  if (!filterError) {
    const taxRecordsResult = await getWorkspaceTaxRecords(membership.workspaceId, {
      fromParam: period.fromParam,
      toParam: period.toParam,
    });
    records = taxRecordsResult.records;
    filterError = taxRecordsResult.errorMsg;
  }

  const summary = buildTaxComplianceSummary({
    records,
    period,
    defaultCurrency: membership.workspace.businessProfile?.defaultCurrency ?? "NGN",
    fiscalYearStartMonth:
      membership.workspace.businessProfile?.fiscalYearStartMonth ??
      NIGERIA_TAX_CONFIG.companyTax.fiscalYearDefaultStartMonth,
  });
  const exportQuery = buildTaxExportQueryString(summary.period);
  const exportSuffix = exportQuery ? `&${exportQuery}` : "";
  const vatCsvUrl = `/api/tax-filing/export?format=vat-csv${exportSuffix}`;
  const whtCsvUrl = `/api/tax-filing/export?format=wht-csv${exportSuffix}`;
  const summaryCsvUrl = `/api/tax-filing/export?format=summary-csv${exportSuffix}`;
  const reviewUrl = `/api/tax-filing/export?format=review-html${exportSuffix}`;
  const hasRecords = records.length > 0;
  const whtPresets = getCommonWhtRatePresets();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Tax compliance</h1>
          <p className="text-muted-foreground">
            Review VAT, WHT, and basic company tax readiness from workspace transactions.
          </p>
          <p className="text-sm text-muted-foreground">
            Workspace:{" "}
            <span className="font-medium text-foreground">
              {membership.workspace.name}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Workspace scope</Badge>
          <Badge variant="outline">Estimate only</Badge>
        </div>
      </div>

      <Card className="border-border/70 bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle>Important</CardTitle>
          <CardDescription>
            These figures are estimates from stored transactions. Confirm rates, exemptions, and filing treatment with your accountant before submitting to FIRS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {summary.disclaimers.map((disclaimer) => (
            <p key={disclaimer}>{disclaimer}</p>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>By month</CardTitle>
            <CardDescription>Scope the tax engine to one month.</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="GET" className="grid gap-3">
              <input type="hidden" name="period" value="month" />
              <div className="grid gap-2">
                <Label htmlFor="month">Month</Label>
                <Input id="month" name="month" type="month" defaultValue={period.monthInput} />
              </div>
              <Button type="submit">Apply month</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By quarter</CardTitle>
            <CardDescription>Prepare quarter-level VAT and WHT packs.</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="GET" className="grid gap-3">
              <input type="hidden" name="period" value="quarter" />
              <div className="grid gap-2">
                <Label htmlFor="quarter">Quarter</Label>
                <select
                  id="quarter"
                  name="quarter"
                  defaultValue={period.quarterInput}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {["1", "2", "3", "4"].map((quarter) => (
                    <option key={quarter} value={quarter}>
                      {quarterLabel(quarter)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  name="year"
                  type="number"
                  min="2000"
                  max="2100"
                  defaultValue={period.yearInput}
                />
              </div>
              <Button type="submit">Apply quarter</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custom range</CardTitle>
            <CardDescription>Use a custom filing or review period.</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="GET" className="grid gap-3">
              <input type="hidden" name="period" value="custom" />
              <div className="grid gap-2">
                <Label htmlFor="from">From</Label>
                <Input id="from" name="from" type="date" defaultValue={period.fromInput} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="to">To</Label>
                <Input id="to" name="to" type="date" defaultValue={period.toInput} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Apply custom range</Button>
                <Button asChild variant="secondary">
                  <Link href="/dashboard/tax-filing?period=all">Clear filters</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Selected period</CardTitle>
          <CardDescription>
            The compliance engine is running on <span className="font-medium text-foreground">{summary.period.label}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="outline">{summary.period.mode.toUpperCase()}</Badge>
          <span className="text-muted-foreground">
            Records considered: {summary.counts.totalRecords}
          </span>
          <span className="text-muted-foreground">
            Tax-bearing records: {summary.counts.taxBearingRecords}
          </span>
          {summary.counts.mixedCurrencies ? (
            <Badge variant="outline">Mixed currencies</Badge>
          ) : null}
          {filterError ? <span className="text-destructive">{filterError}</span> : null}
        </CardContent>
      </Card>

      {!filterError && !hasRecords ? (
        <Card>
          <CardHeader>
            <CardTitle>No tax records for this period</CardTitle>
            <CardDescription>
              Add income, expense, VAT, or WHT records before generating a compliance pack.
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
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Output VAT</CardDescription>
            <CardTitle className="text-xl">
              {formatAmount(summary.vat.outputVat, summary.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            VAT inferred on income-side transactions and payable-side VAT adjustments.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Input VAT</CardDescription>
            <CardTitle className="text-xl">
              {formatAmount(summary.vat.inputVat, summary.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            VAT inferred on expense-side transactions and recoverable-side VAT adjustments.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net VAT</CardDescription>
            <CardTitle className="text-xl">
              {formatAmount(summary.vat.netVat, summary.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Output VAT minus input VAT for the selected period.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>WHT deducted</CardDescription>
            <CardTitle className="text-xl">
              {formatAmount(summary.wht.deducted, summary.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            WHT treated as deducted from supplier or service payments.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>WHT suffered</CardDescription>
            <CardTitle className="text-xl">
              {formatAmount(summary.wht.suffered, summary.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            WHT treated as withheld from amounts due to the business.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxable income estimate</CardDescription>
            <CardTitle className="text-xl">
              {formatAmount(summary.companyTax.taxableIncomeEstimate, summary.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Estimated income base minus estimated expense base after VAT treatment.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Company tax readiness</CardTitle>
                <CardDescription>
                  Basic data-quality checks before accountant review.
                </CardDescription>
              </div>
              <Badge variant={getReadinessBadgeVariant(summary.companyTax.readinessStatus)}>
                {getReadinessLabel(summary.companyTax.readinessStatus)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated income base</span>
              <span className="font-medium">
                {formatAmount(summary.companyTax.incomeBase, summary.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated expense base</span>
              <span className="font-medium">
                {formatAmount(summary.companyTax.expenseBase, summary.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Uncategorized expenses</span>
              <span className="font-medium">{summary.companyTax.uncategorizedExpenseCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Missing counterparties</span>
              <span className="font-medium">{summary.companyTax.missingCounterpartyCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Manual tax assumptions</span>
              <span className="font-medium">{summary.companyTax.manualTaxReviewCount}</span>
            </div>
            {summary.companyTax.readinessNotes.length > 0 ? (
              <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3 text-muted-foreground">
                {summary.companyTax.readinessNotes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configured defaults</CardTitle>
            <CardDescription>
              Rates stay configurable in code and can move into settings later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Standard VAT</span>
              <span className="font-medium">{NIGERIA_TAX_CONFIG.vat.standardRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">VAT filing frequency</span>
              <span className="font-medium capitalize">
                {NIGERIA_TAX_CONFIG.vat.filingFrequency}
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Common WHT presets
              </p>
              {whtPresets.map((preset) => (
                <div key={preset.code} className="rounded-md border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{preset.label}</span>
                    <span>{preset.rate}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{preset.note}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Fiscal year starts in{" "}
              {getFiscalMonthLabel(summary.companyTax.fiscalYearStartMonth)} for this workspace.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export pack</CardTitle>
            <CardDescription>
              Generate CSV packs and a printable accountant review report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Button asChild>
                <a href={vatCsvUrl}>Export VAT CSV</a>
              </Button>
              <Button asChild variant="outline">
                <a href={whtCsvUrl}>Export WHT CSV</a>
              </Button>
              <Button asChild variant="outline">
                <a href={summaryCsvUrl}>Export summary CSV</a>
              </Button>
              <Button asChild variant="secondary">
                <a href={reviewUrl} target="_blank" rel="noreferrer">
                  Accountant review report
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Export packs are structured so a future FIRS adapter can reuse the same compliance snapshot.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>VAT basis records</CardTitle>
            <CardDescription>
              Transactions currently contributing to output or input VAT.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.vat.records.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No VAT-bearing records were found in this period.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Direction</th>
                    <th className="pb-3 font-medium">Tax</th>
                    <th className="pb-3 font-medium">Source</th>
                    <th className="pb-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.vat.records.map((record) => (
                    <tr key={record.id} className="border-b last:border-b-0">
                      <td className="py-3">{record.occurredOn}</td>
                      <td className="py-3">{directionLabel(record.vatDirection ?? "OUTPUT")}</td>
                      <td className="py-3">
                        {formatAmount(record.taxAmountKobo, record.currency)}
                      </td>
                      <td className="py-3">
                        <div>{record.vendorName ?? record.kind}</div>
                        <div className="text-xs text-muted-foreground">
                          {record.description ?? "No description"}
                        </div>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {record.assumptions[0] ?? `${record.confidence} confidence`}
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
            <CardTitle>WHT basis records</CardTitle>
            <CardDescription>
              Transactions currently contributing to WHT deducted or suffered.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.wht.records.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No WHT-bearing records were found in this period.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Direction</th>
                    <th className="pb-3 font-medium">Tax</th>
                    <th className="pb-3 font-medium">Source</th>
                    <th className="pb-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.wht.records.map((record) => (
                    <tr key={record.id} className="border-b last:border-b-0">
                      <td className="py-3">{record.occurredOn}</td>
                      <td className="py-3">{directionLabel(record.whtDirection ?? "DEDUCTED")}</td>
                      <td className="py-3">
                        {formatAmount(record.taxAmountKobo, record.currency)}
                      </td>
                      <td className="py-3">
                        <div>{record.vendorName ?? record.kind}</div>
                        <div className="text-xs text-muted-foreground">
                          {record.description ?? "No description"}
                        </div>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {record.assumptions[0] ?? `${record.confidence} confidence`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
