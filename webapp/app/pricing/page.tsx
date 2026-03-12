import type { Metadata } from "next";
import {
  PLAN_ORDER,
  ensureWorkspaceSubscription,
  formatLimit,
  formatPlanPricePerMonth,
  getPlanConfig,
  isPlanAtLeast,
} from "@/src/lib/billing";
import { getUserFromSession } from "@/src/lib/auth";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";
import { Badge } from "@/components/ui/badge";
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

type PlanKey = (typeof PLAN_ORDER)[number];

const comparisonRows = [
  {
    label: "Monthly subscription",
    getValue: (plan: PlanKey) => formatPlanPricePerMonth(plan),
  },
  {
    label: "Workspace members",
    getValue: (plan: PlanKey) => formatLimit(getPlanConfig(plan).maxMembers),
  },
  {
    label: "Tax records",
    getValue: (plan: PlanKey) => formatLimit(getPlanConfig(plan).maxRecords),
  },
  {
    label: "AI assistant and receipt scanning",
    getValue: (plan: PlanKey) => (isPlanAtLeast(plan, "GROWTH") ? "Included" : "Upgrade"),
  },
  {
    label: "Banking and reconciliation",
    getValue: (plan: PlanKey) => (isPlanAtLeast(plan, "BUSINESS") ? "Included" : "Upgrade"),
  },
  {
    label: "Recurring invoices",
    getValue: (plan: PlanKey) => (isPlanAtLeast(plan, "BUSINESS") ? "Included" : "Upgrade"),
  },
  {
    label: "Audit log and team management",
    getValue: (plan: PlanKey) => (isPlanAtLeast(plan, "ACCOUNTANT") ? "Included" : "Upgrade"),
  },
];

const bestFit: Record<PlanKey, string> = {
  FREE: "Solo operators testing the workflow",
  GROWTH: "Small teams that need AI-assisted speed",
  BUSINESS: "Finance teams that need operational workflows",
  ACCOUNTANT: "Firms and advanced multi-operator setups",
};

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose a TaxBook subscription and upgrade your workspace with Paystack.",
};

export default async function PricingPage() {
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
            Workspace subscriptions priced for Nigerian operators and finance teams.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Upgrade directly from this page with Paystack. Higher plans unlock premium workflows
            and raise team and record limits as the workspace grows.
          </p>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            {membership
              ? `Active workspace: ${membership.workspace.name}. Current plan: ${getPlanConfig(
                  subscription?.plan ?? "FREE"
                ).name}.`
              : "Sign up for Free, then upgrade the active workspace whenever you need more capability."}
          </p>
        </div>

        <Card className="border-border/60 bg-white/85 shadow-sm">
          <CardHeader>
            <CardTitle>What every workspace gets</CardTitle>
            <CardDescription>
              The base accounting workflow is available from day one, then premium plans unlock
              more automation and operational controls.
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
          title="Choose the subscription that matches your current finance workload."
          description="Use Paystack to move from Free into paid plans without leaving the pricing page."
        />
        <div className="mt-10">
          <PricingGrid
            interactive
            currentPlan={subscription?.plan ?? null}
            loggedIn={Boolean(user)}
            hasActiveWorkspace={Boolean(membership)}
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="Plan comparison"
          title="See which workflows unlock on each plan."
          description="Capacity grows with the workspace, and premium workflows unlock as your team needs more automation and control."
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
                        {row.getValue(plan)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-b border-border/40 last:border-b-0">
                  <td className="px-6 py-4 font-medium">Best fit</td>
                  {PLAN_ORDER.map((plan) => (
                    <td key={`best-fit-${plan}`} className="px-4 py-4 text-muted-foreground">
                      {bestFit[plan]}
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
