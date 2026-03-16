import Link from "next/link";
import type { SubscriptionPlan } from "@prisma/client";
import { CheckCircle2 } from "lucide-react";
import {
  formatAiScanLimit,
  formatAnnualSavings,
  formatLimit,
  formatPlanPricePerInterval,
  getPaystackPlanCode,
  getPlanConfig,
  PLAN_ORDER,
  type BillingInterval,
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
  STARTER: "Small Nigerian businesses validating their bookkeeping workflow before paying for automation.",
  GROWTH: "Startups and lean finance teams that want AI capture without moving into advanced controls yet.",
  PROFESSIONAL: "Accounting firms and finance operators managing multiple businesses with reconciliation and review needs.",
  ENTERPRISE: "Larger firms that need unlimited scale, integrations, and priority operational support.",
};

const planHighlights: Record<(typeof PLAN_ORDER)[number], string[]> = {
  STARTER: [
    "Manual bookkeeping, VAT summary, and core reports",
    "One business and one user to get started cleanly",
    "Best for testing the workflow before automation",
  ],
  GROWTH: [
    "Everything in Starter",
    "AI receipt scanning and bookkeeping automation",
    "Invoice management plus more businesses and AI volume",
  ],
  PROFESSIONAL: [
    "Everything in Growth",
    "Bank statement AI reconciliation and advanced reporting",
    "Tax filing assistant, audit logs, and team collaboration",
  ],
  ENTERPRISE: [
    "Everything in Professional",
    "Unlimited businesses, users, and AI scans",
    "API integrations, tax automation, and priority support",
  ],
};

type PricingGridProps = {
  compact?: boolean;
  interactive?: boolean;
  currentPlan?: SubscriptionPlan | null;
  loggedIn?: boolean;
  hasActiveWorkspace?: boolean;
  interval?: BillingInterval;
};

export function PricingGrid({
  compact = false,
  interactive = false,
  currentPlan = null,
  loggedIn = false,
  hasActiveWorkspace = false,
  interval = "MONTHLY",
}: PricingGridProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {PLAN_ORDER.map((plan) => {
        const config = getPlanConfig(plan);
        const savings = formatAnnualSavings(plan);
        const isFeatured = config.featured === true;
        const isConfigured =
          plan === "STARTER" || plan === "ENTERPRISE"
            ? true
            : Boolean(getPaystackPlanCode(plan, interval));

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
                <p className="text-sm text-muted-foreground">
                  {interval === "ANNUAL" ? "Annual subscription" : "Monthly subscription"}
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatPlanPricePerInterval(plan, interval)}
                </p>
                {interval === "ANNUAL" && savings ? (
                  <p className="mt-2 text-xs text-emerald-700">Save {savings} per year</p>
                ) : null}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">{planFit[plan]}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Best for: {config.target}
              </p>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Businesses</span>
                  <span className="font-medium">{formatLimit(config.maxBusinesses)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Users</span>
                  <span className="font-medium">{formatLimit(config.maxUsers)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">AI scans / month</span>
                  <span className="font-medium">{formatAiScanLimit(config.aiScansPerMonth)}</span>
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
                <div className="space-y-2">
                  <SubscriptionActionButton
                    plan={plan}
                    planName={config.name}
                    currentPlan={currentPlan}
                    loggedIn={loggedIn}
                    hasActiveWorkspace={hasActiveWorkspace}
                    billingInterval={interval}
                    disabled={!isConfigured}
                    variant={isFeatured ? "default" : "outline"}
                    className="w-full"
                  />
                  {!isConfigured ? (
                    <p className="text-xs text-muted-foreground">
                      Checkout for this billing interval still needs wiring.
                    </p>
                  ) : null}
                </div>
              ) : plan === "STARTER" ? (
                <Button asChild className="w-full" variant={isFeatured ? "default" : "outline"}>
                  <Link href="/signup">Start Free</Link>
                </Button>
              ) : plan === "ENTERPRISE" ? (
                <Button asChild className="w-full" variant={isFeatured ? "default" : "outline"}>
                  <Link href="/contact">Contact Sales</Link>
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
