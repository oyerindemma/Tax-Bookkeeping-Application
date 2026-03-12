import { NextResponse } from "next/server";
import { getSessionFromCookies, getWorkspaceAuth } from "@/src/lib/auth";
import { logRouteError } from "@/src/lib/logger";
import { verifyPaystackTransaction } from "@/src/lib/paystack";
import {
  parseBillingMetadata,
  syncWorkspaceSubscriptionFromPaystackTransaction,
} from "@/src/lib/paystack-billing";

export const runtime = "nodejs";

function buildRedirect(requestUrl: string, query: string) {
  const url = new URL("/dashboard/billing", requestUrl);
  url.search = query;
  return url;
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const reference = url.searchParams.get("reference")?.trim();

  if (!reference) {
    return NextResponse.redirect(buildRedirect(req.url, "?error=missing_reference"));
  }

  try {
    const transaction = await verifyPaystackTransaction(reference);
    if (String(transaction.status).toLowerCase() !== "success") {
      return NextResponse.redirect(buildRedirect(req.url, "?canceled=1"));
    }

    const metadata = parseBillingMetadata(transaction.metadata);
    if (metadata.workspaceId) {
      const auth = await getWorkspaceAuth(metadata.workspaceId, session.userId);
      if (!auth) {
        return NextResponse.redirect(buildRedirect(req.url, "?error=workspace_access"));
      }
    }

    const synced = await syncWorkspaceSubscriptionFromPaystackTransaction(
      transaction,
      metadata.plan ?? null
    );
    if (!synced) {
      return NextResponse.redirect(buildRedirect(req.url, "?error=workspace_lookup"));
    }

    return NextResponse.redirect(buildRedirect(req.url, "?success=1"));
  } catch (error) {
    logRouteError("billing callback failed", error, { reference });
    return NextResponse.redirect(buildRedirect(req.url, "?error=verification_failed"));
  }
}
