/*
  Warnings:

  - The `currency` column on the `Invoice` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "InvoiceCurrency" AS ENUM ('USD', 'INR', 'IDR', 'GBP', 'EUR', 'CNY', 'JPY', 'KRW', 'CAD', 'AUD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvoicePaymentMethod" ADD VALUE 'XENDIT';
ALTER TYPE "InvoicePaymentMethod" ADD VALUE 'MIDTRANS';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "providerTxId" TEXT,
DROP COLUMN "currency",
ADD COLUMN     "currency" "InvoiceCurrency" NOT NULL DEFAULT 'IDR';
