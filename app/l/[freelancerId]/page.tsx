import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
// Import read-only dari lead-service milik F5 — JANGAN edit file tersebut.
import { LeadService } from "@/services/lead-service";
import { parseUtm, leadSourceFromUtm } from "@/lib/utm";

/**
 * F11 — Growth: lead form publik embeddable `/l/[freelancerId]`.
 * Klien isi brief (budget, deadline, tipe, kontak) → masuk kanban Lead
 * Fase 5 sebagai stage BARU. Bisa ditanam via `<iframe>`
 * (snippet: `lib/embed-snippet.ts`) atau dibagikan sebagai link + UTM.
 *
 * Lead model F5 tidak punya kolom budget/deadline/tipe → diringkas ke
 * `notes`, UTM ke `source`. Tanpa ubah schema/service fase lain.
 */

type Params = { freelancerId: string };
type Sp = Record<string, string | string[] | undefined>;

const PROJECT_TYPES = ["Landing Page", "Aplikasi Web", "Desain", "Maintenance", "Lainnya"] as const;
const BUDGETS = ["< Rp1jt", "Rp1–5jt", "Rp5–15jt", "> Rp15jt"] as const;

export default async function PublicLeadFormPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Sp>;
}) {
  const { freelancerId } = await params;
  const sp = await searchParams;
  const source = leadSourceFromUtm(parseUtm(sp), "embed");
  const ok = sp.ok === "1";

  const freelancer = await prisma.user
    .findUnique({
      where: { id: freelancerId },
      select: { id: true, email: true, firstName: true, lastName: true, instanceName: true },
    })
    .catch(() => null);
  if (!freelancer) notFound();
  const name =
    [freelancer.firstName, freelancer.lastName].filter(Boolean).join(" ") ||
    freelancer.instanceName ||
    freelancer.email;

  async function submitBrief(form: FormData) {
    "use server";
    const svc = new LeadService(prisma as any);
    const tipe = String(form.get("tipe") || "").trim();
    const budget = String(form.get("budget") || "").trim();
    const deadline = String(form.get("deadline") || "").trim();
    const pesan = String(form.get("pesan") || "").trim();
    const notes = [
      `Tipe: ${tipe || "-"}`,
      `Budget: ${budget || "-"}`,
      `Deadline: ${deadline || "-"}`,
      pesan ? `---\n${pesan}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const lead = await svc.createLead({
      freelancerId,
      name: String(form.get("name")),
      contact: String(form.get("contact") || ""),
      source: String(form.get("source") || "embed"),
      notes,
    });
    // Wave integrasi: auto-reply WA ke kontak klien bila freelancer pasang
    // waNumber (best-effort; gagal notif ≠ gagal simpan lead).
    try {
      const { send } = await import("@/services/vendor/notify/notify-service");
      const contact = String(form.get("contact") || "").trim();
      const profile = contact && !contact.includes("@")
        ? await (prisma as any).freelancerProfile
            .findFirst({
              where: { userId: freelancerId },
              select: { waNumber: true },
            })
            .catch(() => null)
        : null;
      if (profile?.waNumber) {
        await send(contact, "lead.auto_reply", {
          entityId: String((lead as any)?.id ?? `${freelancerId}:${Date.now()}`),
          projectTitle: name || freelancerId,
          invoiceTitle: String(form.get("name") || "Brief"),
          amount: budget || null,
          currency: "IDR",
        });
      }
    } catch {
      // Best-effort: lead sudah tersimpan di atas.
    }
    redirect(`/l/${freelancerId}?ok=1`);
  }

  if (ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-6 text-center">
            <p className="text-lg font-semibold">Brief terkirim ✓</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {name} akan menghubungimu via kontak yang kamu isi. Biasanya &lt; 1×24 jam.
            </p>
            <Link href={`/u/${freelancerId}`} className="mt-4 inline-block text-sm underline">
              Lihat profil {name}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <header className="space-y-1">
        <Badge variant="outline">Form brief — Veritas</Badge>
        <h1 className="text-xl font-bold">Kerja sama dengan {name}</h1>
        <p className="text-sm text-muted-foreground">
          Isi kebutuhanmu, langsung masuk antrean freelancer (tanpa daftar).
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brief singkat</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submitBrief} className="space-y-3">
            <input type="hidden" name="source" value={source} />
            <label className="block text-sm">
              Nama / perusahaan
              <input
                name="name"
                required
                placeholder="PT Maju Jaya"
                className="mt-1 w-full rounded border px-2 py-1.5"
              />
            </label>
            <label className="block text-sm">
              Kontak (WA / email)
              <input
                name="contact"
                required
                placeholder="08xx / nama@email.com"
                className="mt-1 w-full rounded border px-2 py-1.5"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Tipe project
                <select name="tipe" className="mt-1 w-full rounded border px-2 py-1.5" defaultValue="">
                  <option value="">Pilih…</option>
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Budget
                <select name="budget" className="mt-1 w-full rounded border px-2 py-1.5" defaultValue="">
                  <option value="">Pilih…</option>
                  {BUDGETS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              Deadline
              <input name="deadline" type="date" className="mt-1 w-full rounded border px-2 py-1.5" />
            </label>
            <label className="block text-sm">
              Cerita kebutuhanmu
              <textarea
                name="pesan"
                rows={4}
                placeholder="Contoh: butuh landing page company profile, 5 section, referensi …"
                className="mt-1 w-full rounded border px-2 py-1.5"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded bg-foreground px-3 py-2 text-sm font-semibold text-background"
            >
              Kirim brief
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
