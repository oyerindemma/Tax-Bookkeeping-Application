import Link from "next/link";
import type { Metadata } from "next";
import {
  ADD_ON_CONFIG,
  ensureWorkspaceSubscription,
  formatAiScanLimit,
  formatAnnualSavings,
  formatLimit,
  formatPlanPricePerInterval,
  getPlanConfig,
  isPlanAtLeast,
  PLAN_ORDER,
  type BillingInterval,
} from "@/src/lib/billing";
import { getUserFromSession } from "@/src/lib/auth";
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
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PRICING_FAQ, PRICING_INCLUSIONS } from "@/components/marketing/site-content";

type SearchParams = {
  interval?: string | string[];
};

type PlanKey = (typeof PLAN_ORDER)[number];
type ComparisonRow = {
  label: string;
  getValue: (plan: PlanKey, interval: BillingInterval) => string;
};

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveInterval(value: string | string[] | undefined): BillingInterval {
  return getSingleValue(value)?.toLowerCase() === "annual" ? "ANNUAL" : "MONTHLY";
}

const comparisonRows: ComparisonRow[] = [
  {
    label: "Subscription",
    getValue: (plan: PlanKey, interval: BillingInterval) => formatPlanPricePerInterval(plan, interval),
  },
  {
    label: "Businesses",
    getValue: (plan: PlanKey) => formatLimit(getPlanConfig(plan).maxBusinesses),
  },
  {
    label: "Users",
    getValue: (plan: PlanKey) => formatLimit(getPlanConfig(plan).maxUsers),
  },
  {
    label: "AI scans / month",
    getValue: (plan: PlanKey) => formatAiScanLimit(getPlanConfig(plan).aiScansPerMonth),
  },
  {
    label: "Manual bookkeeping and VAT summary",
    getValue: () => "Included",
  },
  {
    label: "AI receipt scanning and bookkeeping automation",
    getValue: (plan: PlanKey) => (isPlanAtLeast(plan, "GROWTH") ? "Included" : "Locked"),
  },
  {
    label: "Invoice management and recurring billing",
    getValue: (plan: PlanKey) => (isPlanAtLeast(plan, "GROWTH") ? "Included" : "Locked"),
  },
  {
    label: "Bank statement AI reconciliation",
    getValue: (plan: PlanKey) => (isPlanAtLeast(plan, "PROFESSIONAL") ? "Included" : "Locked"),
  },
  {
    label: "Audit logs, tax filing assistant, and team collaboration",
    getValue: (plan: PlanKey) => (isPlanAtLeast(plan, "PROFESSIONAL") ? "Included" : "Locked"),
  },
  {
    label: "API integrations and priority support",
    getValue: (plan: PlanKey) => (plan === "ENTERPRISE" ? "Included" : "Locked"),
  },
  {
    label: "Annual savings",
    getValue: (plan: PlanKey) => formatAnnualSavings(plan) ?? "Included already",
  },
];

