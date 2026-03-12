import Link from "next/link";
import type { SubscriptionPlan } from "@prisma/client";
import { CheckCircle2 } from "lucide-react";
import {
  PLAN_ORDER,
  formatLimit,
  formatPlanPricePerMonth,
  getPlanConfig,
} from "@/src/lib/billing";
import { SubscriptionActionButton } from "@/components/billing/subscription-action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const planFit: Record<(typeof PLAN_ORDER)[number], string> = {
  FREE: "Solo operators building a clean bookkeeping workflow before the team grows.",
  GROWTH: "Small teams that need AI-assisted capture and more operating headroom.",
  BUSINESS: "Finance teams that need banking workflows and recurring billing.",
  ACCOUNTANT: "Accounting firms and advanced operators who need controls, collaboration, and scale.",
};

const planHighlights: Record<(typeof PLAN_ORDER)[number], string[]> = {
  FREE: [
    "Invoices, clients, tax records, and reports",
    "One workspace member and essential bookkeeping workflows",
    "Great for solo operators getting started",
  ],
  GROWTH: [
    "Everything in Free",
    "AI receipt scanning and assistant workflows",
    "Higher member and record limits for growing teams",
  ],
  BUSINESS: [
    "Everything in Growth",
    "Bank accounts, statement imports, and reconciliation",
    "Recurring invoices for repeat client billing",
  ],
  ACCOUNTANT: [
    "Everything in Business",
    "Audit history and advanced team collaboration",
    "Built for firms and more complex finance operations",
  ],
};

type PricingGridProps = {
  compact?: boolean;
  interactive?: boolean;
  currentPlan?: SubscriptionPlan | null;
  loggedIn?: boolean;
  hasActiveWorkspace?: boolean;
};

export function PricingGrid({
  compact = false,
  interactive = false,
  currentPlan = null,
  loggedIn = false,
  hasActiveWorkspace = false,
}: PricingGridProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {PLAN_ORDER.map((plan) => {
        const config = getPlanConfig(plan);
        const isFeatured = plan === "BUSINESS";

        return (
          <Card
            key={plan}
            className={
              isFeatured
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border/60 bg-white/85 shadow-sm"
            }
          >
            <CardHeader className={compact ? "space-y-3" : undefined}>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{config.name}</CardTitle>
                {isFeatured ? <Badge>Recommended</Badge> : null}
              </div>
              <CardDescription>{config.description}</CardDescription>
            </CardHeader>
            <CardContent className={compact ? "space-y-4" : "space-y-5"}>
              <div>
                <p className="text-sm text-muted-foreground">Monthly subscription</p>
                <p className="mt-2 text-3xl font-semibold">{formatPlanPricePerMonth(plan)}</p>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">{planFit[plan]}</p>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Workspace members</span>
                  <span className="font-medium">{formatLimit(config.maxMembers)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Tax records</span>
                  <span className="font-medium">{formatLimit(config.maxRecords)}</span>
                </div>
              </div>

              {!compact ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  {planHighlights[plan].map((capability) => (
                    <div key={capability} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                      <span>{capability}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {interactive ? (
                <SubscriptionActionButton
                  plan={plan}
                  planName={config.name}
                  currentPlan={currentPlan}
                  loggedIn={loggedIn}
                  hasActiveWorkspace={hasActiveWorkspace}
                  variant={isFeatured ? "default" : "outline"}
                  className="w-full"
                />
              ) : plan === "FREE" ? (
                <Button asChild className="w-full" variant={isFeatured ? "default" : "outline"}>
                  <Link href="/signup">Get started free</Link>
                </Button>
              ) : (
                <Button asChild className="w-full" variant={isFeatured ? "default" : "outline"}>
                  <Link href="/pricing">View plan</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
