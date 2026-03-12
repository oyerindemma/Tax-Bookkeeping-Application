import type { Metadata } from "next";
import { Mail, MapPin, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  COMPANY_DETAILS,
  CONTACT_CHECKLIST,
  CONTACT_EXPECTATIONS,
  CONTACT_PATHS,
  MARKETING_SUBHEADLINE,
} from "@/components/marketing/site-content";

export const metadata: Metadata = {
  title: "Contact",
  description: MARKETING_SUBHEADLINE,
};

export default function ContactPage() {
  return (
    <MarketingShell backgroundClassName="bg-[radial-gradient(circle_at_top_right,rgba(57,118,88,0.14),transparent_26%),linear-gradient(180deg,#f8f4ea_0%,#f8fbf8_48%,#f3f6fb_100%)]">
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="space-y-5">
          <Badge variant="secondary" className="rounded-full px-4 py-1.5">
            Contact sales
          </Badge>
          <h1 className="text-5xl font-semibold tracking-tight text-balance">
            Talk to the team about launch, rollout, or a live product walkthrough.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            {MARKETING_SUBHEADLINE}
          </p>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Whether you are evaluating TaxBook for one business or several client workspaces, we
            can walk through the operating model, pricing fit, and launch path.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={`mailto:${COMPANY_DETAILS.email}?subject=TaxBook%20Sales%20Inquiry`}>
                Email Sales
              </a>
            </Button>
            <MarketingCTAGroup
              compact
              showContactSales={false}
              showViewPricing
            />
          </div>
        </div>

        <Card className="border-border/60 bg-white/85 shadow-sm">
          <CardHeader>
            <CardTitle>Direct contact</CardTitle>
            <CardDescription>
              Use these launch channels for product, pricing, and rollout conversations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
              <Mail className="size-4 text-primary" />
              <a href={`mailto:${COMPANY_DETAILS.email}`} className="font-medium">
                {COMPANY_DETAILS.email}
              </a>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
              <PhoneCall className="size-4 text-primary" />
              <a href={`tel:${COMPANY_DETAILS.phone.replace(/\s+/g, "")}`} className="font-medium">
                {COMPANY_DETAILS.phone}
              </a>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
              <MapPin className="size-4 text-primary" />
              <span className="font-medium">{COMPANY_DETAILS.location}</span>
            </div>
            <div className="rounded-2xl border border-dashed bg-background px-4 py-4 text-muted-foreground">
              Response target: within one business day for launch and sales enquiries.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          badge="How we can help"
          title="Pick the conversation that matches your next step."
          description="These are the main public paths for launch conversations, demos, and onboarding support."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {CONTACT_PATHS.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title} className="border-border/60 bg-white/85">
                <CardHeader>
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="pt-4 text-xl">{item.title}</CardTitle>
                  <CardDescription className="leading-6">{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <a href={item.href}>{item.cta}</a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <Card className="border-border/60 bg-slate-950 text-slate-50">
            <CardContent className="grid gap-6 p-8">
              <div className="space-y-4">
                <Badge className="w-fit rounded-full bg-white/10 text-slate-50 hover:bg-white/10">
                  What to expect
                </Badge>
                <h2 className="text-3xl font-semibold tracking-tight">
                  Launch conversations stay focused on workflow fit.
                </h2>
                <p className="text-slate-300">
                  The best demo sessions are tied to your current invoicing, expense capture,
                  reporting, and workspace structure.
                </p>
              </div>
              <div className="grid gap-3">
                {CONTACT_EXPECTATIONS.map((item) => (
                  <div key={item} className="rounded-2xl bg-white/8 px-4 py-4 text-sm">
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-white/85">
            <CardHeader>
              <CardTitle>What to bring to the conversation</CardTitle>
              <CardDescription>
                A little context makes the walkthrough far more useful.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {CONTACT_CHECKLIST.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-2xl border bg-background p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <Card className="border-border/60 bg-white/85 shadow-sm">
          <CardContent className="flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Badge variant="secondary" className="rounded-full px-4 py-1.5">
                Prefer to explore first?
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight">
                Start with the product, then come back when you need rollout support.
              </h2>
              <p className="max-w-2xl text-muted-foreground">
                You can self-serve into the Free plan, review pricing, or log in if you already
                have access.
              </p>
            </div>
            <MarketingCTAGroup compact showContactSales={false} />
          </CardContent>
        </Card>
      </section>
    </MarketingShell>
  );
}
