-- CreateTable
CREATE TABLE "OpportunityNextStep" (
    "id" SERIAL NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "stage" TEXT,
    "setBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityNextStep_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OpportunityNextStep" ADD CONSTRAINT "OpportunityNextStep_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
