import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { ProposalService } from "@/services/proposal-service";

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

async function approve(form: FormData) {
  "use server";
  const svc = new ProposalService(prisma as any);
  // TODO(F5-share-token): ganti token sementara (Proposal.id di URL) dengan
  // share-token revocable ala ProjectShareToken + expiry.
  await svc.approveProposal(String(form.get("id")), {
    clientId: String(form.get("clientId") || "demo-client"),
  });
}

async function reject(form: FormData) {
  "use server";
  const svc = new ProposalService(prisma as any);
  await svc.rejectProposal(String(form.get("id")));
}

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const svc = new ProposalService(prisma as any);
  const p = (await svc.getProposal(id).catch(() => null)) as {
    id: string;
    clientName: string;
    items: { title: string; qty: number; price: string }[] | null;
    total: bigint;
    status: string;
  } | null;
  if (!p) notFound();

  const items = p.items ?? [];
  const done = p.status === "APPROVED" || p.status === "REJECTED";

  return (
    <div className="mx-auto max-w-xl space-y-5 p-6">
      <header>
        <p className="text-xs uppercase text-muted-foreground">Penawaran freelance</p>
        <h1 className="text-2xl font-bold">{p.clientName}</h1>
        <p className="mt-1 text-sm">
          Status: <strong>{p.status}</strong>
        </p>
      </header>
      <div className="rounded-lg border">
        {items.map((it, i) => (
          <div key={i} className="flex justify-between gap-3 border-b p-3 text-sm last:border-0">
            <span>
              {it.title} <span className="text-muted-foreground">× {it.qty}</span>
            </span>
            <span>{money(BigInt(it.qty) * BigInt(it.price))}</span>
          </div>
        ))}
        <div className="flex justify-between p-3 text-sm font-semibold">
          <span>Total</span>
          <span>{money(p.total)}</span>
        </div>
      </div>
      {!done ? (
        <div className="flex gap-2">
          <form action={approve} className="flex-1">
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="clientId" value="demo-client" />
            <button
              type="submit"
              className="w-full rounded bg-foreground px-3 py-2 text-sm text-background"
            >
              Setuju & mulai project
            </button>
          </form>
          <form action={reject} className="flex-1">
            <input type="hidden" name="id" value={p.id} />
            <button type="submit" className="w-full rounded border px-3 py-2 text-sm">
              Tolak
            </button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {p.status === "APPROVED"
            ? "Penawaran disetujui — project + invoice DP sudah dibuat otomatis."
            : "Penawaran ini ditolak."}
        </p>
      )}
    </div>
  );
}
