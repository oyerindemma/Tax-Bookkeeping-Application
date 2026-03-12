import { requireUser } from "@/src/lib/auth";
import { getActiveWorkspaceMembership } from "@/src/lib/workspaces";
import Sidebar from "./_components/Sidebar";
import Topbar from "./_components/Topbar";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const membership = await getActiveWorkspaceMembership(user.id);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar
            user={{ fullName: user.fullName, email: user.email }}
            workspace={
              membership
                ? {
                    name: membership.workspace.name,
                    role: membership.role,
                  }
                : null
            }
          />
          <main className="flex-1">
            <div className="mx-auto w-full max-w-6xl p-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
