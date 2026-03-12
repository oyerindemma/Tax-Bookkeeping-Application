import "server-only";

import type { SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { resolvePlanFromPaystackPlanCode } from "@/src/lib/billing";
import type {
  PaystackCustomer,
  PaystackSubscriptionPayload,
  PaystackTransactionVerificationData,
} from "@/src/lib/paystack";

export type BillingMetadata = {
  workspaceId?: number | null;
  plan?: SubscriptionPlan | null;
  userId?: number | null;
  source?: string | null;
};

function parseInteger(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStatus(status: string | null | undefined) {
  return parseString(status)?.toLowerCase() ?? null;
}

function parsePlan(value: unknown): SubscriptionPlan | null {
  const normalized = parseString(value)?.toUpperCase();
  if (
    normalized === "FREE" ||
    normalized === "GROWTH" ||
    normalized === "BUSINESS" ||
    normalized === "ACCOUNTANT"
  ) {
    return normalized;
  }
  return null;
}

function resolveCustomerCode(customer: PaystackCustomer | string | null | undefined) {
  if (!customer) return null;
  if (typeof customer === "string") return parseString(customer);
  return parseString(customer.customer_code);
}

function resolvePlanCode(
  transactionPlanObject: { plan_code?: string | null } | null | undefined,
  subscriptionPlan: PaystackSubscriptionPayload["plan"]
) {
  if (transactionPlanObject?.plan_code) return transactionPlanObject.plan_code;
  if (!subscriptionPlan) return null;
  if (typeof subscriptionPlan === "string") return parseString(subscriptionPlan);
  return parseString(subscriptionPlan.plan_code);
}

async function findSubscriptionTarget(input: {
  workspaceId?: number | null;
  paystackSubscriptionCode?: string | null;
  paystackCustomerCode?: string | null;
  paystackReference?: string | null;
}) {
  if (input.workspaceId) {
    return prisma.workspaceSubscription.findUnique({
      where: { workspaceId: input.workspaceId },
    });
  }

  if (input.paystackSubscriptionCode) {
    const bySubscription = await prisma.workspaceSubscription.findFirst({
      where: { paystackSubscriptionCode: input.paystackSubscriptionCode },
    });
    if (bySubscription) return bySubscription;
  }

  if (input.paystackReference) {
    const byReference = await prisma.workspaceSubscription.findFirst({
      where: { paystackReference: input.paystackReference },
    });
    if (byReference) return byReference;
  }

  if (input.paystackCustomerCode) {
    const byCustomer = await prisma.workspaceSubscription.findFirst({
      where: { paystackCustomerCode: input.paystackCustomerCode },
    });
    if (byCustomer) return byCustomer;
  }

  return null;
}

export function createSubscriptionCheckoutReference(
  workspaceId: number,
  plan: SubscriptionPlan
) {
  return `sub_${workspaceId}_${plan}_${Date.now()}`;
}

export function serializeBillingMetadata(metadata: BillingMetadata) {
  return JSON.stringify(metadata);
}

export function parseBillingMetadata(value: unknown): BillingMetadata {
  if (!value) return {};

  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return {};
    }
  }

  if (!raw || typeof raw !== "object") return {};

  const candidate = raw as Record<string, unknown>;
  return {
    workspaceId: parseInteger(candidate.workspaceId),
    plan: parsePlan(candidate.plan),
    userId: parseInteger(candidate.userId),
    source: parseString(candidate.source),
  };
}

function resolvePlanCandidate(values: Array<SubscriptionPlan | null | undefined>) {
  for (const value of values) {
    if (value) return value;
  }
  return null;
}

