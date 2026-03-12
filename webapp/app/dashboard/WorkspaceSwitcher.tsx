"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type WorkspaceOption = {
  id: number;
  name: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  membersCount?: number;
  invoicesCount?: number;
  taxRecordsCount?: number;
  subscriptionLabel?: string;
};

export default function WorkspaceSwitcher() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [archivedCount, setArchivedCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadWorkspaces() {
      setLoadingList(true);
      setError(null);
      try {
        const res = await fetch("/api/workspaces", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "Unable to load workspaces");
          return;
        }
        if (!mounted) return;
        const list = Array.isArray(data?.workspaces) ? data.workspaces : [];
        setArchivedCount(
          Number.isFinite(data?.archivedWorkspacesCount)
            ? data.archivedWorkspacesCount
            : 0
        );
        setWorkspaces(list);
        const active =
          Number.isFinite(data?.activeWorkspaceId) && data.activeWorkspaceId > 0
            ? data.activeWorkspaceId
            : list[0]?.id ?? null;
        setCurrent(active);
      } catch {
        if (mounted) setError("Network error loading workspaces");
      } finally {
        if (mounted) setLoadingList(false);
      }
    }

    loadWorkspaces();
    return () => {
      mounted = false;
    };
  }, []);

  async function onChange(nextIdRaw: string) {
    const nextId = Number(nextIdRaw);
    if (!Number.isFinite(nextId)) return;
    setCurrent(nextId);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/workspaces/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: nextId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Unable to switch workspace");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error switching workspace");
    } finally {
      setLoading(false);
    }
  }

  if (loadingList) {
    return <div className="text-xs text-muted-foreground">Loading...</div>;
  }

  const currentWorkspace = workspaces.find((workspace) => workspace.id === current) ?? null;

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">Workspace</Label>
        <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs">
          <Link href="/dashboard/workspaces">Manage</Link>
        </Button>
      </div>
      {workspaces.length === 0 ? (
        <div className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <p className="font-medium text-foreground">No active workspaces</p>
          <p className="text-xs text-muted-foreground">
            {archivedCount > 0
              ? "Your archived workspaces are available on the workspaces page."
              : "Create a workspace to begin tracking a business."}
          </p>
        </div>
      ) : (
        <select
          value={current ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading || workspaces.length === 1}
          className="h-9 w-full min-w-[200px] rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name} ({workspace.role})
            </option>
          ))}
        </select>
      )}
      {currentWorkspace && (
        <span className="text-xs text-muted-foreground">
          {currentWorkspace.subscriptionLabel ?? "Workspace selected"} ·{" "}
          {currentWorkspace.invoicesCount ?? 0} invoices ·{" "}
          {currentWorkspace.taxRecordsCount ?? 0} tax records
        </span>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
