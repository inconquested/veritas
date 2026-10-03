import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";

export const CONTRACT_NOT_FOUND = "errors.contract.not_found";
export const CONTRACT_EXISTS = "errors.contract.exists";
export const CONTRACT_EMPTY_BODY = "errors.contract.empty_body";
export const CONTRACT_EMPTY_NAME = "errors.contract.empty_name";
export const CONTRACT_BAD_ROLE = "errors.contract.bad_role";

export const SIGN_ROLES = ["FREELANCER", "CLIENT"] as const;
export type SignRole = (typeof SIGN_ROLES)[number];

/** SHA-256 hex body kontrak — e-sign v1 tanpa signature pad. */
export function hashContractBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

function normalizeRole(role: string): SignRole {
  const r = String(role ?? "").trim().toUpperCase();
  if (r !== "FREELANCER" && r !== "CLIENT") throw new Error(CONTRACT_BAD_ROLE);
  return r;
}

export type ContractRow = {
  id: string;
  project_id: string;
  body: string;
  freelancerSignedAt: Date | string | null;
  clientSignedAt: Date | string | null;
  bodyHash: string | null;
  pdfUrl?: string | null;
};

/**
 * F5 e-sign v1: nama ketik + timestamp + bodyHash. Kontrak yang diubah setelah
 * kedua pihak signed = invalid (bandingkan hash saat baca).
 */
export class ContractService {
  constructor(private readonly db: any = prisma as any) {}

  async createContract(projectId: string, body: string, opts: { pdfUrl?: string } = {}) {
    if (!projectId) throw new Error(CONTRACT_NOT_FOUND);
    if (!body?.trim()) throw new Error(CONTRACT_EMPTY_BODY);
    const existing = await this.db.contract.findUnique({ where: { project_id: projectId } });
    if (existing) throw new Error(CONTRACT_EXISTS);
    return this.db.contract.create({
      data: {
        project_id: projectId,
        body,
        bodyHash: hashContractBody(body),
        pdfUrl: opts.pdfUrl ?? null,
      },
    });
  }

  getContract(projectId: string): Promise<ContractRow | null> {
    if (!projectId) throw new Error(CONTRACT_NOT_FOUND);
    return this.db.contract.findUnique({ where: { project_id: projectId } });
  }

  async signContract(projectId: string, role: string, signerName: string) {
    const r = normalizeRole(role);
    if (!signerName?.trim()) throw new Error(CONTRACT_EMPTY_NAME);
    const c = (await this.db.contract.findUnique({ where: { project_id: projectId } })) as ContractRow | null;
    if (!c) throw new Error(CONTRACT_NOT_FOUND);
    const field = r === "FREELANCER" ? "freelancerSignedAt" : "clientSignedAt";
    if (c[field]) return c; // idempoten: tanda tangan kedua = no-op
    const data: Record<string, unknown> = { [field]: new Date() };
    if (!c.bodyHash) data.bodyHash = hashContractBody(c.body); // backfill baris lama
    return this.db.contract.update({ where: { project_id: projectId }, data });
  }

  /**
   * Update isi kontrak. Jika SUDAH fully-signed, hash lama dipertahankan agar
   * pembacaan berikutnya = invalid (by design). Jika belum, hash ikut baru.
   */
  async updateContractBody(projectId: string, newBody: string) {
    if (!newBody?.trim()) throw new Error(CONTRACT_EMPTY_BODY);
    const c = (await this.db.contract.findUnique({ where: { project_id: projectId } })) as ContractRow | null;
    if (!c) throw new Error(CONTRACT_NOT_FOUND);
    const fullySigned = Boolean(c.freelancerSignedAt && c.clientSignedAt);
    return this.db.contract.update({
      where: { project_id: projectId },
      data: fullySigned ? { body: newBody } : { body: newBody, bodyHash: hashContractBody(newBody) },
    });
  }

  /** Murni: valid jika belum fully-signed, atau hash cocok setelah fully-signed. */
  isContractValid(c: ContractRow): boolean {
    if (!c.freelancerSignedAt || !c.clientSignedAt) return true;
    if (!c.bodyHash) return false;
    return hashContractBody(c.body) === c.bodyHash;
  }

  async verifyContract(projectId: string) {
    const c = (await this.getContract(projectId)) as ContractRow | null;
    if (!c) throw new Error(CONTRACT_NOT_FOUND);
    const fullySigned = Boolean(c.freelancerSignedAt && c.clientSignedAt);
    const hashMatches = c.bodyHash ? hashContractBody(c.body) === c.bodyHash : false;
    return { contract: c, fullySigned, hashMatches, valid: this.isContractValid(c) };
  }
}

export const contractService = new ContractService();
