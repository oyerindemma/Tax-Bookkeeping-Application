import "server-only";

import type { SubscriptionPlan, WorkspaceSubscription } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";

export type PlanFeature =
  | "AI_ASSISTANT"
  | "BANKING"
  | "RECURRING_INVOICES"
  | "AUDIT_LOG"
  | "TEAM_COLLABORATION";

export type PlanConfig = {
  id: SubscriptionPlan;
  name: string;
  description: string;
  monthlyPriceKobo: number;
  maxMembers: number | null;
  maxRecords: number | null;
  paystackPlanEnv: string | null;
};

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export const PLAN_CONFIG: Record<SubscriptionPlan, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Free",
    description: "Core bookkeeping for solo operators validating the workflow.",
    monthlyPriceKobo: 0,
    maxMembers: 1,
    maxRecords: 250,
    paystackPlanEnv: null,
  },
  GROWTH: {
    id: "GROWTH",
    name: "Growth",
    description: "For small teams ready to automate capture and daily review.",
    monthlyPriceKobo: 350000,
    maxMembers: 3,
    maxRecords: 2500,
    paystackPlanEnv: "PAYSTACK_PLAN_GROWTH",
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    description: "For finance teams that need banking workflows and recurring billing.",
    monthlyPriceKobo: 950000,
    maxMembers: 10,
    maxRecords: 15000,
    paystackPlanEnv: "PAYSTACK_PLAN_BUSINESS",
  },
  ACCOUNTANT: {
    id: "ACCOUNTANT",
    name: "Accountant",
    description: "For firms and advanced finance operators managing collaboration and audit controls.",
    monthlyPriceKobo: 2500000,
    maxMembers: 30,
    maxRecords: 100000,
    paystackPlanEnv: "PAYSTACK_PLAN_ACCOUNTANT",
  },
};

type FeatureConfig = {
  id: PlanFeature;
  name: string;
  description: string;
  requiredPlan: SubscriptionPlan;
};

export const FEATURE_CONFIG: Record<PlanFeature, FeatureConfig> = {
  AI_ASSISTANT: {
    id: "AI_ASSISTANT",
    name: "AI assistant and receipt scanning",
    description: "Use the workspace assistant, receipt scan, and draft suggestions.",
    requiredPlan: "GROWTH",
  },
  BANKING: {
    id: "BANKING",
    name: "Banking and reconciliation",
    description: "Connect accounts, import statements, and reconcile transactions.",
    requiredPlan: "BUSINESS",
  },
  RECURRING_INVOICES: {
    id: "RECURRING_INVOICES",
    name: "Recurring invoices",
    description: "Schedule repeat billing and generate invoices automatically.",
    requiredPlan: "BUSINESS",
  },
  AUDIT_LOG: {
    id: "AUDIT_LOG",
    name: "Audit log",
    description: "Review workspace activity history and operational controls.",
    requiredPlan: "ACCOUNTANT",
  },
  TEAM_COLLABORATION: {
    id: "TEAM_COLLABORATION",
    name: "Team collaboration",
    description: "Invite teammates and manage workspace roles.",
    requiredPlan: "ACCOUNTANT",
  },
};

const PLAN_RANK: Record<SubscriptionPlan, number> = {
  FREE: 0,
  GROWTH: 1,
  BUSINESS: 2,
  ACCOUNTANT: 3,
};

export const PLAN_ORDER: SubscriptionPlan[] = ["FREE", "GROWTH", "BUSINESS", "ACCOUNTANT"];

export function getPlanConfig(plan: SubscriptionPlan) {
  return PLAN_CONFIG[plan];
}

export function getFeatureConfig(feature: PlanFeature) {
  return FEATURE_CONFIG[feature];
}

export function formatPlanPrice(plan: SubscriptionPlan) {
  const amount = PLAN_CONFIG[plan].monthlyPriceKobo;
  return amount === 0 ? "Free" : currencyFormatter.format(amount / 100);
}

export function formatPlanPricePerMonth(plan: SubscriptionPlan) {
  const price = formatPlanPrice(plan);
  return price === "Free" ? price : `${price}/month`;
}

export function getPaystackPlanCode(plan: SubscriptionPlan) {
  const envName = PLAN_CONFIG[plan].paystackPlanEnv;
  if (!envName) return null;
  const value = process.env[envName];
  return value && value.trim().length > 0 ? value.trim() : null;
}

