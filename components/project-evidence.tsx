import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { commentService } from "@/services/comment-service";
import { disputeService } from "@/services/dispute-service";

function time(value: unknown) {
  const parsed = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

/**
 * F2 read-only evidence untuk portal publik (magic-link, tanpa login):
 * daftar komentar sebagai bukti + status dispute + countdown deadline statis.
 * Timeline escrow tetap dirender halaman via EscrowTimeline (tidak diubah).
 * Catch → [] supaya portal tetap jalan sebelum migration F2 di-apply.
 */
export default async function ProjectEvidence({
  projectId,
}: {
  projectId: string;
}) {
  const [comments, disputes] = await Promise.all([
    commentService.getComments(projectId).catch(() => [] as any[]),
    disputeService.listForProject(projectId).catch(() => [] as any[]),
  ]);

  if (
    (comments as any[]).length === 0 &&
    (disputes as any[]).length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-3">
      {(disputes as any[]).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sengketa</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {(disputes as any[]).map((d: any) => (
                <li key={String(d.id)} className="text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {String(d.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      deadline {time(d.deadlineAt)}
                    </span>
                  </span>
                  <p className="mt-1">{String(d.reason)}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
      {(comments as any[]).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bukti tertulis</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {(comments as any[]).map((c: any) => (
                <li
                  key={String(c.id)}
                  className="rounded-md bg-muted/40 px-3 py-2 text-sm"
                >
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {String(c.authorRole ?? "?")}
                    </span>
                    <span>{time(c.createdAt)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{String(c.body)}</p>
                  {Array.isArray(c.attachments) && c.attachments.length > 0 ? (
                    <p className="mt-1 space-x-2">
                      {c.attachments.map((url: unknown) => (
                        <a
                          key={String(url)}
                          href={String(url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline"
                        >
                          bukti
                        </a>
                      ))}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
