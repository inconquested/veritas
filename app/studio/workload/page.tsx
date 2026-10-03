import { Card, CardContent } from "@/components/ui/card";
import { getStaffWorkload, OVERLOAD_THRESHOLD } from "@/lib/workload";
import { workspaceService } from "@/services/workspace-service";
import prisma from "@/lib/prisma";

async function load() {
  try {
    const workspaces = (await workspaceService.listWorkspaces()) as { id: string }[];
    const first = workspaces[0];
    if (!first) return [];
    const members = (await workspaceService.listMembers(first.id)) as { userId: string }[];
    const ids = [...new Set(members.map((m) => m.userId))];
    if (ids.length === 0) return [];
    return getStaffWorkload(prisma as any, ids);
  } catch {
    return [];
  }
}

export default async function StudioWorkloadPage() {
  const rows = await load();
  return (
    <div className="flex min-h-full flex-col gap-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workload</h1>
        <p className="text-sm text-muted-foreground">
          Task aktif + tiket open se-project. Overload ≥ {OVERLOAD_THRESHOLD}.
        </p>
      </div>
      {rows.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="p-5 text-sm text-muted-foreground">
            Belum ada data beban (butuh workspace + member + task).
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.staffId} className="shadow-none">
              <CardContent className="p-5">
                <div className="font-semibold">{r.staffId}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {r.taskCount} task · {r.ticketCount} tiket · total {r.total}
                </div>
                {r.overloaded && (
                  <div className="mt-2 text-sm font-medium text-red-600">Overload</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* TODO: tambah kolom Ticket.assignee agar atribusi tiket langsung, bukan via project. */}
    </div>
  );
}
