-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('INITIALIZED', 'FUNDS_HELD', 'DISPUTED', 'RELEASED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Escrow" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoiceId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTxId" TEXT,
    "amount" BIGINT NOT NULL,
    "currency" "InvoiceCurrency" NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'INITIALIZED',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Escrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escrowId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "fromStatus" "EscrowStatus",
    "toStatus" "EscrowStatus" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Escrow_invoiceId_key" ON "Escrow"("invoiceId");

-- CreateIndex
CREATE INDEX "Escrow_invoiceId_idx" ON "Escrow"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowEvent_idempotencyKey_key" ON "EscrowEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EscrowEvent_escrowId_idx" ON "EscrowEvent"("escrowId");

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowEvent" ADD CONSTRAINT "EscrowEvent_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "Escrow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
