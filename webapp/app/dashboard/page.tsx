import { requireUser } from "@/src/lib/auth";
import DashboardChartsPanel from "@/app/dashboard/_components/DashboardChartsPanel";
import {
  getWorkspaceTaxRecords,
  resolveSummaryCurrency,
  summarizeDashboardOverview,
  summarizeTaxReport,
} from "@/src/lib/tax-reporting";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

function formatAmount(amountKobo: number, currency: string) {
  const amount = (amountKobo / 100).toFixed(2);
  return currency === "MIXED" ? amount : `${currency} ${amount}`;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const membership = await getActiveWorkspaceMembership(user.id);
  if (!membership) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">No workspace assigned.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              Create or join a workspace to begin tracking tax activity.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }
  const { records } = await getWorkspaceTaxRecords(membership.workspaceId, {});
  const { totals } = summarizeTaxReport(records);
  const { monthlyTrendRows, expenseCategoryRows } = summarizeDashboardOverview(
    records
  );
  const totalAmount = totals.gross;
  const totalTax = totals.tax;
  const totalNet = totals.net;
  const recordCount = records.length;
  const currency = resolveSummaryCurrency(totals);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">
            Workspace:{" "}
            <span className="font-medium text-foreground">
              {membership.workspace.name}
            </span>
          </p>
          <p className="text-muted-foreground">
            Track VAT, WHT, and income/expense flows from one place.
          </p>
        </div>
        <Badge variant="secondary">Active workspace</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total amount</CardDescription>
            <CardTitle className="text-xl">
              {formatAmount(totalAmount, currency)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total tax</CardDescription>
            <CardTitle className="text-xl">{formatAmount(totalTax, currency)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net income</CardDescription>
            <CardTitle className="text-xl">{formatAmount(totalNet, currency)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {recordCount === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              Complete these steps to finish onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>Create your first tax record</span>
                <Button asChild size="sm">
                  <Link href="/dashboard/tax-records">Add record</Link>
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>Review your reports summary</span>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/reports">Open reports</Link>
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>Invite a teammate</span>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/team">Invite team</Link>
                </Button>
              </div>
            </div>
            <p>Signed in as {user.email}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold">Financial overview</h2>
          <p className="text-sm text-muted-foreground">
            Charting the latest six months of workspace activity without changing your current totals.
          </p>
        </div>
        <DashboardChartsPanel
          currency={currency}
          monthlyTrendRows={monthlyTrendRows}
          expenseCategoryRows={expenseCategoryRows}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick start</CardTitle>
          <CardDescription>Next steps for this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1 pl-5">
            <li>Record your first income or expense</li>
            <li>Import receipts and categorise them</li>
            <li>Generate a VAT/WHT summary</li>
          </ul>
          <p>Signed in as {user.email}</p>
        </CardContent>
      </Card>
    </section>
  );
}
