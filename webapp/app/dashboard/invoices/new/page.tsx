import { requireUser } from "@/src/lib/auth";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";
import InvoiceFormClient from "./_components/InvoiceFormClient";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewInvoicePage() {
  const user = await requireUser();
  const membership = await getActiveWorkspaceMembership(user.id);

  if (!membership) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">New invoice</h1>
          <p className="text-muted-foreground">No workspace assigned.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Select a workspace</CardTitle>
            <CardDescription>
              Switch to a workspace to create invoices.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  return <InvoiceFormClient role={membership.role} />;
}
