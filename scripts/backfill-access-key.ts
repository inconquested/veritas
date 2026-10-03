/**
 * Backfill Project.access_key for rows created while createProject wrote ''.
 * Run: `npx tsx scripts/backfill-access-key.ts` (needs DATABASE_URL).
 */
import { randomUUID } from "node:crypto";
import prisma from "../lib/prisma";

async function main() {
  const stale = await prisma.project.findMany({
    where: { OR: [{ access_key: "" }] },
    select: { id: true },
  });
  console.log(`Found ${stale.length} project(s) with empty access_key.`);
  // ponytail: sequential updates, fast enough for a one-off backfill.
  for (const row of stale) {
    await prisma.project.update({
      where: { id: row.id },
      data: { access_key: randomUUID() },
    });
  }
  console.log(`Backfilled ${stale.length} project(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
