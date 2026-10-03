import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { workspaceService } from "@/services/workspace-service";

type Workspace = { id: string; name: string; plan?: string | null };

async function load() {
  try {
    const rows = (await workspaceService.listWorkspaces()) as Workspace[];
    const members = await Promise.all(
      rows.map((w) => workspaceService.listMembers(w.id).catch(() => [] as unknown[])),
    );
    return rows.map((w, i) => ({ ...w, memberCount: (members[i] as unknown[]).length }));
  } catch {
    return [] as (Workspace & { memberCount: number })[];
  }
}

export default async function StudioPage() {
  const workspaces = await load();
  return (
    <div className="flex min-h-full flex-col gap-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Studio</h1>
        <p className="text-sm text-muted-foreground">
          Workspace + tim. Invite role: Owner / PM / Finance / Staff.
        </p>
      </div>
      <div className="flex gap-4 text-sm">
        <Link className="underline" href="/studio/tickets">Tiket + SLA</Link>
        <Link className="underline" href="/studio/workload">Workload</Link>
      </div>
      {workspaces.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="p-5 text-sm text-muted-foreground">
            Belum ada workspace. Buat via WorkspaceService.createWorkspace.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((w) => (
            <Card key={w.id} className="shadow-none">
              <CardContent className="p-5">
                <div className="font-semibold">{w.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {w.plan ?? "FREE"} · {w.memberCount} member
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
