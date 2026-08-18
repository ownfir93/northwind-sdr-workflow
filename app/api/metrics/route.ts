// Aggregates the reporting layer. Activity (runs, hygiene) is scoped to the visitor's session so each user
// sees only their own work; the CRM dataset stats are shared reference numbers.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionId = await getSessionId();
  const runWhere = { sessionId };

  // --- Session activity (workflow) ---
  const totalRuns = await prisma.run.count({ where: runWhere });
  const draftsGen = await prisma.run.count({ where: { ...runWhere, draftGenerated: true } });
  const qaPassed = await prisma.run.count({ where: { ...runWhere, qaPassed: true } });
  const qaEvaluated = await prisma.run.count({ where: { ...runWhere, NOT: { qaPassed: null } } });
  const qaPassRate = qaEvaluated ? +((qaPassed / qaEvaluated) * 100).toFixed(1) : 0;
  const durAgg = await prisma.run.aggregate({ where: runWhere, _avg: { durationMs: true } });
  const avgGenMs = Math.round(durAgg._avg.durationMs ?? 0);
  const liveResearches = await prisma.run.count({ where: { ...runWhere, researchRan: true } });

  // --- Ingestion: contacts that entered via Try It (CSV) or Clay (session-scoped) ---
  const ingestRuns = await prisma.run.findMany({
    where: { ...runWhere, triggerType: { in: ["csv_upload", "clay_found"] }, NOT: { label: null } },
    distinct: ["label"], select: { label: true },
  });
  const byDecision = await prisma.hygieneEvent.groupBy({ by: ["decision"], where: { sessionId }, _count: { _all: true } });
  const decision = (d: string) => byDecision.find((x) => x.decision === d)?._count._all ?? 0;
  const hygieneIngested = await prisma.hygieneEvent.count({ where: { sessionId } });
  const dupsCaught = decision("auto_merge") + decision("needs_review");
  const createdNew = decision("create_new");
  const contactsIngested = ingestRuns.length + hygieneIngested;

  // --- Coverage: distinct CRM contacts this session has drafted an email for ---
  const emailedContacts = await prisma.run.findMany({
    where: { ...runWhere, contactId: { not: null }, emailBody: { not: null } },
    distinct: ["contactId"], select: { contactId: true },
  });

  // --- Shared CRM dataset stats ---
  const totalContacts = await prisma.contact.count({ where: { status: "active" } });
  const existingContacts = await prisma.contact.count({ where: { status: "active", source: "crm" } });
  const newContacts = totalContacts - existingContacts;
  const totalAccounts = await prisma.account.count();
  const totalOpportunities = await prisma.opportunity.count();
  const totalCampaign = await prisma.campaignMember.count();
  const aiEmailCoverage = totalContacts ? +((emailedContacts.length / totalContacts) * 100).toFixed(1) : 0;

  return NextResponse.json({
    workflow: { totalRuns, draftsGen, qaPassRate, avgGenMs, liveResearches },
    ingestion: { contactsIngested, dupsCaught, createdNew },
    crm: {
      totalContacts, newContacts, existingContacts, totalAccounts, totalOpportunities,
      totalCampaign, aiEmailCoverage, emailedContacts: emailedContacts.length,
    },
  });
}
