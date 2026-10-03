import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { ProposalService, calcProposalTotal } from "@/services/proposal-service";
import ProposalBuilder, { type BuilderItem } from "@/components/proposal-builder";

export const dynamic = "force-dynamic";

function money(v: bigint | number | string): string {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(v));
  } catch {
    return `Rp${String(v)}`;
  }
}

async function createProposal(input: { clientName: string; items: BuilderItem[] }) {
  "use server";
  // TODO(F5-wave-integrasi): freelancerId dari sesi Clerk (auth()), bukan demo.
  const svc = new ProposalService(prisma as any);
  await svc.createProposal({ freelancerId: "demo-freelancer", ...input });
  revalidatePath("/freelancer/proposals");
}

async function sendProposal(form: FormData) {
  "use server";
  const svc = new ProposalService(prisma as any);
  await svc.sendProposal(String(form.get("id")));
  revalidatePath("/freelancer/proposals");
}

export default async function ProposalsPage() {
  const svc = new ProposalService(prisma as any);
  const rows = (await svc.listProposals().catch(() => [])) as {
    id: string;
    clientName: string;
    items: { title: string; qty: number; price: string }[] | null;
    total: bigint;
    status: string;
  }[];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-bold">Proposal</h1>
        <p className="text-sm text-muted-foreground">
          Buat penawaran → kirim link WA ke klien → approve otomatis jadi project + invoice DP.
        </p>
      </header>
      <ProposalBuilder onCreate={createProposal} />
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada proposal.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(r.total)} · {r.status} · {(r.items ?? []).length} item
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a className="rounded border px-2 py-1 text-xs" href={`/proposals/${r.id}`}>
                    Link klien
                  </a>
                  {r.status === "DRAFT" ? (
                    <form action={sendProposal}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded border px-2 py-1 text-xs" type="submit">
                        Kirim
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Total otomatis: {money(calcProposalTotal((r.items ?? []) as never))}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
