"use client";

import { useMemo, useState } from "react";

export type BuilderItem = { title: string; qty: number; price: number };

function idr(n: number): string {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return `Rp${n}`;
  }
}

export default function ProposalBuilder({
  onCreate,
}: {
  onCreate: (input: { clientName: string; items: BuilderItem[] }) => Promise<void>;
}) {
  const [clientName, setClientName] = useState("");
  const [items, setItems] = useState<BuilderItem[]>([{ title: "", qty: 1, price: 0 }]);
  const [busy, setBusy] = useState(false);

  const total = useMemo(
    () => items.reduce((s, it) => s + (Math.trunc(Number(it.qty)) || 0) * (Number(it.price) || 0), 0),
    [items],
  );

  const set = (i: number, patch: Partial<BuilderItem>) =>
    setItems((prev) => prev.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  const submit = async () => {
    if (!clientName.trim() || items.every((it) => !it.title.trim())) return;
    setBusy(true);
    try {
      await onCreate({
        clientName: clientName.trim(),
        items: items
          .filter((it) => it.title.trim())
          .map((it) => ({
            title: it.title.trim(),
            qty: Math.max(1, Math.trunc(Number(it.qty)) || 1),
            price: Math.max(0, Number(it.price) || 0),
          })),
      });
      setClientName("");
      setItems([{ title: "", qty: 1, price: 0 }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Proposal baru</h2>
      <input
        className="mt-2 w-full rounded border px-2 py-1.5 text-sm"
        placeholder="Nama klien (mis. PT Maju)"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
      />
      <div className="mt-3 space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded border px-2 py-1.5 text-sm"
              placeholder={`Item ${i + 1} (mis. Desain landing page)`}
              value={it.title}
              onChange={(e) => set(i, { title: e.target.value })}
            />
            <input
              type="number"
              min={1}
              className="w-16 rounded border px-2 py-1.5 text-sm"
              value={it.qty}
              onChange={(e) => set(i, { qty: Number(e.target.value) })}
            />
            <input
              type="number"
              min={0}
              className="w-32 rounded border px-2 py-1.5 text-sm"
              placeholder="Harga"
              value={it.price || ""}
              onChange={(e) => set(i, { price: Number(e.target.value) })}
            />
            <button
              type="button"
              className="rounded border px-2 text-sm"
              onClick={() => setItems((prev) => prev.filter((_, k) => k !== i))}
              disabled={items.length === 1}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm"
          onClick={() => setItems((prev) => [...prev, { title: "", qty: 1, price: 0 }])}
        >
          + Item
        </button>
        <p className="text-sm">
          Total: <strong>{idr(total)}</strong>
        </p>
      </div>
      <button
        type="button"
        className="mt-3 w-full rounded bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50"
        onClick={submit}
        disabled={busy || !clientName.trim() || total <= 0}
      >
        {busy ? "Menyimpan…" : "Simpan proposal (DRAFT)"}
      </button>
    </div>
  );
}
