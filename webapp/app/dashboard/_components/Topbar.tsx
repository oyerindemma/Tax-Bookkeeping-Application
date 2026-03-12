"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, User } from "lucide-react";
import WorkspaceSwitcher from "../WorkspaceSwitcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/workspaces", label: "Workspaces" },
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

type TopbarProps = {
  user: {
    fullName: string;
    email: string;
  };
  workspace: {
    name: string;
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  } | null;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export default function Topbar({ user, workspace }: TopbarProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/login");
    }
  }

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-4 border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/70"
      data-print-hide="true"
    >
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col">
            <div className="px-6 py-5 text-lg font-semibold">TaxBook</div>
            <Separator />
            <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  className="justify-start"
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      <div className="grid gap-0.5">
        <div className="text-sm font-medium text-muted-foreground">Dashboard</div>
        {workspace ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-foreground">{workspace.name}</span>
            <Badge variant="secondary">{workspace.role}</Badge>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No workspace selected</div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <WorkspaceSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar size="sm">
                <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline-block">
                {user.fullName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="grid">
                <span className="text-sm font-medium">{user.fullName}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <User className="size-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                handleLogout();
              }}
              disabled={loggingOut}
            >
              <LogOut className="size-4" />
              {loggingOut ? "Logging out..." : "Logout"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
