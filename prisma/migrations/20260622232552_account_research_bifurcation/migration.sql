/*
  Warnings:

  - You are about to drop the column `accountContext` on the `Account` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Account" DROP COLUMN "accountContext",
ADD COLUMN     "accountAiContext" TEXT,
ADD COLUMN     "accountResearch" TEXT,
ADD COLUMN     "researchedAt" TIMESTAMP(3);
