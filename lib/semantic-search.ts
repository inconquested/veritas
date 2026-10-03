/**
 * F13 semantic search v1: full-text multi-model via Prisma (tanpa pgvector).
 *
 * TODO(embedding): kolom embedding pgvector + index HNSW + re-rank cosine.
 * v1 cukup token-overlap berbobot (judul 3x, body 1x, bonus frasa persis)
 * di atas hasil Prisma `contains(... mode: insensitive)`, agar tanpa migrasi
 * dan tanpa dependensi baru.
 *
 * Model yang dicari: Project(title/description) + Invoice(title/notes) +
 * Comment(body) + Task(title). Filter: projectId, kind, limit.
 */

export type SearchKind = "project" | "invoice" | "comment" | "task";

export type SearchDoc = {
  id: string;
  kind: SearchKind;
  title: string;
  body?: string | null;
  projectId?: string | null;
  score?: number;
};

export type SearchFilter = {
  projectId?: string;
  kind?: SearchKind | SearchKind[];
  limit?: number;
};

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF_]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** Skor satu dokumen: judul bobot 3, body bobot 1, bonus frasa +2. */
export function scoreDoc(doc: SearchDoc, tokens: string[], rawQuery: string): number {
  if (tokens.length === 0) return 0;
  const title = (doc.title ?? "").toLowerCase();
  const body = (doc.body ?? "").toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (title.includes(t)) score += 3;
    if (body.includes(t)) score += 1;
  }
  const q = rawQuery.trim().toLowerCase();
  if (q.length >= 3 && (title.includes(q) || body.includes(q))) score += 2;
  return score;
}

/** Ranking murni (dipakai test + fallback tanpa DB). Stabil via id. */
export function rankDocuments(
  docs: SearchDoc[],
  query: string,
  filter: SearchFilter = {},
): SearchDoc[] {
  const kinds = filter.kind ? new Set(Array.isArray(filter.kind) ? filter.kind : [filter.kind]) : null;
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 50);
  return docs
    .filter((d) => (kinds ? kinds.has(d.kind) : true))
    .filter((d) => (filter.projectId ? d.projectId === filter.projectId : true))
    .map((d) => ({ ...d, score: scoreDoc(d, tokens, query) }))
    .filter((d) => (d.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
}

type PrismaLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project?: { findMany: (q: any) => Promise<any[]> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoice?: { findMany: (q: any) => Promise<any[]> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  comment?: { findMany: (q: any) => Promise<any[]> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task?: { findMany: (q: any) => Promise<any[]> };
};

/** Ambil kandidat dari Prisma (contains insensitive), lalu ranking di memori. */
export async function semanticSearch(
  db: PrismaLike,
  query: string,
  filter: SearchFilter = {},
): Promise<SearchDoc[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const kinds = filter.kind ? new Set(Array.isArray(filter.kind) ? filter.kind : [filter.kind]) : null;
  const want = (k: SearchKind) => !kinds || kinds.has(k);
  const take = 30;
  const out: SearchDoc[] = [];

  const orContains = (fields: string[]) => ({
    OR: fields.flatMap((f) => tokens.slice(0, 5).map((t) => ({ [f]: { contains: t, mode: "insensitive" } }))),
  });

  try {
    if (want("project") && db.project) {
      const rows = (await db.project.findMany({
        where: {
          ...(filter.projectId ? { id: filter.projectId } : {}),
          ...orContains(["title", "description"]),
        },
        take,
        select: { id: true, title: true, description: true },
      })) as Array<{ id: string; title: string; description?: string | null }>;
      for (const r of rows) out.push({ id: r.id, kind: "project", title: r.title, body: r.description, projectId: r.id });
    }
    if (want("invoice") && db.invoice) {
      const rows = (await db.invoice.findMany({
        where: {
          ...(filter.projectId ? { project_id: filter.projectId } : {}),
          ...orContains(["title", "notes", "clientName"]),
        },
        take,
        select: { id: true, title: true, notes: true, project_id: true },
      })) as Array<{ id: string; title: string; notes?: string | null; project_id?: string }>;
      for (const r of rows) out.push({ id: r.id, kind: "invoice", title: r.title, body: r.notes, projectId: r.project_id });
    }
    if (want("comment") && db.comment) {
      const rows = (await db.comment.findMany({
        where: {
          ...(filter.projectId ? { project_id: filter.projectId } : {}),
          ...orContains(["body"]),
        },
        take,
        select: { id: true, body: true, project_id: true },
      })) as Array<{ id: string; body: string; project_id?: string }>;
      for (const r of rows)
        out.push({ id: r.id, kind: "comment", title: r.body.slice(0, 80), body: r.body, projectId: r.project_id });
    }
    if (want("task") && db.task) {
      const rows = (await db.task.findMany({
        where: {
          ...(filter.projectId ? { project_id: filter.projectId } : {}),
          ...orContains(["title"]),
        },
        take,
        select: { id: true, title: true, project_id: true },
      })) as Array<{ id: string; title: string; project_id?: string }>;
      for (const r of rows) out.push({ id: r.id, kind: "task", title: r.title, projectId: r.project_id });
    }
  } catch {
    return [];
  }
  return rankDocuments(out, query, filter);
}
