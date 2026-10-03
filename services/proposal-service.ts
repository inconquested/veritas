import prisma from "@/lib/prisma";
import { ProjectService } from "./project-service";
import { invoiceService } from "./invoice-service";

export const PROPOSAL_STATUS = ["DRAFT", "SENT", "APPROVED", "REJECTED"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUS)[number];

export const PROPOSAL_NOT_FOUND = "errors.proposal.not_found";
export const PROPOSAL_BAD_STATUS = "errors.proposal.bad_status";
export const PROPOSAL_EXPIRED = "errors.proposal.expired";
export const PROPOSAL_EMPTY = "errors.proposal.empty_items";

export type ProposalItem = {
  title: string;
  qty: number;
  price: bigint | number | string;
};

export type CreateProposalInput = {
  freelancerId: string;
  clientName: string;
  items: ProposalItem[];
  expiresAt?: Date | string | null;
};

export type ApproveProposalOpts = {
  /** User.id klien. Wajib: Proposal hanya simpan clientName, bukan clientId. */
  clientId?: string;
  /** Persen DP dari total (default 50). */
  dpPercent?: number;
  projectCreator?: (data: {
    title: string;
    slug: string;
    description: string | null;
    freelancerId: string;
    clientId: string;
  }) => Promise<{ id: string } & Record<string, unknown>>;
  invoiceCreator?: (data: {
    projectId: string;
    title: string;
    amount: bigint;
  }) => Promise<{ id: string } & Record<string, unknown>>;
};

function toBig(v: bigint | number | string): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  return BigInt(String(v).trim());
}

/** Total = Σ qty × price. Dipakai builder UI + service agar konsisten. */
export function calcProposalTotal(items: ProposalItem[]): bigint {
  return (items ?? []).reduce((sum, it) => {
    const qty = Math.trunc(Number(it.qty) || 0);
    if (qty <= 0) return sum;
    return sum + BigInt(qty) * toBig(it.price);
  }, 0n);
}

/** Slug deterministik dari proposal id → approve 2x tabrakan slug, bukan dobel project. */
export function slugForProposal(proposalId: string): string {
  return `proposal-${String(proposalId).replace(/-/g, "").slice(0, 12).toLowerCase()}`;
}

function isExpired(p: { expiresAt?: Date | string | null }): boolean {
  if (!p.expiresAt) return false;
  return new Date(p.expiresAt).getTime() < Date.now();
}

/**
 * F5 proposal → project. Idempoten: approve 2x = 1 project (guard status
 * APPROVED + lookup slug deterministik + tangkap P2002 balapan).
 *
 * `db` loose-typed agar bisa diuji dengan mock (pola DisputeService).
 */
export class ProposalService {
  constructor(
    private readonly db: any = prisma as any,
    private readonly deps: Pick<ApproveProposalOpts, "projectCreator" | "invoiceCreator"> = {},
  ) {}

