import { NextResponse } from "next/server";
import type { SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import {
  ensureWorkspaceSubscription,
  getPaystackPlanCode,
  getPlanConfig,
  PLAN_CONFIG,
} from "@/src/lib/billing";
import { getAppUrl } from "@/src/lib/env";
import { logRouteError } from "@/src/lib/logger";
import { initializePaystackTransaction } from "@/src/lib/paystack";
import {
  createSubscriptionCheckoutReference,
  serializeBillingMetadata,
} from "@/src/lib/paystack-billing";

export const runtime = "nodejs";

function isPlan(value: string): value is SubscriptionPlan {
  return value in PLAN_CONFIG;
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await requireRoleAtLeast(ctx.workspaceId, "OWNER");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const requestedPlan = String(body?.plan ?? "").toUpperCase();
    if (!isPlan(requestedPlan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    if (requestedPlan === "FREE") {
      return NextResponse.json(
        { error: "Free plan does not require checkout" },
        { status: 400 }
      );
    }

    const planCode = getPaystackPlanCode(requestedPlan);
    if (!planCode) {
      return NextResponse.json(
        { error: "Billing is not configured for this plan" },
        { status: 500 }
      );
    }

    const subscription = await ensureWorkspaceSubscription(ctx.workspaceId);
    if (subscription.plan === requestedPlan && subscription.status !== "free") {
      return NextResponse.json({ error: "This is already your active plan" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { email: true },
    });
    if (!user?.email) {
      return NextResponse.json({ error: "User email is required for checkout" }, { status: 400 });
    }

    const reference = createSubscriptionCheckoutReference(ctx.workspaceId, requestedPlan);
    const appUrl = getAppUrl();

    await prisma.workspaceSubscription.update({
      where: { workspaceId: ctx.workspaceId },
      data: {
        paystackPlanCode: planCode,
        paystackReference: reference,
      },
    });

    const checkout = await initializePaystackTransaction({
      email: user.email,
      amount: getPlanConfig(requestedPlan).monthlyPriceKobo,
      planCode,
      reference,
      callbackUrl: `${appUrl}/api/billing/callback`,
      metadata: serializeBillingMetadata({
        workspaceId: ctx.workspaceId,
        plan: requestedPlan,
        userId: ctx.userId,
        source: "pricing",
      }),
    });

    return NextResponse.json({ url: checkout.authorization_url });
  } catch (error) {
    logRouteError("billing checkout failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json(
      { error: "Server error creating checkout session" },
      { status: 500 }
    );
  }
}
