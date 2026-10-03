"use client";

/**
 * F10 — Tombol start/stop timer (dumb, tanpa server import).
 * Dipakai di dalam <form action={...}> halaman time — tombol = submit.
 * `elapsed` hanya display (sumber durasi = input minutes saat stop).
 */
export default function TimerButton({
  mode,
  elapsed,
  disabled,
}: {
  mode: "start" | "stop";
  elapsed?: string;
  disabled?: boolean;
}) {
  if (mode === "start") {
    return (
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <span aria-hidden>▶</span> Mulai
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-3">
      {elapsed ? (
        <span className="font-mono text-lg font-semibold tabular-nums" aria-live="polite">
          {elapsed}
        </span>
      ) : null}
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        <span aria-hidden>■</span> Stop
      </button>
    </span>
  );
}
