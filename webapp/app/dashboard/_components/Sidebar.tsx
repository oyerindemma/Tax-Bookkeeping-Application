import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/workspaces", label: "Workspaces" },
  { href: "/dashboard/client-businesses", label: "Client businesses" },
  { href: "/dashboard/bookkeeping/review", label: "Bookkeeping review" },
  { href: "/dashboard/tax-summary", label: "Tax summary" },
  { href: "/dashboard/tax-records", label: "Tax records" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/recurring-invoices", label: "Recurring invoices" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/banking", label: "Banking" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/settings/categories", label: "Categories" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/assistant", label: "Assistant" },
  { href: "/dashboard/tax-filing", label: "Tax filing" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/audit", label: "Audit log" },
  { href: "/dashboard/team", label: "Team" },
];

export default function Sidebar() {
  return (
    <aside
      className="hidden h-screen w-64 flex-col border-r bg-card px-4 py-6 md:flex"
      data-print-hide="true"
    >
      <div className="flex items-center gap-2 px-2">
        <div className="text-lg font-semibold">TaxBook</div>
        <Badge variant="secondary">SaaS</Badge>
      </div>
      <Separator className="my-4" />
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <Button key={item.href} asChild variant="ghost" className="justify-start">
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </nav>
      <Separator className="my-4" />
      <div className="px-2 text-xs text-muted-foreground">
        Multi-entity accounting workspace
      </div>
    </aside>
  );
}
