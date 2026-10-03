-- F4 Uang Lokal Beres: termin (milestone_id/number/type) + Payout manual v1.
-- Manual migration (DB tidak reachable dari sini); cocok dengan prisma/schema.prisma.
-- Apply saat DB reachable: prisma migrate deploy (atau db push untuk dev).
-- number nullable + unik komposit (freelancerId, number) agar backfill baris lama lolos.

ALTER TABLE "Invoice" ADD COLUMN "milestone_id" UUID;
ALTER TABLE "Invoice" ADD COLUMN "number" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "type" VARCHAR(16) NOT NULL DEFAULT 'FINAL';

CREATE UNIQUE INDEX "Invoice_freelancerId_number_key" ON "Invoice"("freelancerId", "number");

CREATE TABLE "Payout" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "freelancerId" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "bank" VARCHAR(32) NOT NULL,
    "accountNo" VARCHAR(64) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
    "extRef" VARCHAR(128),
    "idempotencyKey" VARCHAR(200),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payout_idempotencyKey_key" ON "Payout"("idempotencyKey");
CREATE INDEX "Payout_freelancerId_idx" ON "Payout"("freelancerId");
CREATE INDEX "Payout_status_idx" ON "Payout"("status");
