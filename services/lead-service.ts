import prisma from "@/lib/prisma";

/** Kanban: Baru → Nego → Deal, Kalah dari mana saja. */
export const LEAD_STAGES = ["BARU", "NEGO", "DEAL", "KALAH"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_NOT_FOUND = "errors.lead.not_found";
export const LEAD_BAD_STAGE = "errors.lead.bad_stage";
export const LEAD_EMPTY = "errors.lead.empty_name";

export type CreateLeadInput = {
  freelancerId: string;
  name: string;
  contact?: string | null;
  source?: string | null;
  notes?: string | null;
};

/** F5 CRM mini. `db` loose-typed agar bisa diuji dengan mock. */
export class LeadService {
  constructor(private readonly db: any = prisma as any) {}

  private assertStage(stage: string): asserts stage is LeadStage {
    if (!(LEAD_STAGES as readonly string[]).includes(String(stage))) {
      throw new Error(LEAD_BAD_STAGE);
    }
  }

  createLead(input: CreateLeadInput) {
    if (!input.freelancerId) throw new Error("errors.lead.missing_freelancer");
    if (!input.name?.trim()) throw new Error(LEAD_EMPTY);
    return this.db.lead.create({
      data: {
        freelancerId: input.freelancerId,
        name: input.name.trim(),
        contact: input.contact?.trim() || null,
        source: input.source?.trim() || null,
        stage: "BARU",
        notes: input.notes?.trim() || null,
      },
    });
  }

  listLeads(freelancerId: string) {
    if (!freelancerId) throw new Error("errors.lead.missing_freelancer");
    return this.db.lead.findMany({
      where: { freelancerId },
      orderBy: { name: "asc" },
    });
  }

  async getLead(id: string) {
    const row = await this.db.lead.findUnique({ where: { id } });
    if (!row) throw new Error(LEAD_NOT_FOUND);
    return row;
  }

  async updateLead(id: string, patch: Partial<Pick<CreateLeadInput, "name" | "contact" | "source" | "notes">>) {
    await this.getLead(id);
    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      if (!patch.name?.trim()) throw new Error(LEAD_EMPTY);
      data.name = patch.name.trim();
    }
    if (patch.contact !== undefined) data.contact = patch.contact?.trim() || null;
    if (patch.source !== undefined) data.source = patch.source?.trim() || null;
    if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
    return this.db.lead.update({ where: { id }, data });
  }

  async moveStage(id: string, stage: string) {
    this.assertStage(stage);
    await this.getLead(id);
    return this.db.lead.update({ where: { id }, data: { stage } });
  }

  async deleteLead(id: string) {
    await this.getLead(id);
    await this.db.lead.delete({ where: { id } });
    return true;
  }
}

export const leadService = new LeadService();
