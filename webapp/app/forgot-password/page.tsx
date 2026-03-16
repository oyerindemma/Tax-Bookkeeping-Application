import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { redirectIfAuthenticated } from "@/src/lib/auth";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Request a secure TaxBook password reset link.",
};

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated();

  return (
    <MarketingShell backgroundClassName="bg-[radial-gradient(circle_at_top_left,rgba(57,118,88,0.14),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(212,168,84,0.16),transparent_24%),linear-gradient(180deg,#f8f4ea_0%,#f8fbf8_48%,#f3f7fb_100%)]">
      <ForgotPasswordForm />
    </MarketingShell>
  );
}
