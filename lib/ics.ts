/**
 * F9 ICS builder — murni, tanpa I/O. Output dipakai tombol "Unduh ICS"
 * di week-calendar. Format mengikuti RFC 5545 garis besar:
 * VCALENDAR > VEVENT dengan UID/DTSTAMP/DTSTART/DTEND/SUMMARY.
 */

export type IcsEventInput = {
  id: string;
  title: string;
  start: Date | string;
  end?: Date | string | null;
  description?: string | null;
  location?: string | null;
  url?: string | null;
};

export const ICS_BAD_DATE = "errors.ics.bad_date";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date → `YYYYMMDDTHHMMSSZ` (UTC). */
export function toIcsUtc(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(ICS_BAD_DATE);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Escape teks sesuai RFC 5545: backslash, `;`, `,`, newline. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export function buildICS(
  events: IcsEventInput[],
  opts: { prodId?: string; calName?: string } = {},
): string {
  const stamp = toIcsUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${opts.prodId ?? "-//Veritas//ID"}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(opts.calName ?? "Veritas Deadlines")}`,
  ];
  for (const e of events) {
    const start = e.start instanceof Date ? e.start : new Date(e.start);
    if (Number.isNaN(start.getTime())) throw new Error(ICS_BAD_DATE);
    const end =
      e.end != null
        ? new Date(e.end as Date | string)
        : new Date(start.getTime() + ONE_HOUR_MS);
    if (Number.isNaN(end.getTime())) throw new Error(ICS_BAD_DATE);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(String(e.id))}@veritas.id`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${escapeIcsText(e.title || "(tanpa judul)")}`,
    );
    const desc = [e.description, e.url].filter(Boolean).join("\n");
    if (desc) lines.push(`DESCRIPTION:${escapeIcsText(desc)}`);
    if (e.location) lines.push(`LOCATION:${escapeIcsText(e.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
