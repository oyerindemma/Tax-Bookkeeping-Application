import { Badge } from "@/components/ui/badge";
import { FeatureGateCard } from "@/components/billing/feature-gate-card";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/src/lib/auth";
import {
  formatPlanPricePerMonth,
  getPlanConfig,
  getWorkspaceFeatureAccess,
} from "@/src/lib/billing";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";
import AssistantClient from "./_components/AssistantClient";

export default async function AssistantPage() {
  const user = await requireUser();
  const membership = await getActiveWorkspaceMembership(user.id);

  if (!membership) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">AI accounting assistant</h1>
          <p className="text-muted-foreground">No workspace assigned.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Select a workspace</CardTitle>
            <CardDescription>
              Switch to a workspace to ask accounting questions about its live data.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const access = await getWorkspaceFeatureAccess(membership.workspaceId, "AI_ASSISTANT");
  if (!access.ok) {
    return (
      <section className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">AI accounting assistant</h1>
          <p className="text-muted-foreground">
            Upgrade this workspace to unlock AI-assisted capture and grounded finance questions.
          </p>
        </div>
        <FeatureGateCard
          featureName="AI assistant and receipt scanning"
          featureDescription="Use the workspace assistant, receipt scan, and text-to-record drafting."
          currentPlanName={getPlanConfig(access.plan).name}
          requiredPlanName={getPlanConfig(access.requiredPlan).name}
          requiredPlanPrice={formatPlanPricePerMonth(access.requiredPlan)}
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">AI accounting assistant</h1>
          <p className="text-muted-foreground">
            Ask grounded questions about invoices, VAT, receivables, and expenses.
          </p>
          <p className="text-sm text-muted-foreground">
            Workspace:{" "}
            <span className="font-medium text-foreground">
              {membership.workspace.name}
            </span>
          </p>
        </div>
        <Badge variant="secondary">Workspace scoped</Badge>
      </div>

      <AssistantClient workspaceName={membership.workspace.name} />
    </section>
  );
}
