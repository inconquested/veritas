import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { handoverService, type HandoverNoteLike } from "@/services/handover-service";

async function load(projectId: string) {
  try {
    return (await handoverService.listByProject(projectId)) as HandoverNoteLike[];
  } catch {
    return [] as HandoverNoteLike[];
  }
}

export default async function HandoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const notes = await load(id);
  return (
    <div className="flex min-h-full flex-col gap-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Serah Terima</h1>
        <p className="text-sm text-muted-foreground">
          Kredensial, cara deploy, runbook. Revoke akses = hapus note + catat audit
          (HandoverService.revokeAccess).
        </p>
        <Link className="text-sm underline" href={`/freelancer/projects/${id}`}>
          Kembali ke project
        </Link>
      </div>
      {notes.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="p-5 text-sm text-muted-foreground">
            Belum ada catatan serah terima untuk project ini.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {notes.map((n) => (
            <Card key={n.id} className="shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{n.role}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{n.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
