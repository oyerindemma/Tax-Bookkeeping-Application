import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/src/lib/auth";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";
import InvoiceDetailClient from "./_components/InvoiceDetailClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const membership = await getActiveWorkspaceMembership(user.id);

  if (!membership) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Invoice</h1>
          <p className="text-muted-foreground">No workspace assigned.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Select a workspace</CardTitle>
            <CardDescription>
              Switch to a workspace to view invoices.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Invoice not found</h1>
          <p className="text-muted-foreground">
            The invoice id in the URL is invalid.
          </p>
        </div>
      </section>
    );
  }

  return <InvoiceDetailClient invoiceId={invoiceId} role={membership.role} />;
}
