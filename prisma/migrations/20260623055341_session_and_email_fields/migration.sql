-- AlterTable
ALTER TABLE "HygieneEvent" ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "emailBody" TEXT,
ADD COLUMN     "emailCitations" TEXT,
ADD COLUMN     "emailSubject" TEXT,
ADD COLUMN     "researchRan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionId" TEXT;
