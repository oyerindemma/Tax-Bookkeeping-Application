import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { redirectIfAuthenticated } from "@/src/lib/auth";
import { buildMarketingMetadata } from "@/src/lib/marketing-metadata";
import SignupForm from "./SignupForm";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Start Free",
  description: "Create a TaxBook AI account and start on the Starter plan for free.",
  path: "/signup",
});

export default async function Signup() {
  await redirectIfAuthenticated();

  return (
    <MarketingShell backgroundClassName="bg-[radial-gradient(circle_at_top,rgba(54,116,88,0.16),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(212,168,84,0.18),transparent_24%),linear-gradient(180deg,#f8f4ea_0%,#f7faf7_45%,#f3f6fb_100%)]">
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="rounded-3xl border border-border/60 bg-white/80 px-6 py-10 text-muted-foreground">
              Loading signup...
            </div>
          </div>
        }
      >
        <SignupForm />
      </Suspense>
    </MarketingShell>
  );
}
