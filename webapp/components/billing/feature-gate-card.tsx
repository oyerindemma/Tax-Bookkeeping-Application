import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type FeatureGateCardProps = {
  featureName: string;
  featureDescription: string;
  currentPlanName: string;
  requiredPlanName: string;
  requiredPlanPrice: string;
};

export function FeatureGateCard({
  featureName,
  featureDescription,
  currentPlanName,
  requiredPlanName,
  requiredPlanPrice,
}: FeatureGateCardProps) {
  return (
    <Card className="border-border/60 bg-white/85">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Upgrade required</Badge>
          <Badge variant="outline">Current: {currentPlanName}</Badge>
        </div>
        <CardTitle>{featureName} is not available on this workspace plan.</CardTitle>
        <CardDescription className="max-w-2xl leading-6">
          {featureDescription} Upgrade to {requiredPlanName} for {requiredPlanPrice} to unlock it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/pricing">View pricing</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/billing">Open billing</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
