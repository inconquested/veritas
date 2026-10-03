"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export type ThreadComment = {
  id: string;
  authorRole: string;
  body: string;
  attachments: string[];
  createdAt: string;
};

export type CommentActionResult = {
  success: boolean;
  error?: string;
};

function time(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function CommentThread({
  projectId,
  milestoneId,
  handsoutId,
  title,
  comments,
  addAction,
}: {
  projectId: string;
  milestoneId?: string | null;
  handsoutId?: string | null;
  title: string;
  comments: ThreadComment[];
  addAction: (formData: FormData) => Promise<CommentActionResult>;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await addAction(new FormData(event.currentTarget));
      if (!result.success) {
        setError(result.error ?? "Gagal mengirim komentar.");
        return;
      }
      event.currentTarget.reset();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada komentar — jadi bukti tertulis di sini, bukan di WA.
          </p>
        ) : (
          <ol className="space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.authorRole}</span>
                  <span>{time(c.createdAt)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                {c.attachments.length > 0 ? (
                  <p className="mt-1 space-x-2">
                    {c.attachments.map((url) => (
                      <a
                        key={url}
                        href={url}
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
        )}
        <form onSubmit={onSubmit} className="space-y-2">
          <input type="hidden" name="projectId" value={projectId} />
          {milestoneId ? <input type="hidden" name="milestoneId" value={milestoneId} /> : null}
          {handsoutId ? <input type="hidden" name="handsoutId" value={handsoutId} /> : null}
          <Textarea name="body" placeholder="Tulis komentar / bukti…" disabled={pending} />
          <div className="flex items-center gap-2">
            <input
              type="file"
              name="evidence"
              multiple
              accept="image/*"
              disabled={pending}
              className="min-w-0 flex-1 text-xs text-muted-foreground"
            />
            <Button size="sm" type="submit" disabled={pending}>
              {pending ? "Mengirim…" : "Kirim"}
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
