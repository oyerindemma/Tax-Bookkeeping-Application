"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MARKETING_NAME,
  MARKETING_NAV_ITEMS,
  MARKETING_TAGLINE,
} from "@/components/marketing/site-content";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicNavbar() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
            TB
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              {MARKETING_NAME}
            </p>
            <p className="text-xs text-muted-foreground">{MARKETING_TAGLINE}</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {MARKETING_NAV_ITEMS.map((item) => (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              className={cn(
                "text-sm",
                isActivePath(pathname, item.href) && "bg-accent text-accent-foreground"
              )}
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="ghost">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Start Free Trial</Link>
          </Button>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open navigation" className="lg:hidden">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[320px]">
            <SheetHeader className="text-left">
              <SheetTitle>Navigate {MARKETING_NAME}</SheetTitle>
              <SheetDescription>
                Explore the product, pricing, and launch contact options.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-8 space-y-2">
              {MARKETING_NAV_ITEMS.map((item) => (
                <Button
                  key={item.href}
                  asChild
                  variant={isActivePath(pathname, item.href) ? "secondary" : "ghost"}
                  className="w-full justify-start"
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </div>
            <div className="mt-8 grid gap-3">
              <Button asChild variant="ghost" className="w-full justify-start">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/contact">Contact Sales</Link>
              </Button>
              <Button asChild className="w-full">
                <Link href="/signup">Start Free Trial</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