export function resolvePlanFromPaystackPlanCode(planCode: string | null | undefined) {
  if (!planCode) return null;
  const entries = Object.entries(PLAN_CONFIG) as [SubscriptionPlan, PlanConfig][];
  for (const [plan, config] of entries) {
    if (!config.paystackPlanEnv) continue;
    if (process.env[config.paystackPlanEnv] === planCode) return plan;
  }
  return null;
}

export function isPlanAtLeast(plan: SubscriptionPlan, requiredPlan: SubscriptionPlan) {
  return PLAN_RANK[plan] >= PLAN_RANK[requiredPlan];
}

export function hasPlanFeature(plan: SubscriptionPlan, feature: PlanFeature) {
  return isPlanAtLeast(plan, FEATURE_CONFIG[feature].requiredPlan);
}

export async function ensureWorkspaceSubscription(workspaceId: number) {
  return prisma.workspaceSubscription.upsert({
    where: { workspaceId },
    update: {},
    create: {
      workspaceId,
      plan: "FREE",
      status: "free",
    },
  });
}

export async function getWorkspaceSubscription(workspaceId: number) {
  return prisma.workspaceSubscription.findUnique({
    where: { workspaceId },
  });
}

export type FeatureAccessResult =
  | { ok: true; subscription: WorkspaceSubscription }
  | {
      ok: false;
      subscription: WorkspaceSubscription;
      plan: SubscriptionPlan;
      requiredPlan: SubscriptionPlan;
      feature: PlanFeature;
      error: string;
    };

export async function getWorkspaceFeatureAccess(
  workspaceId: number,
  feature: PlanFeature
): Promise<FeatureAccessResult> {
  const subscription = await ensureWorkspaceSubscription(workspaceId);
  if (hasPlanFeature(subscription.plan, feature)) {
    return { ok: true, subscription };
  }

  const featureConfig = getFeatureConfig(feature);
  return {
    ok: false,
    subscription,
    plan: subscription.plan,
    requiredPlan: featureConfig.requiredPlan,
    feature,
    error: `${featureConfig.name} requires the ${getPlanConfig(featureConfig.requiredPlan).name} plan or higher.`,
  };
}

export type PlanLimitResult =
  | { ok: true; plan: SubscriptionPlan; max: number | null; current: number }
  | { ok: false; plan: SubscriptionPlan; max: number; current: number; error: string };

export async function enforceRecordLimit(
  workspaceId: number,
  additionalRecords: number
): Promise<PlanLimitResult> {
  const subscription = await ensureWorkspaceSubscription(workspaceId);
  const planConfig = getPlanConfig(subscription.plan);
  const max = planConfig.maxRecords;
  const current = await prisma.taxRecord.count({ where: { workspaceId } });

  if (!max) {
    return { ok: true, plan: subscription.plan, max: null, current };
  }

  if (current + additionalRecords > max) {
    return {
      ok: false,
      plan: subscription.plan,
      max,
      current,
      error: `Plan limit reached. ${planConfig.name} allows up to ${max.toLocaleString()} records.`,
    };
  }

  return { ok: true, plan: subscription.plan, max, current };
}

export async function enforceMemberLimit(
  workspaceId: number,
  additionalMembers: number,
  includePendingInvites = false
): Promise<PlanLimitResult> {
  const subscription = await ensureWorkspaceSubscription(workspaceId);
  const planConfig = getPlanConfig(subscription.plan);
  const max = planConfig.maxMembers;

  const [memberCount, inviteCount] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId } }),
    includePendingInvites
      ? prisma.invite.count({
          where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
        })
      : Promise.resolve(0),
  ]);

  const current = memberCount + inviteCount;

  if (!max) {
    return { ok: true, plan: subscription.plan, max: null, current };
  }

  if (current + additionalMembers > max) {
    return {
      ok: false,
      plan: subscription.plan,
      max,
      current,
      error: `Plan limit reached. ${planConfig.name} allows up to ${max.toLocaleString()} members.`,
    };
  }

  return { ok: true, plan: subscription.plan, max, current };
}

export function formatLimit(value: number | null) {
  return value === null ? "Unlimited" : value.toLocaleString();
}

function humanizeStatus(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatSubscriptionStatus(subscription: WorkspaceSubscription | null) {
  if (!subscription) return "Free";
  const planName = getPlanConfig(subscription.plan).name;
  if (subscription.plan === "FREE" && normalizeStatusValue(subscription.status) === "free") {
    return planName;
  }
  if (!subscription.status) return planName;
  return `${planName} · ${humanizeStatus(subscription.status)}`;
}

function normalizeStatusValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}
