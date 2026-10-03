"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { downloadCsv, toCsv, type CsvCell } from "@/lib/export-csv";

export type RevenuePoint = { month: string; revenue: number; outstanding: number };
export type ClientPoint = { name: string; total: number };

function moneyTick(value: number | string): string {
  const n = Number(value);
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}rb`;
  return String(n);
}

/** F6 — grafik revenue/bulan vs outstanding + per-klien (recharts). */
export function RevenueChart({
  monthly,
  perClient,
}: {
  monthly: RevenuePoint[];
  perClient: ClientPoint[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <h2 className="text-sm font-semibold">Revenue / bulan</h2>
        <p className="text-xs text-muted-foreground">PAID vs belum terbayar</p>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={moneyTick} tick={{ fontSize: 12 }} width={48} />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" name="Diterima" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <h2 className="text-sm font-semibold">Revenue per klien</h2>
        <p className="text-xs text-muted-foreground">Akumulasi invoice PAID</p>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={perClient}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tickFormatter={moneyTick} tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={110} />
              <Tooltip />
              <Bar dataKey="total" name="Total" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/** Tombol ekspor CSV (client) — header+rows disiapkan server. */
export function CsvExportButton({
  filename,
  headers,
  rows,
  label = "Ekspor CSV",
}: {
  filename: string;
  headers: string[];
  rows: CsvCell[][];
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, toCsv(headers, rows))}
      className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
    >
      {label}
    </button>
  );
}
