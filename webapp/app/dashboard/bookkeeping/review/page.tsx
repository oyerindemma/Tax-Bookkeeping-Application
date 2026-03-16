import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/src/lib/auth";
import { getWorkspaceBookkeepingMetrics } from "@/src/lib/accounting-firm";
import { shouldBypassFeatureGate } from "@/src/lib/billing";
import {
  listWorkspaceBookkeepingReviewUploads,
  listWorkspaceClientBusinessReviewOptions,
} from "@/src/lib/bookkeeping-review";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";
import BookkeepingReviewClient from "./_components/BookkeepingReviewClient";

export default async function BookkeepingReviewPage() {
  const user = await requireUser();
  const membership = await getActiveWorkspaceMembership(user.id);

  if (!membership) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Bookkeeping review</h1>
          <p className="text-muted-foreground">No workspace assigned.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Select a workspace</CardTitle>
            <CardDescription>
              Switch to a workspace to review AI bookkeeping drafts.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const [uploads, metrics, clientBusinesses] = await Promise.all([
    listWorkspaceBookkeepingReviewUploads(membership.workspaceId),
    getWorkspaceBookkeepingMetrics(membership.workspaceId),
    listWorkspaceClientBusinessReviewOptions(membership.workspaceId),
  ]);

  return (
    <BookkeepingReviewClient
      workspaceName={membership.workspace.name}
      role={membership.role}
      initialUploads={uploads}
      metrics={metrics}
      clientBusinesses={clientBusinesses}
      aiDevelopmentBypass={shouldBypassFeatureGate("AI_ASSISTANT")}
    />
  );
}
