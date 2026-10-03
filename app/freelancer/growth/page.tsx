import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { ReferralService } from "@/services/referral-service";
import { PackageService } from "@/services/package-service";
import { leadEmbedSnippet, leadEmbedUrl } from "@/lib/embed-snippet";

/**
 * F11 — Growth: dashboard konversi sederhana (view→brief→deal).
 * - brief = jumlah Lead (semua stage); deal = stage DEAL (kanban F5).
 * - view = BELUM ada (butuh tabel analytics/event — schema frozen,
 *   catat TODO, tampil "—" jujur bukan angka palsu).
 * - referral: total kode + converted (milik F11).
 */

// TODO(F5-wave-integrasi): freelancerId dari sesi Clerk, bukan demo.
const FREELANCER_ID = "demo-freelancer";

export const dynamic = "force-dynamic";

async function createReferralCode(form: FormData) {
  "use server";
  const svc = new ReferralService(prisma as never);
  const custom = String(form.get("code") || "").trim();
  await svc.createReferralCode(FREELANCER_ID, custom || undefined);
  revalidatePath("/freelancer/growth");
}

async function createPackage(form: FormData) {
  "use server";
  const svc = new PackageService(prisma as never);
  await svc.createPackage({
    freelancerId: FREELANCER_ID,
    title: String(form.get("title")),
    price: String(form.get("price")),
    description: String(form.get("description") || ""),
  });
  revalidatePath("/freelancer/growth");
}

async function togglePackage(form: FormData) {
  "use server";
  const svc = new PackageService(prisma as never);
  await svc.toggleActive(String(form.get("id")), FREELANCER_ID);
  revalidatePath("/freelancer/growth");
}

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}%`;
}

function idr(value: bigint | number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default async function GrowthPage() {
  const [leads, referrals, packages] = await Promise.all([
    prisma.lead.findMany({ where: { freelancerId: FREELANCER_ID } }).catch(() => []),
    prisma.referral.findMany({ where: { referrerId: FREELANCER_ID } }).catch(() => []),
    prisma.servicePackage.findMany({ where: { freelancerId: FREELANCER_ID } }).catch(() => []),
  ]);

  const count = (stage: string) => leads.filter((l) => l.stage === stage).length;
  const brief = leads.length;
  const deal = count("DEAL");
  const converted = referrals.filter((r) => r.converted).length;

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const snippet = leadEmbedSnippet(base, FREELANCER_ID);

  const funnel = [
    { label: "View profil", value: null as number | null, note: "butuh tabel analytics (TODO)" },
    { label: "Brief masuk", value: brief, note: `${count("BARU")} baru · ${count("NEGO")} nego` },
    { label: "Deal", value: deal, note: `${count("KALAH")} kalah` },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-bold">Growth</h1>
        <p className="text-sm text-muted-foreground">
          Konversi view→brief→deal + referral + paket jasa.{" "}
          <Link href="/freelancer/leads" className="underline">
            Buka kanban Lead
          </Link>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">View profil</p>
            {/* TODO(F11-wave-integrasi): tabel analytics/event view profil + portofolio
                (schema milik wave lain). Jangan isi angka palsu. */}
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Brief masuk (Lead)</p>
            <p className="text-2xl font-bold">{brief}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Deal (brief→deal {pct(deal, brief)})</p>
            <p className="text-2xl font-bold">{deal}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              Referral converted ({pct(converted, referrals.length)})
            </p>
            <p className="text-2xl font-bold">
              {converted}/{referrals.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {funnel.map((f) => (
            <div key={f.label} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 font-medium">{f.label}</span>
              <span className="w-12 text-right font-bold">{f.value ?? "—"}</span>
              <span className="text-xs text-muted-foreground">{f.note}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead form embeddable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Tempel di web pribadimu, atau bagikan langsung:{" "}
            <Link href={leadEmbedUrl(base, FREELANCER_ID)} className="underline" target="_blank">
              {leadEmbedUrl(base, FREELANCER_ID)}
            </Link>
          </p>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{snippet}</pre>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paket jasa ({packages.filter((p) => p.active).length} aktif)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {packages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada paket. Buat pertama di bawah.</p>
            ) : (
              packages.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium">{p.title}</span>{" "}
                    <span className="text-muted-foreground">{idr(p.price)}</span>
                  </span>
                  <form action={togglePackage} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <Badge variant="outline">{p.active ? "aktif" : "nonaktif"}</Badge>
                    <button type="submit" className="rounded border px-1.5 py-0.5 text-[11px]">
                      {p.active ? "nonaktifkan" : "aktifkan"}
                    </button>
                  </form>
                </div>
              ))
            )}
            <form action={createPackage} className="flex flex-wrap gap-2 pt-2">
              <input name="title" required placeholder="Judul paket" className="rounded border px-2 py-1.5 text-sm" />
              <input name="price" required placeholder="Harga IDR" inputMode="numeric" className="w-32 rounded border px-2 py-1.5 text-sm" />
              <input name="description" placeholder="Deskripsi singkat" className="rounded border px-2 py-1.5 text-sm" />
              <button type="submit" className="rounded bg-foreground px-3 py-1.5 text-sm text-background">
                + Paket
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kode referral ({referrals.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada kode.</p>
            ) : (
              referrals.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <code className="font-mono">{r.code}</code>
                  <Badge variant="outline">{r.converted ? "converted" : "belum dipakai"}</Badge>
                </div>
              ))
            )}
            <form action={createReferralCode} className="flex flex-wrap gap-2 pt-2">
              <input name="code" placeholder="Custom (opsional)" className="rounded border px-2 py-1.5 text-sm" />
              <button type="submit" className="rounded bg-foreground px-3 py-1.5 text-sm text-background">
                + Kode
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