export async function syncWorkspaceSubscriptionFromPaystackTransaction(
  transaction: PaystackTransactionVerificationData,
  planHint?: SubscriptionPlan | null
) {
  const metadata = parseBillingMetadata(transaction.metadata);
  const customerCode = resolveCustomerCode(transaction.customer);
  const subscriptionCode = parseString(transaction.subscription?.subscription_code);
  const subscriptionToken = parseString(transaction.subscription?.email_token);
  const planCode = resolvePlanCode(transaction.plan_object, transaction.subscription?.plan);
  const plan = resolvePlanCandidate([
    resolvePlanFromPaystackPlanCode(planCode),
    planHint,
    metadata.plan,
  ]);
  const existing = await findSubscriptionTarget({
    workspaceId: metadata.workspaceId,
    paystackSubscriptionCode: subscriptionCode,
    paystackCustomerCode: customerCode,
    paystackReference: parseString(transaction.reference),
  });

  const targetWorkspaceId = metadata.workspaceId ?? existing?.workspaceId ?? null;
  if (!targetWorkspaceId) return null;

  const currentPeriodEnd = parseDate(transaction.subscription?.next_payment_date);
  const status = normalizeStatus(transaction.subscription?.status) ?? normalizeStatus(transaction.status);
  const finalPlan = plan ?? existing?.plan ?? "FREE";

  return prisma.workspaceSubscription.upsert({
    where: { workspaceId: targetWorkspaceId },
    update: {
      plan: finalPlan,
      status: status ?? (finalPlan === "FREE" ? "free" : "active"),
      paystackCustomerCode: customerCode ?? undefined,
      paystackSubscriptionCode: subscriptionCode ?? undefined,
      paystackSubscriptionToken: subscriptionToken ?? undefined,
      paystackPlanCode: planCode ?? undefined,
      paystackReference: parseString(transaction.reference) ?? undefined,
      currentPeriodEnd,
    },
    create: {
      workspaceId: targetWorkspaceId,
      plan: finalPlan,
      status: status ?? (finalPlan === "FREE" ? "free" : "active"),
      paystackCustomerCode: customerCode ?? undefined,
      paystackSubscriptionCode: subscriptionCode ?? undefined,
      paystackSubscriptionToken: subscriptionToken ?? undefined,
      paystackPlanCode: planCode ?? undefined,
      paystackReference: parseString(transaction.reference) ?? undefined,
      currentPeriodEnd,
    },
  });
}

export async function syncWorkspaceSubscriptionFromPaystackSubscription(
  subscription: PaystackSubscriptionPayload,
  options: {
    metadata?: BillingMetadata;
    statusHint?: string | null;
    forceFree?: boolean;
  } = {}
) {
  const metadata = options.metadata ?? parseBillingMetadata(subscription.metadata);
  const customerCode = resolveCustomerCode(subscription.customer);
  const subscriptionCode = parseString(subscription.subscription_code);
  const subscriptionToken = parseString(subscription.email_token);
  const planCode = resolvePlanCode(null, subscription.plan);
  const plan = resolvePlanCandidate([
    resolvePlanFromPaystackPlanCode(planCode),
    metadata.plan,
  ]);
  const existing = await findSubscriptionTarget({
    workspaceId: metadata.workspaceId,
    paystackSubscriptionCode: subscriptionCode,
    paystackCustomerCode: customerCode,
  });

  const targetWorkspaceId = metadata.workspaceId ?? existing?.workspaceId ?? null;
  if (!targetWorkspaceId) return null;

  const forceFree = options.forceFree === true;
  const currentPeriodEnd = parseDate(subscription.next_payment_date);
  const status =
    normalizeStatus(options.statusHint) ??
    normalizeStatus(subscription.status) ??
    (forceFree ? "free" : null);
  const finalPlan = forceFree ? "FREE" : plan ?? existing?.plan ?? "FREE";

  return prisma.workspaceSubscription.upsert({
    where: { workspaceId: targetWorkspaceId },
    update: {
      plan: finalPlan,
      status: status ?? (finalPlan === "FREE" ? "free" : "active"),
      paystackCustomerCode: customerCode ?? undefined,
      paystackSubscriptionCode: subscriptionCode ?? undefined,
      paystackSubscriptionToken: subscriptionToken ?? undefined,
      paystackPlanCode: planCode ?? undefined,
      currentPeriodEnd,
    },
    create: {
      workspaceId: targetWorkspaceId,
      plan: finalPlan,
      status: status ?? (finalPlan === "FREE" ? "free" : "active"),
      paystackCustomerCode: customerCode ?? undefined,
      paystackSubscriptionCode: subscriptionCode ?? undefined,
      paystackSubscriptionToken: subscriptionToken ?? undefined,
      paystackPlanCode: planCode ?? undefined,
      currentPeriodEnd,
    },
  });
}
