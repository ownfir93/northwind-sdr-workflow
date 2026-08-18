-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "accountContext" TEXT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "competitor" TEXT,
ADD COLUMN     "context" TEXT,
ADD COLUMN     "nextSteps" TEXT,
ADD COLUMN     "painPoints" TEXT;
