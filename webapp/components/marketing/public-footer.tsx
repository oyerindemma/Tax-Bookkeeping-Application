import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  COMPANY_DETAILS,
  MARKETING_HEADLINE,
  MARKETING_NAME,
  MARKETING_NAV_ITEMS,
} from "@/components/marketing/site-content";

export function PublicFooter() {
  return (
    <footer className="border-t border-border/60 bg-background/85">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.7fr_0.8fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
                TB
              </div>
              <div>
                <p className="text-sm font-semibold">{MARKETING_NAME}</p>
                <p className="text-sm text-muted-foreground">{MARKETING_HEADLINE}</p>
              </div>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              TaxBook combines invoices, expenses, taxes, receipts, reports, workspace roles,
              and audit logs in one launch-ready finance workspace.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Workspace-scoped</Badge>
              <Badge variant="secondary">VAT/WHT ready</Badge>
              <Badge variant="secondary">AI-assisted capture</Badge>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Explore</p>
            <div className="grid gap-2 text-sm text-muted-foreground">
              {MARKETING_NAV_ITEMS.map((link) => (
                <Link key={link.href} href={link.href} className="transition hover:text-foreground">
                  {link.label}
                </Link>
              ))}
              <Link href="/login" className="transition hover:text-foreground">
                Login
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold">Contact</p>
              <div className="grid gap-2 text-sm text-muted-foreground">
                <a
                  href={`mailto:${COMPANY_DETAILS.email}`}
                  className="transition hover:text-foreground"
                >
                  {COMPANY_DETAILS.email}
                </a>
                <a
                  href={`tel:${COMPANY_DETAILS.phone.replace(/\s+/g, "")}`}
                  className="transition hover:text-foreground"
                >
                  {COMPANY_DETAILS.phone}
                </a>
                <span>{COMPANY_DETAILS.location}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="sm" variant="outline">
                <Link href="/pricing">View Pricing</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Start Free Trial</Link>
              </Button>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Built for firms, finance teams, and growth-stage businesses across Africa.</p>
          <p>© 2026 TaxBook. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
