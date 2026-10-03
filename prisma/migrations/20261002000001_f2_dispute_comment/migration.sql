-- F2 Dispute yang Bisa Dipakai: Comment (evidence thread) + Dispute (1 per escrow).
-- Manual migration (DB tidak reachable dari sini); cocok dengan prisma/schema.prisma.
-- Apply saat DB reachable: prisma migrate deploy (atau db push untuk dev).

CREATE TABLE "Comment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "milestone_id" UUID,
    "handsout_id" UUID,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" TEXT[] NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Comment_project_id_idx" ON "Comment"("project_id");
CREATE INDEX "Comment_milestone_id_idx" ON "Comment"("milestone_id");
CREATE INDEX "Comment_handsout_id_idx" ON "Comment"("handsout_id");

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Dispute" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escrowId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedAmount" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "deadlineAt" TIMESTAMP(6) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Dispute_escrowId_key" ON "Dispute"("escrowId");
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");
