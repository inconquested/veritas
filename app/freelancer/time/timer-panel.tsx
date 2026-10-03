"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import TimerButton from "@/components/timer-button";
import {
  manualTimeAction,
  startTimerAction,
  stopTimerAction,
} from "@/actions/time";

/**
 * F10 — Panel timer (client): pilih project + rate + start; saat aktif
 * tampil tick live (display saja) + form stop dengan koreksi menit.
 * Start-ts disimpan di localStorage per entry; sumber durasi resmi =
 * input `minutes` yang di-submit (server validasi 1–1440).
 */

const LS_KEY = "veritas-timer-start";

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

export default function TimerPanel({
  projects,
  active,
}: {
  projects: { id: string; title: string }[];
  active: { id: string; project_id: string } | null;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  const [startMs, setStartMs] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
    run: (fd: FormData) => Promise<{ success: boolean; error?: string }>,
    after?: () => void,
  ) {
    event.preventDefault();
    setError(null);
    const res = await run(new FormData(event.currentTarget));
    if (!res.success) {
      setError(res.error ?? "Gagal.");
      return;
    }
    after?.();
    router.refresh();
  }

  React.useEffect(() => {
    if (!active) return;
    const saved = Number(localStorage.getItem(`${LS_KEY}:${active.id}`) ?? "");
    setStartMs(Number.isFinite(saved) && saved > 0 ? saved : Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  if (!active) {
    return (
      <div className="space-y-2">
      <form
        onSubmit={(e) =>
          submit(e, startTimerAction, () =>
            localStorage.setItem(`${LS_KEY}:pending`, String(Date.now())),
          )
        }
        className="flex flex-wrap items-end gap-2"
      >
        <label className="grid gap-1 text-xs">
          Project
          <select
            name="project_id"
            required
            className="min-w-44 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            <option value="">— pilih —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Rate/jam (IDR, opsional)
          <input
            name="rate"
            inputMode="numeric"
            placeholder="150000"
            className="w-36 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <TimerButton mode="start" disabled={projects.length === 0} />
      </form>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  const elapsedMs = now - (startMs ?? now);
  const tickMinutes = Math.max(1, Math.round(elapsedMs / 60_000));

  return (
    <div className="space-y-2">
    <form
      onSubmit={(e) =>
        submit(e, stopTimerAction, () =>
          localStorage.removeItem(`${LS_KEY}:${active.id}`),
        )
      }
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="entryId" value={active.id} />
      <TimerButton mode="stop" elapsed={fmt(elapsedMs)} />
      <label className="grid gap-1 text-xs">
        Menit (koreksi bila perlu)
        <input
          name="minutes"
          type="number"
          min={1}
          max={1440}
          required
          defaultValue={tickMinutes}
          key={tickMinutes}
          className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <span className="pb-1.5 text-xs text-muted-foreground">
        Timer jalan — stop mengisi durasi ke timesheet (DRAFT).
      </span>
    </form>
    {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/** Entri manual (lupa nyalakan timer) — pola onSubmit repo. */
export function ManualTimeForm({
  projects,
}: {
  projects: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const res = await manualTimeAction(new FormData(event.currentTarget));
    if (!res.success) {
      setError(res.error);
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <div className="space-y-2">
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs">
        Project
        <select
          name="project_id"
          required
          className="min-w-44 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="">— pilih —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs">
        Menit
        <input
          name="minutes"
          type="number"
          min={1}
          max={1440}
          required
          placeholder="480"
          className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <label className="grid gap-1 text-xs">
        Rate/jam (IDR)
        <input
          name="rate"
          inputMode="numeric"
          placeholder="150000"
          className="w-36 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
      >
        + Entri manual
      </button>
    </form>
    {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