const annualToggleHref = "/pricing?interval=annual";
const monthlyToggleHref = "/pricing?interval=monthly";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose a TaxBook AI subscription for Nigerian businesses and accounting firms.",
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedParams = await searchParams;
  const interval = resolveInterval(resolvedParams?.interval);
  const user = await getUserFromSession();
  const membership = user ? await getActiveWorkspaceMembership(user.id) : null;
  const subscription = membership
    ? await ensureWorkspaceSubscription(membership.workspaceId)
    : null;

  return (
    <MarketingShell backgroundClassName="bg-[radial-gradient(circle_at_top,rgba(212,168,84,0.18),transparent_24%),linear-gradient(180deg,#f8f4ea_0%,#fcfbf8_42%,#f2f7f2_100%)]">
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="space-y-5">
          <Badge variant="secondary" className="rounded-full px-4 py-1.5">
            Pricing
          </Badge>
          <h1 className="text-5xl font-semibold tracking-tight text-balance">
            Starter, Growth, Professional, and Enterprise pricing for real accounting workflows.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            TaxBook AI is priced for Nigerian businesses and accounting firms that need a path from
            manual bookkeeping into AI capture, reconciliation, and advanced tax workflows.
          </p>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            {membership
              ? `Active workspace: ${membership.workspace.name}. Current plan: ${getPlanConfig(
                  subscription?.plan ?? "STARTER"
                ).name}.`
              : "Start on Starter for free, then move into Growth or Professional when you need AI, banking, or team workflows."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant={interval === "MONTHLY" ? "default" : "outline"}>
              <Link href={monthlyToggleHref}>Monthly</Link>
            </Button>
            <Button asChild variant={interval === "ANNUAL" ? "default" : "outline"}>
              <Link href={annualToggleHref}>Annual</Link>
            </Button>
            <Badge variant="outline">20% annual savings already reflected</Badge>
          </div>
        </div>

        <Card className="border-border/60 bg-white/85 shadow-sm">
          <CardHeader>
            <CardTitle>What every workspace gets</CardTitle>
            <CardDescription>
              Start with bookkeeping fundamentals, then unlock automation and controls as the firm
              grows.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            {PRICING_INCLUSIONS.map((item) => (
              <div key={item} className="rounded-2xl border bg-background px-4 py-3">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="Workspace plans"
          title="Pick the plan that matches the volume and control level you need today."
          description="Annual prices already include the 20% savings versus paying monthly for twelve months."
        />
        <div className="mt-10">
          <PricingGrid
            interactive
            interval={interval}
            currentPlan={subscription?.plan ?? null}
            loggedIn={Boolean(user)}
            hasActiveWorkspace={Boolean(membership)}
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="Plan comparison"
          title="See the exact capacity and workflow unlocks on each plan."
          description="The product stays usable from Starter, then adds AI, reconciliation, collaboration, and enterprise controls as you move up."
        />
        <Card className="mt-10 border-border/60 bg-white/85">
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="px-6 py-4 font-medium">Capability</th>
                  {PLAN_ORDER.map((plan) => (
                    <th key={plan} className="px-4 py-4 font-medium">
                      {getPlanConfig(plan).name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b border-border/40 last:border-b-0">
                    <td className="px-6 py-4 font-medium">{row.label}</td>
                    {PLAN_ORDER.map((plan) => (
                      <td key={`${row.label}-${plan}`} className="px-4 py-4 text-muted-foreground">
                        {row.getValue(plan, interval)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-b border-border/40 last:border-b-0">
                  <td className="px-6 py-4 font-medium">Best fit</td>
                  {PLAN_ORDER.map((plan) => (
                    <td key={`best-fit-${plan}`} className="px-4 py-4 text-muted-foreground">
                      {getPlanConfig(plan).target}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="Add-on ready"
          title="Add-ons are structured now, with checkout wiring still to come."
          description="This keeps Enterprise and future overage pricing clear without turning on partial billing flows prematurely."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {Object.values(ADD_ON_CONFIG).map((item) => (
            <Card key={item.id} className="border-border/60 bg-white/85">
              <CardHeader>
                <CardTitle className="text-xl">{item.name}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="font-semibold">
                  {item.monthlyPriceKobo === 0
                    ? "Included"
                    : `${(item.monthlyPriceKobo / 100).toLocaleString("en-NG", {
                        style: "currency",
                        currency: "NGN",
                        maximumFractionDigits: 0,
                      })} ${item.unitLabel}`}
                </div>
                <p className="text-muted-foreground">
                  Placeholder only for now. Self-serve add-on checkout still needs wiring.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="FAQ"
          title="Answers to the questions teams ask before subscribing."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PRICING_FAQ.map((item) => (
            <Card key={item.question} className="border-border/60 bg-white/85">
              <CardHeader>
                <CardTitle className="text-xl">{item.question}</CardTitle>
                <CardDescription className="mt-2 leading-6">{item.answer}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
