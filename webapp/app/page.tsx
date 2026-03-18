import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { PreviewCardStack } from "@/components/marketing/preview-card-stack";
import { SectionHeading } from "@/components/marketing/section-heading";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BillingInterval } from "@/src/lib/billing";
import { buildMarketingMetadata } from "@/src/lib/marketing-metadata";
import {
  HERO_STATS,
  HOME_FEATURE_BLOCKS,
  HOME_WORKFLOW_STEPS,
  MARKETING_HEADLINE,
  MARKETING_SUBHEADLINE,
  VALUE_STRIP,
  WHO_IT_IS_FOR,
} from "@/components/marketing/site-content";

type SearchParams = {
  interval?: string | string[];
};

export const metadata: Metadata = buildMarketingMetadata({
  title: "AI Accounting Software for Nigerian Businesses",
  description:
    "TaxBook AI helps Nigerian businesses, finance teams, and accounting firms handle AI receipt scanning, bookkeeping review, bank reconciliation, VAT and WHT summaries, and multi-business workspaces.",
  path: "/",
  keywords: [
    "AI accounting software Nigeria",
    "Nigerian bookkeeping software",
    "VAT and WHT automation Nigeria",
  ],
});

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveInterval(value: string | string[] | undefined): BillingInterval {
  return getSingleValue(value)?.toLowerCase() === "annual" ? "ANNUAL" : "MONTHLY";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedParams = await searchParams;
  const interval = resolveInterval(resolvedParams?.interval);

  return (
    <MarketingShell backgroundClassName="bg-[radial-gradient(circle_at_top_left,rgba(57,118,88,0.16),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(212,168,84,0.18),transparent_22%),linear-gradient(180deg,#f7f2e7_0%,#f8fbf8_42%,#f2f6fb_100%)]">
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-center">
        <div className="space-y-7">
          <div className="space-y-4">
            <Badge variant="secondary" className="rounded-full px-4 py-1.5">
              Nigeria-first finance operating layer
            </Badge>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
              {MARKETING_HEADLINE}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              {MARKETING_SUBHEADLINE}
            </p>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Built for businesses, finance teams, and accounting firms that want faster month-end
              work without giving up review control, workspace structure, or audit visibility.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Start Free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">View Pricing</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/contact">Book Demo</Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">AI receipt scanning</Badge>
            <Badge variant="outline">Bookkeeping review</Badge>
            <Badge variant="outline">Bank reconciliation</Badge>
            <Badge variant="outline">VAT and WHT summaries</Badge>
            <Badge variant="outline">Audit-friendly workflows</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {HERO_STATS.map((item) => (
              <Card key={item.label} className="border-border/60 bg-white/85 shadow-sm">
                <CardContent className="space-y-2 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    {item.label}
                  </div>
                  <div className="text-lg font-semibold leading-7 text-foreground">
                    {item.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <PreviewCardStack />
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-4 lg:grid-cols-5">
          {VALUE_STRIP.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title} className="border-border/60 bg-white/80 shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="How it works"
          title="From upload to filing-ready output, the workflow stays in one system."
          description="TaxBook AI is designed to help accountants and finance operators move from source documents into reviewed books, reconciled cash activity, tax summaries, and filing-ready outputs without stitching multiple tools together."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-4">
          {HOME_WORKFLOW_STEPS.map((item) => (
            <Card key={item.step} className="border-border/60 bg-white/85 shadow-sm">
              <CardHeader className="space-y-4">
                <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                  Step {item.step}
                </Badge>
                <div>
                  <CardTitle className="text-2xl">{item.title}</CardTitle>
                  <CardDescription className="mt-3 leading-6">
                    {item.description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="Core modules"
          title="The public story now matches what the product actually does."
          description="These modules map directly to the product experience inside TaxBook AI today: AI capture, review, banking, tax visibility, filing workflows, client-business management, and grounded assistant support."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {HOME_FEATURE_BLOCKS.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title} className="border-border/60 bg-white/85 shadow-sm">
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {item.badge}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    <CardTitle className="text-2xl leading-8">{item.title}</CardTitle>
                    <CardDescription className="leading-6">{item.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {item.points.map((point) => (
                    <div key={point} className="rounded-2xl border bg-background px-4 py-3 leading-6">
                      {point}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="Who it is for"
          title="Built for the teams that live with the numbers every week."
          description="TaxBook AI is positioned for Nigerian SMEs, finance operators, and accounting firms that need stronger bookkeeping and tax control without extra operational sprawl."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {WHO_IT_IS_FOR.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title} className="border-border/60 bg-slate-950 text-slate-50">
                <CardHeader className="space-y-4">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-slate-50">
                    <Icon className="size-5" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-2xl">{item.title}</CardTitle>
                    <CardDescription className="leading-6 text-slate-300">
                      {item.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-200">
                  {item.outcomes.map((outcome) => (
                    <div key={outcome} className="rounded-2xl bg-white/8 px-4 py-3 leading-6">
                      {outcome}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="Pricing preview"
          title="Start on Starter, then unlock AI and reconciliation when the workload grows."
          description="Growth unlocks AI receipt scanning and bookkeeping automation. Professional unlocks bank reconciliation, audit-friendly review, and filing-ready tax workflows. Enterprise is sales-led."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant={interval === "MONTHLY" ? "default" : "outline"}>
                <Link href="/?interval=monthly">Monthly</Link>
              </Button>
              <Button asChild variant={interval === "ANNUAL" ? "default" : "outline"}>
                <Link href="/?interval=annual">Annual</Link>
              </Button>
            </div>
          }
        />
        <div className="mt-10">
          <PricingGrid compact interval={interval} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <Card className="overflow-hidden border-border/60 bg-slate-950 text-slate-50 shadow-sm">
          <CardContent className="flex flex-col gap-8 p-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <Badge className="w-fit rounded-full bg-white/10 text-slate-50 hover:bg-white/10">
                Launch-ready public site
              </Badge>
              <div className="space-y-3">
                <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                  Give your team one operating layer for receipts, banking, tax visibility, and
                  filing-ready close workflows.
                </h2>
                <p className="max-w-2xl text-base leading-7 text-slate-300">
                  Start on Starter for free, move into Growth for AI-assisted capture, or upgrade
                  to Professional when reconciliation, review control, and filing workflows become
                  critical.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-white/90">
                <Link href="/signup">Start Free</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-slate-50 hover:bg-white/10 hover:text-slate-50"
              >
                <Link href="/contact">Book Demo</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </MarketingShell>
  );
}
