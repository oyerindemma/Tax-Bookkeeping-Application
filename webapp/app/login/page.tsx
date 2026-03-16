import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { redirectIfAuthenticated } from "@/src/lib/auth";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Log in to your TaxBook workspace.",
};

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <MarketingShell backgroundClassName="bg-[radial-gradient(circle_at_top_left,rgba(57,118,88,0.16),transparent_28%),linear-gradient(180deg,#f8f4ea_0%,#f8fbf8_48%,#f3f7fb_100%)]">
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="rounded-3xl border border-border/60 bg-white/80 px-6 py-10 text-muted-foreground">
              Loading login...
            </div>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </MarketingShell>
  );
}
