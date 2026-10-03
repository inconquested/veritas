import prisma from "@/lib/prisma";

/**
 * F11 — Growth: paket jasa productized (rate card) milik freelancer.
 * Dipakai profil publik `/u/[username]` (hanya yang `active`) + dashboard
 * `/freelancer/growth` (CRUD + toggle).
 *
 * Bentuk `db` struktural agar bisa diuji dengan mock tanpa DB.
 */

export const PACKAGE_NOT_FOUND = "errors.package.not_found";
export const PACKAGE_FORBIDDEN = "errors.package.forbidden";
export const PACKAGE_EMPTY_TITLE = "errors.package.empty_title";
export const PACKAGE_BAD_PRICE = "errors.package.bad_price";

export type CreatePackageInput = {
  freelancerId: string;
  title: string;
  price: bigint | number | string;
  description?: string | null;
};

export type UpdatePackagePatch = {
  title?: string;
  price?: bigint | number | string;
  description?: string | null;
};

export type PackageRow = {
  id: string;
  freelancerId: string;
  title: string;
  price: bigint;
  description: string | null;
  active: boolean;
};

type PackageDb = {
  servicePackage: {
    findMany(args: unknown): Promise<PackageRow[]>;
    findUnique(args: unknown): Promise<PackageRow | null>;
    create(args: unknown): Promise<PackageRow>;
    update(args: unknown): Promise<PackageRow>;
    delete(args: unknown): Promise<PackageRow>;
  };
};

function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value.trim());
}

export class PackageService {
  constructor(private readonly db: PackageDb = prisma as never) {}

  async createPackage(input: CreatePackageInput) {
    if (!input.freelancerId) throw new Error("errors.package.missing_freelancer");
    if (!input.title?.trim()) throw new Error(PACKAGE_EMPTY_TITLE);
    let price: bigint;
    try {
      price = toBigInt(input.price);
    } catch {
      throw new Error(PACKAGE_BAD_PRICE);
    }
    if (price <= 0n) throw new Error(PACKAGE_BAD_PRICE);
    return this.db.servicePackage.create({
      data: {
        freelancerId: input.freelancerId,
        title: input.title.trim(),
        price,
        description: input.description?.trim() || null,
        active: true,
      },
    });
  }

  async listPackages(freelancerId: string, opts: { activeOnly?: boolean } = {}) {
    if (!freelancerId) throw new Error("errors.package.missing_freelancer");
    return this.db.servicePackage.findMany({
      where: {
        freelancerId,
        ...(opts.activeOnly ? { active: true } : {}),
      },
      orderBy: { price: "asc" },
    });
  }

  async getPackage(id: string) {
    const row = await this.db.servicePackage.findUnique({ where: { id } });
    if (!row) throw new Error(PACKAGE_NOT_FOUND);
    return row;
  }

  /** Guard kepemilikan: semua mutasi wajib sertakan freelancerId pemilik. */
  private assertOwner(row: PackageRow, freelancerId: string) {
    if (row.freelancerId !== freelancerId) throw new Error(PACKAGE_FORBIDDEN);
  }

  async updatePackage(id: string, freelancerId: string, patch: UpdatePackagePatch) {
    const row = await this.getPackage(id);
    this.assertOwner(row, freelancerId);
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) {
      if (!patch.title?.trim()) throw new Error(PACKAGE_EMPTY_TITLE);
      data.title = patch.title.trim();
    }
    if (patch.price !== undefined) {
      let price: bigint;
      try {
        price = toBigInt(patch.price);
      } catch {
        throw new Error(PACKAGE_BAD_PRICE);
      }
      if (price <= 0n) throw new Error(PACKAGE_BAD_PRICE);
      data.price = price;
    }
    if (patch.description !== undefined) data.description = patch.description?.trim() || null;
    return this.db.servicePackage.update({ where: { id }, data });
  }

  async toggleActive(id: string, freelancerId: string) {
    const row = await this.getPackage(id);
    this.assertOwner(row, freelancerId);
    return this.db.servicePackage.update({ where: { id }, data: { active: !row.active } });
  }

  async deletePackage(id: string, freelancerId: string) {
    const row = await this.getPackage(id);
    this.assertOwner(row, freelancerId);
    await this.db.servicePackage.delete({ where: { id } });
    return true;
  }
}

export const packageService = new PackageService();