  async createProposal(input: CreateProposalInput) {
    if (!input.freelancerId) throw new Error("errors.proposal.missing_freelancer");
    if (!input.clientName?.trim()) throw new Error(PROPOSAL_EMPTY);
    if (!input.items?.length) throw new Error(PROPOSAL_EMPTY);
    const total = calcProposalTotal(input.items);
    if (total <= 0n) throw new Error(PROPOSAL_EMPTY);
    return this.db.proposal.create({
      data: {
        freelancerId: input.freelancerId,
        clientName: input.clientName.trim(),
        items: input.items.map((it) => ({
          title: String(it.title),
          qty: Math.trunc(Number(it.qty) || 0),
          price: String(toBig(it.price)),
        })),
        total,
        status: "DRAFT",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });
  }

  listProposals(freelancerId?: string) {
    return this.db.proposal.findMany({
      where: freelancerId ? { freelancerId } : {},
      orderBy: { id: "desc" },
    });
  }

  getProposal(id: string) {
    if (!id) throw new Error(PROPOSAL_NOT_FOUND);
    return this.db.proposal.findUnique({ where: { id } });
  }

  async sendProposal(id: string) {
    const p = await this.db.proposal.findUnique({ where: { id } });
    if (!p) throw new Error(PROPOSAL_NOT_FOUND);
    if (p.status === "SENT") return p;
    if (p.status !== "DRAFT") throw new Error(PROPOSAL_BAD_STATUS);
    if (isExpired(p)) throw new Error(PROPOSAL_EXPIRED);
    return this.db.proposal.update({ where: { id }, data: { status: "SENT" } });
  }

  async approveProposal(id: string, opts: ApproveProposalOpts = {}) {
    const p = await this.db.proposal.findUnique({ where: { id } });
    if (!p) throw new Error(PROPOSAL_NOT_FOUND);

    const alreadyApproved = p.status === "APPROVED";
    if (!alreadyApproved) {
      if (p.status === "REJECTED") throw new Error(PROPOSAL_BAD_STATUS);
      if (p.status !== "SENT") throw new Error(PROPOSAL_BAD_STATUS);
      if (isExpired(p)) throw new Error(PROPOSAL_EXPIRED);
    }

    const slug = slugForProposal(p.id);
    const existing = await this.db.project
      .findUnique({ where: { slug } })
      .catch(() => null);
    if (existing) {
      if (!alreadyApproved) {
        await this.db.proposal.update({ where: { id }, data: { status: "APPROVED" } });
      }
      return { proposal: p, project: existing, deduped: true };
    }
    if (alreadyApproved) {
      // APPROVED tapi project hilang (crash tengah jalan) → buat ulang di bawah.
    }

    if (!opts.clientId) throw new Error("errors.proposal.missing_client");
    // TODO(F5-wave-integrasi): clientId asli dari akun klien (invite/lookup by
    // clientName). Proposal hanya simpan clientName, jadi caller wajib pasok.

    const projectCreator =
      opts.projectCreator ??
      this.deps.projectCreator ??
      (async (d: { title: string; slug: string; description: string | null; freelancerId: string; clientId: string }) => {
        // TODO(F5-wave-integrasi): ProjectService.createProject butuh ctx +
        // slug unik; fallback tulis langsung jika signature berubah.
        try {
          const svc = new ProjectService(this.db);
          return (await svc.createProject(
            { title: d.title, slug: d.slug, description: d.description ?? undefined },
            { freelancerId: d.freelancerId, clientId: d.clientId },
          )) as { id: string } & Record<string, unknown>;
        } catch {
          return this.db.project.create({
            data: {
              title: d.title,
              slug: d.slug,
              description: d.description,
              freelancer: { connect: { id: d.freelancerId } },
              client: { connect: { id: d.clientId } },
            },
          });
        }
      });

    let project: { id: string } & Record<string, unknown>;
    try {
      project = await projectCreator({
        title: `Project untuk ${p.clientName}`,
        slug,
        description: null,
        freelancerId: p.freelancerId,
        clientId: opts.clientId,
      });
    } catch (e) {
      // Balapan approve konkuren: slug unik tabrakan → pakai baris pemenang.
      if ((e as { code?: string })?.code !== "P2002") throw e;
      const winner = await this.db.project.findUnique({ where: { slug } });
      if (!winner) throw e;
      await this.db.proposal.update({ where: { id }, data: { status: "APPROVED" } });
      return { proposal: p, project: winner, deduped: true };
    }

    const items = (p.items ?? []) as ProposalItem[];
    const milestone = await this.db.milestone
      .create({
        data: {
          project_id: project.id,
          title: items[0]?.title ? String(items[0].title) : "Milestone 1 — Pelaksanaan",
          description: `Dari proposal ${p.id} (${items.length} item)`,
          due_date: new Date(Date.now() + 30 * 86_400_000),
        },
      })
      .catch(() => null);

    const pct = Math.min(100, Math.max(1, Math.trunc(opts.dpPercent ?? 50)));
    const dpAmount = (toBig(p.total) * BigInt(pct)) / 100n;
    const invoiceCreator =
      opts.invoiceCreator ??
      this.deps.invoiceCreator ??
      (async (d: { projectId: string; title: string; amount: bigint }) => {
        // TODO(F5-wave-integrasi): InvoiceService.createInvoice belum isi
        // number/type DP (F4 TODO) + butuh Clerk currentUser; fallback tulis
        // langsung agar approve tetap jalan di luar request login.
        try {
          return (await invoiceService.createInvoice({
            project_id: d.projectId,
            title: d.title,
            currency: "IDR",
            amount: d.amount,
            payment_method: "BANK_TRANSFER",
            due_date: new Date(Date.now() + 14 * 86_400_000),
          })) as unknown as { id: string } & Record<string, unknown>;
        } catch {
          const profile = await this.db.freelancerProfile?.findFirst({
            where: { userId: p.freelancerId },
            select: { id: true },
          });
          if (!profile?.id) throw new Error("errors.invoice.creation_failed");
          return this.db.invoice.create({
            data: {
              project_id: d.projectId,
              freelancerId: profile.id,
              clientName: p.clientName,
              title: d.title,
              currency: "IDR",
              amount: d.amount,
              payment_method: "BANK_TRANSFER",
              status: "DRAFT",
              due_date: new Date(Date.now() + 14 * 86_400_000),
              type: "DP",
            },
          });
        }
      });
    const invoice = await invoiceCreator({
      projectId: project.id,
      title: `DP ${pct}% — ${p.clientName}`,
      amount: dpAmount,
    }).catch(() => null);

    const proposal = await this.db.proposal.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    return { proposal, project, milestone, invoice, deduped: false };
  }

  async rejectProposal(id: string) {
    const p = await this.db.proposal.findUnique({ where: { id } });
    if (!p) throw new Error(PROPOSAL_NOT_FOUND);
    if (p.status === "REJECTED") return p;
    if (p.status === "APPROVED") throw new Error(PROPOSAL_BAD_STATUS);
    return this.db.proposal.update({ where: { id }, data: { status: "REJECTED" } });
  }
}

export const proposalService = new ProposalService();
