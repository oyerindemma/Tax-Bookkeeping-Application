import { NextResponse } from "next/server";
import { logAudit } from "@/src/lib/audit";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { ensureWorkspaceSubscription } from "@/src/lib/billing";
import { getPaymentRuntimeConfig, hasPaystackServerConfig } from "@/src/lib/env";
import { logRouteError } from "@/src/lib/logger";
import { sendPaystackSubscriptionManagementEmail } from "@/src/lib/paystack";

export const runtime = "nodejs";

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await requireRoleAtLeast(ctx.workspaceId, "OWNER");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const subscription = await ensureWorkspaceSubscription(ctx.workspaceId);
    if (subscription.plan === "STARTER") {
      return NextResponse.json(
        { error: "Starter workspaces do not have a managed Paystack subscription" },
        { status: 400 }
      );
    }

    const allowStubPayments = getPaymentRuntimeConfig().allowStubPayments;
    if (!hasPaystackServerConfig()) {
      if (!allowStubPayments) {
        return NextResponse.json(
          { error: "Billing management is not configured on this environment" },
          { status: 503 }
        );
      }

      return NextResponse.json({
        ok: true,
        stubbed: true,
        message: "Local test mode is active. No Paystack management email was sent.",
      });
    }

    if (!subscription.paystackSubscriptionCode) {
      return NextResponse.json(
        { error: "No Paystack subscription code is stored for this workspace" },
        { status: 400 }
      );
    }

    await sendPaystackSubscriptionManagementEmail(subscription.paystackSubscriptionCode);

    await logAudit({
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      action: "SUBSCRIPTION_MANAGEMENT_LINK_REQUESTED",
      metadata: {
        paystackSubscriptionCode: subscription.paystackSubscriptionCode,
        plan: subscription.plan,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Paystack will email the subscription management link to the billing contact on file.",
    });
  } catch (error) {
    logRouteError("billing manage failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to request management link" },
      { status: 500 }
    );
  }
}
