import { requireUser } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";
import {
  ensureWorkspaceSubscription,
  formatLimit,
  formatPlanPricePerMonth,
  formatSubscriptionStatus,
  getPaystackPlanCode,
  getPlanConfig,
  PLAN_ORDER,
} from "@/src/lib/billing";
import { SubscriptionActionButton } from "@/components/billing/subscription-action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type SearchParams = {
  success?: string | string[];
  canceled?: string | string[];
  error?: string | string[];
};

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedParams = await searchParams;
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
  const [memberCount, recordCount] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId: membership.workspaceId } }),
    prisma.taxRecord.count({ where: { workspaceId: membership.workspaceId } }),
  ]);

  const currentPlan = subscription.plan;
  const currentConfig = getPlanConfig(currentPlan);
  const statusLabel = formatSubscriptionStatus(subscription);
  const success = getSingleValue(resolvedParams?.success) === "1";
  const canceled = getSingleValue(resolvedParams?.canceled) === "1";
  const error = getSingleValue(resolvedParams?.error);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-muted-foreground">
          Workspace: <span className="font-medium text-foreground">{membership.workspace.name}</span>
        </p>
        <p className="text-muted-foreground">Manage Paystack subscriptions and plan access.</p>
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Current plan</CardDescription>
            <CardTitle className="text-xl">{currentConfig.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="secondary">{statusLabel}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Price</span>
              <span className="font-medium">{formatPlanPricePerMonth(currentPlan)}</span>
            </div>
            {subscription.currentPeriodEnd ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Next payment</span>
                <span className="font-medium">
                  {subscription.currentPeriodEnd.toLocaleDateString()}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Record usage</CardDescription>
            <CardTitle className="text-xl">{recordCount.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Limit</span>
              <span className="font-medium">{formatLimit(currentConfig.maxRecords)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Team members</CardDescription>
            <CardTitle className="text-xl">{memberCount.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Limit</span>
              <span className="font-medium">{formatLimit(currentConfig.maxMembers)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="grid gap-4 xl:grid-cols-4">
        {PLAN_ORDER.map((plan) => {
          const config = getPlanConfig(plan);
          const isCurrent = plan === currentPlan;
          const isConfigured = plan === "FREE" ? true : Boolean(getPaystackPlanCode(plan));

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
                <div className="text-2xl font-semibold">{formatPlanPricePerMonth(plan)}</div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Members</span>
                    <span className="font-medium">{formatLimit(config.maxMembers)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Records</span>
                    <span className="font-medium">{formatLimit(config.maxRecords)}</span>
                  </div>
                </div>
                {!isConfigured ? (
                  <p className="text-xs text-destructive">
                    Paystack plan code is not configured for this plan.
                  </p>
                ) : null}
                <SubscriptionActionButton
                  plan={plan}
                  planName={config.name}
                  currentPlan={currentPlan}
                  loggedIn
                  hasActiveWorkspace
                  disabled={!isConfigured}
                  className="w-full"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
