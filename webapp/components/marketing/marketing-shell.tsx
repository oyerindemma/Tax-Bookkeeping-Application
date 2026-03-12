import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicNavbar } from "@/components/marketing/public-navbar";

type MarketingShellProps = {
  children: ReactNode;
  backgroundClassName?: string;
};

export function MarketingShell({
  children,
  backgroundClassName = "bg-[radial-gradient(circle_at_top,rgba(57,118,88,0.12),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(212,168,84,0.14),transparent_24%),linear-gradient(180deg,#f8f4ea_0%,#f8fbf8_48%,#f3f6fb_100%)]",
}: MarketingShellProps) {
  return (
    <div className={cn("min-h-screen text-foreground", backgroundClassName)}>
      <PublicNavbar />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
