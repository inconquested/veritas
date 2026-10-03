import assert from "node:assert/strict";
import test from "node:test";

import {
  AttachmentService,
  ATTACHMENT_VERSION_NOT_FOUND,
} from "../services/attachment-service";
import { buildICS, escapeIcsText, toIcsUtc } from "../lib/ics";

function createMockDb() {
  const rows: any[] = [];
  const db = {
    rows,
    attachment: {
      create: async (q: any) => {
        const row = { id: `a${rows.length + 1}`, ...q.data };
        rows.push(row);
        return row;
      },
      findMany: async (q: any) => {
        const where = q?.where ?? {};
        let list = rows.filter((r) =>
          Object.entries(where).every(([k, v]) => (r as any)[k] === v),
        );
        if (q?.orderBy?.version === "desc") list = [...list].sort((a, b) => b.version - a.version);
        if (q?.orderBy?.version === "asc") list = [...list].sort((a, b) => a.version - b.version);
        if (typeof q?.take === "number") list = list.slice(0, q.take);
        return list;
      },
    },
  };
  return { db, rows };
}

const base = { parentType: "task", parentId: "t1", uploader: "u1" };

test("addAttachment auto version+1 per parent", async () => {
  const { db } = createMockDb();
  const svc = new AttachmentService(db as any);
  const v1 = await svc.addAttachment({ ...base, url: "https://cdn/v1.png" });
  const v2 = await svc.addAttachment({ ...base, url: "https://cdn/v2.png", note: "revisi" });
  const other = await svc.addAttachment({ parentType: "task", parentId: "t2", url: "https://cdn/x.png" });
  assert.equal(v1.version, 1);
  assert.equal(v2.version, 2);
  assert.equal(other.version, 1); // parent lain mulai dari 1
});

test("getVersions urut naik", async () => {
  const { db } = createMockDb();
  const svc = new AttachmentService(db as any);
  await svc.addAttachment({ ...base, url: "https://cdn/v1.png" });
  await svc.addAttachment({ ...base, url: "https://cdn/v2.png" });
  const list = await svc.getVersions("task", "t1");
  assert.deepEqual(list.map((r: any) => r.version), [1, 2]);
});

test("revert mengembalikan URL versi N sebagai versi baru", async () => {
  const { db } = createMockDb();
  const svc = new AttachmentService(db as any);
  await svc.addAttachment({ ...base, url: "https://cdn/v1.png" });
  await svc.addAttachment({ ...base, url: "https://cdn/v2-buruk.png" });
  const v3 = await svc.revertTo("task", "t1", 1, { uploader: "u1" });
  assert.equal(v3.url, "https://cdn/v1.png");
  assert.equal(v3.version, 3);
  assert.match(String(v3.note ?? ""), /v1/);
});

test("revert ke versi tak ada = ditolak", async () => {
  const { db } = createMockDb();
  const svc = new AttachmentService(db as any);
  await svc.addAttachment({ ...base, url: "https://cdn/v1.png" });
  await assert.rejects(
    () => svc.revertTo("task", "t1", 9),
    new RegExp(ATTACHMENT_VERSION_NOT_FOUND.replace(/\./g, "\\.")),
  );
});

test("uploadFiles mendelegasikan ke media-service (Cloudinary, read-only)", async () => {
  const { db } = createMockDb();
  const fakeMedia = {
    uploadMediaMultiple: async (files: unknown[]) => files.map(() => "https://cdn/u.png"),
  };
  const svc = new AttachmentService(db as any, fakeMedia as any);
  assert.deepEqual(await svc.uploadFiles([{}, {}] as any), ["https://cdn/u.png", "https://cdn/u.png"]);
});

// ---------------------------------------------------------------------------
// ICS valid: DTSTART/DTEND/SUMMARY ada, escape benar, default durasi 1 jam
// ---------------------------------------------------------------------------

test("toIcsUtc format UTC + tanggal buruk ditolak", () => {
  assert.equal(toIcsUtc(new Date(Date.UTC(2026, 9, 5, 1, 2, 3))), "20261005T010203Z");
  assert.throws(() => toIcsUtc("bukan-tanggal"), /bad_date/);
  assert.equal(escapeIcsText("a;b,c\\d\ne"), "a\\;b\\,c\\\\d\\ne");
});

test("buildICS valid: VCALENDAR/VEVENT + DTSTART/DTEND/SUMMARY", () => {
  const ics = buildICS(
    [
      { id: "task-1", title: "Desain hero", start: new Date(Date.UTC(2026, 9, 5, 9, 0, 0)) },
      {
        id: "inv-2",
        title: "Invoice Termin 2",
        start: "2026-10-06T09:00:00Z",
        end: "2026-10-06T10:30:00Z",
        description: "Jatuh tempo",
      },
    ],
    { calName: "Veritas Deadlines" },
  );
  assert.ok(ics.includes("BEGIN:VCALENDAR"));
  assert.ok(ics.includes("END:VCALENDAR"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.ok(ics.includes("DTSTART:20261005T090000Z"));
  assert.ok(ics.includes("DTEND:20261005T100000Z"), "default +1 jam saat end kosong");
  assert.ok(ics.includes("DTEND:20261006T103000Z"));
  assert.ok(ics.includes("SUMMARY:Desain hero"));
  assert.ok(ics.includes("UID:task-1@veritas.id"));
  assert.ok(ics.endsWith("\r\n"));
});
