import assert from "node:assert/strict";
import test from "node:test";

import {
  ExpenseService,
  assertExpenseTotal,
  splitExpenseLabel,
  type ExpenseRow,
} from "../services/expense-service";

function createMockDb() {
  const rows: ExpenseRow[] = [];
  let seq = 0;
  const db = {
    expense: {
      findMany: async (q: {
        where: { freelancerId?: string; project_id?: string };
      }) =>
        rows.filter(
          (r) =>
            (q.where.freelancerId === undefined || r.freelancerId === q.where.freelancerId) &&
            (q.where.project_id === undefined || r.project_id === q.where.project_id),
        ),
      create: async (q: { data: Omit<ExpenseRow, "id"> }) => {
        const row: ExpenseRow = { id: `e${++seq}`, ...q.data };
        rows.push(row);
        return row;
      },
    },
  };
  return { db, rows };
}

const BASE = { freelancerId: "fl-1", label: "Tol + parkir", amount: 75_000 };

test("expense tanpa foto = ditolak", async () => {
  const { db, rows } = createMockDb();
  const service = new ExpenseService(db as never);
  await assert.rejects(() => service.addExpense({ ...BASE }), /missing_receipt/);
  await assert.rejects(
    () => service.addExpense({ ...BASE, receiptUrl: "   " }),
    /missing_receipt/,
  );
  assert.equal(rows.length, 0);
});

test("dengan foto = tersimpan; kategori jadi prefix label", async () => {
  const { db, rows } = createMockDb();
  const service = new ExpenseService(db as never);
  const row = await service.addExpense({
    ...BASE,
    receiptUrl: "https://res.cloudinary.com/x/bon.jpg",
    category: "transport",
    project_id: "p1",
  });
  assert.ok(row.id);
  assert.equal(row.receiptUrl, "https://res.cloudinary.com/x/bon.jpg");
  assert.equal(rows.length, 1);
  const split = splitExpenseLabel(row.label);
  assert.equal(split.category, "TRANSPORT");
  assert.equal(split.label, "Tol + parkir");
});

test("totalPerProject menjumlah per project; list filter freelancer", async () => {
  const { db } = createMockDb();
  const service = new ExpenseService(db as never);
  const url = "https://res.cloudinary.com/x/b.jpg";
  await service.addExpense({ ...BASE, amount: 50_000, receiptUrl: url, project_id: "p1" });
  await service.addExpense({ ...BASE, amount: 25_000, receiptUrl: url, project_id: "p1" });
  await service.addExpense({
    ...BASE,
    amount: 10_000,
    receiptUrl: url,
    project_id: "p2",
  });
  assert.equal(await service.totalPerProject("p1"), 75_000n);
  assert.equal(await service.totalPerProject("p2"), 10_000n);
  assert.equal(await service.totalPerProject("p3"), 0n);
  assert.equal((await service.listExpenses("fl-1", "p1")).length, 2);
  assert.equal((await service.listExpenses("fl-1")).length, 3);
});

test("OCR manual: rincian != total = tolak", () => {
  assertExpenseTotal([25_000, 50_000], 75_000); // cocok = lolos
  assert.throws(() => assertExpenseTotal([25_000, 50_000], 80_000), /total_mismatch/);
  assert.throws(() => assertExpenseTotal([], 100), /total_mismatch/);
});

test("label kosong / nominal nol-negatif / tanggal rusak = tolak", async () => {
  const { db } = createMockDb();
  const service = new ExpenseService(db as never);
  const url = "https://res.cloudinary.com/x/b.jpg";
  await assert.rejects(
    () => service.addExpense({ ...BASE, label: "  ", receiptUrl: url }),
    /missing_label/,
  );
  await assert.rejects(
    () => service.addExpense({ ...BASE, amount: 0, receiptUrl: url }),
    /invalid_amount/,
  );
  await assert.rejects(
    () => service.addExpense({ ...BASE, amount: -5, receiptUrl: url }),
    /invalid_amount/,
  );
  await assert.rejects(
    () => service.addExpense({ ...BASE, receiptUrl: url, date: "bukan-tanggal" }),
    /invalid_date/,
  );
});
