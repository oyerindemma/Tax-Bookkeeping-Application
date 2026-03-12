import { requireUser } from "@/src/lib/auth";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";
import TaxRecordsClient from "./_components/TaxRecordsClient";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TaxRecordsPage() {
  const user = await requireUser();
  const membership = await getActiveWorkspaceMembership(user.id);

  if (!membership) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Tax records</h1>
          <p className="text-muted-foreground">No workspace assigned.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Choose a workspace</CardTitle>
            <CardDescription>
              Switch to a workspace to view or create tax records.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  return <TaxRecordsClient role={membership.role} />;
}
