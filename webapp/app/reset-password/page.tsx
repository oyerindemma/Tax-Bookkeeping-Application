import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { validatePasswordResetToken } from "@/src/lib/auth";
import ResetPasswordForm from "./ResetPasswordForm";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Choose a new password for your TaxBook account.",
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;
  const validation = await validatePasswordResetToken(token);

  return (
    <MarketingShell backgroundClassName="bg-[radial-gradient(circle_at_top_left,rgba(57,118,88,0.14),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(212,168,84,0.16),transparent_24%),linear-gradient(180deg,#f8f4ea_0%,#f8fbf8_48%,#f3f7fb_100%)]">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.8fr)] lg:items-center">
          <div className="space-y-5">
            <h1 className="text-5xl font-semibold tracking-tight text-balance">
              Secure your account with a fresh password.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Reset links are single-use and expire automatically, so you can recover access
              without exposing the rest of your account.
            </p>
          </div>

          {validation.ok ? (
            <ResetPasswordForm token={token?.trim() ?? ""} />
          ) : (
            <Card className="border-border/60 bg-white/90 shadow-xl shadow-primary/10">
              <CardHeader>
                <CardTitle>Reset link unavailable</CardTitle>
                <CardDescription>{validation.error}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Request a fresh password reset link to continue.</p>
                <Link
                  href="/forgot-password"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Request a new reset link
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </MarketingShell>
  );
}
