"use client";

import Link from "next/link";
import { useState } from "react";
import type { SubscriptionPlan } from "@prisma/client";
import { Button } from "@/components/ui/button";

type ButtonVariant = "default" | "outline" | "secondary";

type SubscriptionActionButtonProps = {
  plan: SubscriptionPlan;
  planName: string;
  currentPlan: SubscriptionPlan | null;
  loggedIn: boolean;
  hasActiveWorkspace: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  className?: string;
};

function buildLabel(input: {
  plan: SubscriptionPlan;
  planName: string;
  currentPlan: SubscriptionPlan | null;
  loggedIn: boolean;
  hasActiveWorkspace: boolean;
  loading: boolean;
}) {
  if (input.currentPlan === input.plan) return "Current plan";
  if (input.loading) return "Redirecting...";
  if (input.plan === "FREE") {
    return input.loggedIn ? "Manage free plan" : "Get started free";
  }
  if (!input.loggedIn) return `Choose ${input.planName}`;
  if (!input.hasActiveWorkspace) return "Create workspace";
  return `Upgrade to ${input.planName}`;
}

function getHref(input: {
  plan: SubscriptionPlan;
  currentPlan: SubscriptionPlan | null;
  loggedIn: boolean;
  hasActiveWorkspace: boolean;
}) {
  if (input.currentPlan === input.plan) return null;
  if (!input.loggedIn) return "/signup";
  if (!input.hasActiveWorkspace) return "/dashboard/workspaces";
  if (input.plan === "FREE") return "/dashboard/billing";
  return null;
}

export function SubscriptionActionButton({
  plan,
  planName,
  currentPlan,
  loggedIn,
  hasActiveWorkspace,
  disabled = false,
  variant = "default",
  className,
}: SubscriptionActionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const href = getHref({
    plan,
    currentPlan,
    loggedIn,
    hasActiveWorkspace,
  });

  const label = buildLabel({
    plan,
    planName,
    currentPlan,
    loggedIn,
    hasActiveWorkspace,
    loading,
  });

  async function handleCheckout() {
    if (disabled || loading || currentPlan === plan) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Unable to start checkout");
        return;
      }
      if (!data?.url) {
        setError("Checkout URL missing");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Network error starting checkout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {href ? (
        <Button asChild variant={variant} className={className}>
          <Link href={href}>{label}</Link>
        </Button>
      ) : (
        <Button
          type="button"
          onClick={handleCheckout}
          disabled={disabled || loading || currentPlan === plan}
          variant={currentPlan === plan ? "secondary" : variant}
          className={className}
        >
          {label}
        </Button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
