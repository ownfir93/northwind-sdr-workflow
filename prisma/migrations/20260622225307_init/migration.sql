-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('active', 'staged', 'merged');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('crm', 'clay');

-- CreateEnum
CREATE TYPE "WorkflowPath" AS ENUM ('existing', 'new_lead');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('exact', 'fuzzy', 'none');

-- CreateEnum
CREATE TYPE "HygieneDecision" AS ENUM ('auto_merge', 'needs_review', 'create_new');

-- CreateEnum
CREATE TYPE "RunOutcome" AS ENUM ('draft_ready', 'routed_to_review', 'discarded', 'failed');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "employeeSize" TEXT,
    "location" TEXT,
    "searchVendor" TEXT,
    "signalNotes" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT,
    "seniority" TEXT,
    "email" TEXT,
    "linkedinUrl" TEXT,
    "persona" TEXT,
    "lifecycleStage" TEXT,
    "headline" TEXT,
    "recentRoleChange" TEXT,
    "tenureYears" DOUBLE PRECISION,
    "status" "ContactStatus" NOT NULL DEFAULT 'active',
    "source" "ContactSource" NOT NULL DEFAULT 'crm',
    "discoveredDate" TIMESTAMP(3),
    "enrichmentSource" TEXT,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "amount" INTEGER,
    "closeDate" TIMESTAMP(3),
    "daysInStage" INTEGER,
    "owner" TEXT,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMember" (
    "id" SERIAL NOT NULL,
    "contactId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "engagementType" TEXT NOT NULL,
    "engagementDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "CampaignMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" SERIAL NOT NULL,
    "contactId" TEXT,
    "triggerType" TEXT NOT NULL,
    "path" "WorkflowPath" NOT NULL,
    "contextGenerated" BOOLEAN NOT NULL DEFAULT false,
    "enrichmentApplied" BOOLEAN NOT NULL DEFAULT false,
    "draftGenerated" BOOLEAN NOT NULL DEFAULT false,
    "qaPassed" BOOLEAN,
    "outcome" "RunOutcome",
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HygieneEvent" (
    "id" SERIAL NOT NULL,
    "foundId" TEXT NOT NULL,
    "matchType" "MatchType" NOT NULL,
    "decision" "HygieneDecision" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "matchedContactId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HygieneEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HygieneEvent" ADD CONSTRAINT "HygieneEvent_matchedContactId_fkey" FOREIGN KEY ("matchedContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
