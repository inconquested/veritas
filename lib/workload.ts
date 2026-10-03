/** F12 workload: beban per staff = task aktif + tiket open se-project. */

export const OVERLOAD_THRESHOLD = 8;

export type WorkloadTask = {
  assignee?: string | null;
  status: string;
  project_id?: string;
};

export type WorkloadTicket = { project_id?: string; status: string };

export type StaffLoad = {
  staffId: string;
  taskCount: number;
  ticketCount: number;
  total: number;
  overloaded: boolean;
};

const TASK_DONE = new Set(["DONE"]);
const TICKET_OPEN = new Set(["OPEN", "IN_PROGRESS"]);

/**
 * Murni: hitung beban per staff. Ticket TIDAK punya kolom assignee di schema,
 * jadi tiket open diatribusikan ke staff yang punya task aktif di project
 * yang sama.
 * TODO: tambah kolom Ticket.assignee + migrate, lalu hitung langsung.
 */
export function summarizeWorkload(
  tasks: WorkloadTask[],
  tickets: WorkloadTicket[],
  opts: { staffIds?: string[]; threshold?: number } = {},
): StaffLoad[] {
  const threshold = opts.threshold ?? OVERLOAD_THRESHOLD;
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeTickets = Array.isArray(tickets) ? tickets : [];

  const activeByStaff = new Map<string, WorkloadTask[]>();
  for (const t of safeTasks) {
    if (!t?.assignee || TASK_DONE.has(String(t.status))) continue;
    const list = activeByStaff.get(t.assignee) ?? [];
    list.push(t);
    activeByStaff.set(t.assignee, list);
  }

  const openByProject = new Map<string, number>();
  for (const t of safeTickets) {
    // Tanpa project_id tiket tak bisa diatribusikan ke staff → abaikan.
    if (!TICKET_OPEN.has(String(t?.status)) || !t?.project_id) continue;
    openByProject.set(t.project_id, (openByProject.get(t.project_id) ?? 0) + 1);
  }

  const ids = opts.staffIds ?? [...activeByStaff.keys()];
  return ids.map((staffId) => {
    const mine = activeByStaff.get(staffId) ?? [];
    const projects = new Set(mine.map((t) => t.project_id).filter(Boolean) as string[]);
    let ticketCount = 0;
    for (const p of projects) ticketCount += openByProject.get(p) ?? 0;
    const total = mine.length + ticketCount;
    return {
      staffId,
      taskCount: mine.length,
      ticketCount,
      total,
      overloaded: total >= threshold,
    };
  });
}

/** Loader Prisma (read-only ke Task/Ticket): kembalikan ringkasan per staff. */
export async function getStaffWorkload(
  db: any,
  staffIds: string[],
  opts: { threshold?: number } = {},
): Promise<StaffLoad[]> {
  const [tasks, tickets] = await Promise.all([
    db.task
      .findMany({ where: { assignee: { in: staffIds }, status: { not: "DONE" } } })
      .catch(() => []),
    db.ticket
      .findMany({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } })
      .catch(() => []),
  ]);
  return summarizeWorkload(tasks, tickets, { staffIds, threshold: opts.threshold });
}
