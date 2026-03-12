import { FeatureGateCard } from "@/components/billing/feature-gate-card";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/src/lib/auth";
import {
  formatPlanPricePerMonth,
  getPlanConfig,
  getWorkspaceFeatureAccess,
} from "@/src/lib/billing";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";
import ReconcileClient from "./_components/ReconcileClient";

export default async function ReconcilePage() {
  const user = await requireUser();
  const membership = await getActiveWorkspaceMembership(user.id);

  if (!membership) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Reconcile</h1>
          <p className="text-muted-foreground">No workspace assigned.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Select a workspace</CardTitle>
            <CardDescription>Switch to a workspace to reconcile.</CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const access = await getWorkspaceFeatureAccess(membership.workspaceId, "BANKING");
  if (!access.ok) {
    return (
      <section className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Reconcile</h1>
          <p className="text-muted-foreground">
            Upgrade this workspace to match bank transactions against invoices and tax records.
          </p>
        </div>
        <FeatureGateCard
          featureName="Banking and reconciliation"
          featureDescription="Reconcile imported bank activity against invoices and tax records."
          currentPlanName={getPlanConfig(access.plan).name}
          requiredPlanName={getPlanConfig(access.requiredPlan).name}
          requiredPlanPrice={formatPlanPricePerMonth(access.requiredPlan)}
        />
      </section>
    );
  }

  return <ReconcileClient role={membership.role} />;
}
