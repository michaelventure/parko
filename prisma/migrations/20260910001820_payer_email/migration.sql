-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "payerEmail" TEXT,
ADD COLUMN     "receiptEmailSentAt" TIMESTAMPTZ(3);
