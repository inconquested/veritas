import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { LeadService, LEAD_STAGES } from "@/services/lead-service";

export const dynamic = "force-dynamic";

async function createLead(form: FormData) {
  "use server";
  const svc = new LeadService(prisma as any);
  // TODO(F5-wave-integrasi): freelancerId dari sesi Clerk, bukan demo.
  await svc.createLead({
    freelancerId: "demo-freelancer",
    name: String(form.get("name")),
    contact: String(form.get("contact") || ""),
    source: String(form.get("source") || ""),
  });
  revalidatePath("/freelancer/leads");
}

async function moveLead(form: FormData) {
  "use server";
  const svc = new LeadService(prisma as any);
  await svc.moveStage(String(form.get("id")), String(form.get("stage")));
  revalidatePath("/freelancer/leads");
}

export default async function LeadsPage() {
  const svc = new LeadService(prisma as any);
  const rows = (await svc.listLeads("demo-freelancer").catch(() => [])) as {
    id: string;
    name: string;
    contact: string | null;
    source: string | null;
    stage: string;
  }[];
  const byStage = (s: string) => rows.filter((r) => r.stage === s);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-bold">Lead</h1>
        <p className="text-sm text-muted-foreground">Kanban mini: Baru → Nego → Deal / Kalah.</p>
      </header>
      <form action={createLead} className="flex flex-wrap gap-2">
        <input name="name" required placeholder="Nama / perusahaan" className="rounded border px-2 py-1.5 text-sm" />
        <input name="contact" placeholder="Kontak (WA/email)" className="rounded border px-2 py-1.5 text-sm" />
        <input name="source" placeholder="Sumber" className="rounded border px-2 py-1.5 text-sm" />
        <button type="submit" className="rounded bg-foreground px-3 py-1.5 text-sm text-background">
          + Lead
        </button>
      </form>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {LEAD_STAGES.map((s) => (
          <div key={s} className="rounded-lg border p-3">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">
              {s} ({byStage(s).length})
            </h2>
            <div className="mt-2 space-y-2">
              {byStage(s).map((l) => (
                <div key={l.id} className="rounded border p-2 text-sm">
                  <p className="font-medium">{l.name}</p>
                  {l.contact ? <p className="text-xs text-muted-foreground">{l.contact}</p> : null}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {LEAD_STAGES.filter((t) => t !== l.stage).map((t) => (
                      <form key={t} action={moveLead}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="stage" value={t} />
                        <button type="submit" className="rounded border px-1.5 py-0.5 text-[11px]">
                          → {t}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
