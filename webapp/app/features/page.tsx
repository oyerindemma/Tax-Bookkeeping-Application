import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarketingCTAGroup } from "@/components/marketing/marketing-cta-group";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SectionHeading } from "@/components/marketing/section-heading";
import {
  FEATURE_PILLARS,
  FEATURE_WORKFLOWS,
  GOVERNANCE_FEATURES,
  MARKETING_SUBHEADLINE,
} from "@/components/marketing/site-content";

export const metadata: Metadata = {
  title: "Features",
  description: MARKETING_SUBHEADLINE,
};

export default function FeaturesPage() {
  return (
    <MarketingShell backgroundClassName="bg-[radial-gradient(circle_at_top_left,rgba(57,118,88,0.14),transparent_28%),linear-gradient(180deg,#f8f5ee_0%,#f6faf6_50%,#f3f7fb_100%)]">
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="space-y-5">
          <Badge variant="secondary" className="rounded-full px-4 py-1.5">
            Product features
          </Badge>
          <h1 className="text-5xl font-semibold tracking-tight text-balance">
            Built for the accounting workflows modern African businesses actually run.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            {MARKETING_SUBHEADLINE}
          </p>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            The feature set already covers the launch use cases: tax records, invoices, clients,
            reports, AI receipt scanning, workspace roles, and auditability.
          </p>
          <MarketingCTAGroup />
        </div>

        <Card className="border-border/60 bg-white/85 shadow-sm">
          <CardHeader>
            <CardTitle>Everything in one operating layer</CardTitle>
            <CardDescription>
              TaxBook is structured around the workflows teams run every week, not a generic list
              of disconnected modules.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            {[
              "Track tax records, invoices, clients, and expenses in the same workspace",
              "Prepare VAT and WHT reports from current operational data",
              "Use AI receipt scanning and assistant workflows with human review intact",
              "Collaborate with roles, workspace switching, and audit logs already in place",
            ].map((item) => (
              <div key={item} className="rounded-2xl border bg-background px-4 py-3">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="Feature pillars"
          title="The product is grouped around the finance outcomes teams actually care about."
          description="Each group reflects existing functionality in the application and keeps the public story aligned with what customers can use immediately."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {FEATURE_PILLARS.map((column) => (
            <Card key={column.title} className="border-border/60 bg-white/85">
              <CardHeader>
                <CardTitle>{column.title}</CardTitle>
                <CardDescription>{column.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {column.items.map((item) => (
                  <div key={item} className="rounded-2xl border bg-background px-4 py-3 leading-6">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="Operational workflows"
          title="Designed around the moments that matter most in day-to-day finance work."
          description="From receipts and invoices through to reporting and multi-workspace collaboration, the product keeps the next step close at hand."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {FEATURE_WORKFLOWS.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title} className="border-border/60 bg-white/80">
                <CardHeader className="space-y-4">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                    <CardDescription className="mt-2 leading-6">
                      {item.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="Control layer"
          title="Team collaboration stays structured as the business grows."
          description="Role-based access, workspace isolation, and audit history are part of the public product story because they are already part of the product."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {GOVERNANCE_FEATURES.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title} className="border-border/60 bg-slate-950 text-slate-50">
                <CardHeader>
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-slate-50">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="pt-4 text-xl">{item.title}</CardTitle>
                  <CardDescription className="text-slate-300">{item.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <Card className="border-border/60 bg-white/85 shadow-sm">
          <CardContent className="flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Badge variant="secondary" className="rounded-full px-4 py-1.5">
                Ready to explore the product?
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight">
                See how TaxBook fits your accounting workflow.
              </h2>
              <p className="max-w-2xl text-muted-foreground">
                Start on Free or talk through your rollout on a live walkthrough.
              </p>
            </div>
            <MarketingCTAGroup compact />
          </CardContent>
        </Card>
      </section>
    </MarketingShell>
  );
}
