import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MarketingCTAGroupProps = {
  className?: string;
  compact?: boolean;
  showContactSales?: boolean;
  showLogin?: boolean;
  showViewPricing?: boolean;
  tone?: "default" | "inverse";
};

export function MarketingCTAGroup({
  className,
  compact = false,
  showContactSales = true,
  showLogin = true,
  showViewPricing = true,
  tone = "default",
}: MarketingCTAGroupProps) {
  const size = compact ? "default" : "lg";
  const inverseOutlineClassName =
    "border-white/20 bg-transparent text-slate-50 hover:bg-white/10 hover:text-slate-50";
  const inverseGhostClassName =
    "text-slate-50 hover:bg-white/10 hover:text-slate-50";

  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <Button
        asChild
        size={size}
        className={tone === "inverse" ? "bg-white text-slate-950 hover:bg-white/90" : undefined}
      >
        <Link href="/signup">
          Start Free Trial
          <ArrowRight className="size-4" />
        </Link>
      </Button>

      {showViewPricing && (
        <Button
          asChild
          size={size}
          variant="outline"
          className={tone === "inverse" ? inverseOutlineClassName : undefined}
        >
          <Link href="/pricing">View Pricing</Link>
        </Button>
      )}

      {showContactSales && (
        <Button
          asChild
          size={size}
          variant="outline"
          className={tone === "inverse" ? inverseOutlineClassName : undefined}
        >
          <Link href="/contact">Contact Sales</Link>
        </Button>
      )}

      {showLogin && (
        <Button
          asChild
          size={size}
          variant="ghost"
          className={tone === "inverse" ? inverseGhostClassName : undefined}
        >
          <Link href="/login">Login</Link>
        </Button>
      )}
    </div>
  );
}
