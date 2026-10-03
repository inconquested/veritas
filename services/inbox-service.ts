import prisma from "@/lib/prisma";
import { parseMentions } from "@/lib/mention";
import { send as sendNotify } from "./vendor/notify/notify-service";

export type MentionSource = {
  kind: string;
  id: string;
} | null;

export type InboxQuery = {
  /** userId Clerk/DB — dicocokkan ke Task.assignee. */
  userId: string;
  /** nama tampilan (untuk @nama) — dicocokkan ke ActivityEvent mention. */
  userName?: string | null;
};

/**
 * F9 inbox "perlu aksiku": task yang di-assign ke user + mention @nama
 * yang disimpan sebagai ActivityEvent (action `mention`, TANPA tabel baru).
 *
 * Wave integrasi: tiap mention juga memicu `mention.created` via notify-service
 * (best-effort, try/catch per nama) + tetap tercatat di feed/inbox.
 * `notifyTo`: alamat eksplisit per nama yang di-mention (email/WA) bila
 * caller menyerahkannya; tanpa itu = catat saja.
 */
export async function recordMentions(
  db: any,
  input: {
    projectId: string;
    actorId?: string | null;
    body: string;
    source?: MentionSource;
    notifyTo?: Record<string, string> | null;
  },
): Promise<any[]> {
  const names = parseMentions(input.body);
  const rows: any[] = [];
  for (const name of names) {
    try {
      const row = await db.activityEvent?.create?.({
        data: {
          project_id: input.projectId,
          actorId: input.actorId ?? null,
          action: "mention",
          metadata: {
            mentioned: name,
            body: input.body.slice(0, 500),
            source: input.source ?? null,
          },
        },
      });
      if (row) rows.push(row);
    } catch {
      // Pre-migrate: tabel ActivityEvent belum ada = skip diam-diam.
    }
    // Wave integrasi: mention.created best-effort (1 key per nama).
    const to = input.notifyTo?.[name];
    if (to) {
      try {
        await sendNotify(to, "mention.created", {
          entityId: `${input.projectId}:${name}`,
          projectTitle: null,
          invoiceTitle: `@${name}`,
          deadline: null,
        });
      } catch {
        // Notif gagal ≠ mention gagal (sudah tercatat di atas).
      }
    }
  }
  return rows;
}

export async function getMyInbox(db: any = prisma as any, query: InboxQuery) {
  const names = [query.userId, query.userName].filter(Boolean) as string[];
  let tasks: any[] = [];
  try {
    tasks = await db.task.findMany({
      where: { OR: names.map((n) => ({ assignee: n })) },
      orderBy: { due: "asc" },
    });
  } catch {
    tasks = [];
  }
  let mentions: any[] = [];
  try {
    const events: any[] = await db.activityEvent.findMany({
      where: { action: "mention" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    mentions = events.filter((e) => {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      return typeof meta.mentioned === "string" && names.includes(meta.mentioned);
    });
  } catch {
    mentions = [];
  }
  return { tasks, mentions };
}

export const inboxService = { recordMentions, getMyInbox };
