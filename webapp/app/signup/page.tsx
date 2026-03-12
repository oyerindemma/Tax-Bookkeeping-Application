import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Start Free Plan",
  description: "Create a TaxBook account and start on the Free plan.",
};

export default function Signup() {
  return (
    <MarketingShell backgroundClassName="bg-[radial-gradient(circle_at_top,rgba(54,116,88,0.16),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(212,168,84,0.18),transparent_24%),linear-gradient(180deg,#f8f4ea_0%,#f7faf7_45%,#f3f6fb_100%)]">
      <SignupForm />
    </MarketingShell>
  );
}
