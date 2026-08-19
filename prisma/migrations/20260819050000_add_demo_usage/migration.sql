CREATE TABLE "DemoUsage" (
  "ipHash" TEXT NOT NULL,
  "freeRunsUsed" INTEGER NOT NULL DEFAULT 0,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DemoUsage_pkey" PRIMARY KEY ("ipHash")
);

CREATE TABLE "DemoNewsletterSignup" (
  "email" TEXT NOT NULL,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DemoNewsletterSignup_pkey" PRIMARY KEY ("email")
);
