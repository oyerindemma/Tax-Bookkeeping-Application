import Link from "next/link";
import { requireUser } from "@/src/lib/auth";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";
import {
  ADD_ON_CONFIG,
  ensureWorkspaceSubscription,
  formatAiScanLimit,
  formatAnnualSavings,
  formatBillingIntervalLabel,
  formatLimit,
  formatPlanPricePerInterval,
  formatSubscriptionStatus,
  getPaystackPlanCode,
  getPlanConfig,
  getWorkspaceSubscriptionBillingInterval,
  getWorkspaceUsageSnapshot,
  PLAN_ORDER,
  type BillingInterval,
} from "@/src/lib/billing";
import { SubscriptionActionButton } from "@/components/billing/subscription-action-button";
import { SubscriptionManagementActions } from "@/components/billing/subscription-management-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPaymentRuntimeConfig } from "@/src/lib/env";

type SearchParams = {
  success?: string | string[];
  canceled?: string | string[];
  error?: string | string[];
  interval?: string | string[];
};

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveInterval(value: string | string[] | undefined): BillingInterval {
  return getSingleValue(value)?.toLowerCase() === "annual" ? "ANNUAL" : "MONTHLY";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedParams = await searchParams;
  const interval = resolveInterval(resolvedParams?.interval);
  const user = await requireUser();
  const membership = await getActiveWorkspaceMembership(user.id);

  if (!membership) {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-muted-foreground">No workspace assigned.</p>
      </section>
    );
  }

  const subscription = await ensureWorkspaceSubscription(membership.workspaceId);
  const usage = await getWorkspaceUsageSnapshot(membership.workspaceId);
  const currentPlan = subscription.plan;
  const currentConfig = getPlanConfig(currentPlan);
  const statusLabel = formatSubscriptionStatus(subscription);
  const subscriptionInterval = getWorkspaceSubscriptionBillingInterval(subscription);
  const allowStubPayments = getPaymentRuntimeConfig().allowStubPayments;
  const success = getSingleValue(resolvedParams?.success) === "1";
  const canceled = getSingleValue(resolvedParams?.canceled) === "1";
  const error = getSingleValue(resolvedParams?.error);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Billing</h1>
          <Badge variant="secondary">{currentConfig.name}</Badge>
          <Badge variant="outline">{statusLabel}</Badge>
        </div>
        <p className="text-muted-foreground">
          Workspace: <span className="font-medium text-foreground">{membership.workspace.name}</span>
        </p>
        <p className="text-muted-foreground">
          Review plan capacity, compare annual versus monthly pricing, and route upgrades from one
          place.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant={interval === "MONTHLY" ? "default" : "outline"}>
          <Link href="/dashboard/billing?interval=monthly">Monthly pricing</Link>
        </Button>
        <Button asChild variant={interval === "ANNUAL" ? "default" : "outline"}>
          <Link href="/dashboard/billing?interval=annual">Annual pricing</Link>
        </Button>
        <Badge variant="outline">Annual prices already include the 20% discount</Badge>
      </div>

      {success ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4 text-sm text-green-800">
            Subscription updated successfully.
          </CardContent>
        </Card>
      ) : null}
      {canceled ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-800">
            Checkout was not completed. Your workspace plan was not changed.
          </CardContent>
        </Card>
      ) : null}
      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">
            Billing verification failed: {error.replace(/_/g, " ")}.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardDescription>Current plan</CardDescription>
            <CardTitle className="text-2xl">{currentConfig.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Billing interval</div>
                <div className="mt-1 font-semibold">
                  {formatBillingIntervalLabel(subscriptionInterval)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Monthly</div>
                <div className="mt-1 font-semibold">
                  {formatPlanPricePerInterval(currentPlan, "MONTHLY")}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Annual</div>
                <div className="mt-1 font-semibold">
                  {formatPlanPricePerInterval(currentPlan, "ANNUAL")}
                </div>
              </div>
            </div>
            <p className="text-muted-foreground">{currentConfig.description}</p>
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="uppercase tracking-wide">Billing status</span>
                <div className="mt-1 text-sm font-medium text-foreground">{statusLabel}</div>
              </div>
              <div>
                <span className="uppercase tracking-wide">Current renewal</span>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {formatPlanPricePerInterval(currentPlan, subscriptionInterval)}
                </div>
              </div>
              {subscription.paystackReference ? (
                <div className="sm:col-span-2">
                  <span className="uppercase tracking-wide">Latest reference</span>
                  <div className="mt-1 break-all text-sm font-medium text-foreground">
                    {subscription.paystackReference}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="grid gap-2 text-muted-foreground">
              {currentConfig.includes.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </div>
            {currentPlan !== "ENTERPRISE" && formatAnnualSavings(currentPlan) ? (
              <p className="text-xs text-emerald-700">
                Annual billing saves {formatAnnualSavings(currentPlan)} versus twelve monthly payments.
              </p>
            ) : null}
            {subscription.currentPeriodEnd ? (
              <p className="text-xs text-muted-foreground">
                Next payment date: {subscription.currentPeriodEnd.toLocaleDateString()}
              </p>
            ) : null}
            <SubscriptionManagementActions
              canManage={currentPlan !== "STARTER" && (Boolean(subscription.paystackSubscriptionCode) || allowStubPayments)}
              canCancel={
                currentPlan !== "STARTER" &&
                (Boolean(
                  subscription.paystackSubscriptionCode && subscription.paystackSubscriptionToken
                ) ||
                  allowStubPayments)
              }
              canVerify={Boolean(subscription.paystackReference)}
              reference={subscription.paystackReference}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Client businesses</CardDescription>
            <CardTitle className="text-xl">{usage.currentBusinesses.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Included</span>
              <span className="font-medium">{formatLimit(usage.maxBusinesses)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>AI scans this month</CardDescription>
            <CardTitle className="text-xl">{usage.currentAiScansThisMonth.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Included</span>
              <span className="font-medium">{formatAiScanLimit(usage.aiScansPerMonth)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Users</CardDescription>
            <CardTitle className="text-xl">{usage.currentUsers.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Included</span>
              <span className="font-medium">{formatLimit(usage.maxUsers)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Team collaboration unlocks on Professional and Enterprise.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Upgrade guidance</CardDescription>
            <CardTitle className="text-xl">
              {currentPlan === "ENTERPRISE" ? "Top tier active" : "Next best move"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {currentPlan === "STARTER" ? (
              <p>Move to Growth when you need AI receipt scanning or more than one business.</p>
            ) : null}
            {currentPlan === "GROWTH" ? (
              <p>Move to Professional when you need banking reconciliation, audit logs, or team collaboration.</p>
            ) : null}
            {currentPlan === "PROFESSIONAL" ? (
              <p>
                If you are nearing 25 businesses or 2,000 AI scans monthly, Enterprise or future
                add-ons are the next step.
              </p>
            ) : null}
            {currentPlan === "ENTERPRISE" ? (
              <p>Enterprise already includes unlimited businesses, users, scans, and top-tier support.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Add-on readiness</CardDescription>
            <CardTitle className="text-xl">Structured for later</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Extra businesses, extra AI scans, and tax filing automation add-ons are modeled in
              config now.
            </p>
            <p>Self-serve add-on checkout still needs implementation before those can be sold.</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Plan catalog</h2>
          <p className="text-muted-foreground">
            Compare the current interval pricing against the included limits and upgrade paths.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          {PLAN_ORDER.map((plan) => {
            const config = getPlanConfig(plan);
            const isCurrent = plan === currentPlan;
            const isConfigured =
              plan === "STARTER" || plan === "ENTERPRISE"
                ? true
                : Boolean(getPaystackPlanCode(plan, interval));

            return (
              <Card key={plan} className={isCurrent ? "border-primary" : undefined}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{config.name}</CardTitle>
                    {isCurrent ? <Badge>Current</Badge> : null}
                  </div>
                  <CardDescription>{config.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="text-2xl font-semibold">
                    {formatPlanPricePerInterval(plan, interval)}
                  </div>
                  {interval === "ANNUAL" && formatAnnualSavings(plan) ? (
                    <p className="text-xs text-emerald-700">
                      Save {formatAnnualSavings(plan)} per year
                    </p>
                  ) : null}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Businesses</span>
                      <span className="font-medium">{formatLimit(config.maxBusinesses)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Users</span>
                      <span className="font-medium">{formatLimit(config.maxUsers)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">AI scans / month</span>
                      <span className="font-medium">{formatAiScanLimit(config.aiScansPerMonth)}</span>
                    </div>
                  </div>
                  {!isConfigured ? (
                    <p className="text-xs text-destructive">
                      Checkout is not configured for this interval yet.
                    </p>
                  ) : null}
                  <SubscriptionActionButton
                    plan={plan}
                    planName={config.name}
                    currentPlan={currentPlan}
                    loggedIn
                    hasActiveWorkspace
                    billingInterval={interval}
                    disabled={!isConfigured}
                    className="w-full"
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.values(ADD_ON_CONFIG).map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardDescription>{item.name}</CardDescription>
              <CardTitle className="text-lg">
                {(item.monthlyPriceKobo / 100).toLocaleString("en-NG", {
                  style: "currency",
                  currency: "NGN",
                  maximumFractionDigits: 0,
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {item.description} {item.unitLabel}.
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
