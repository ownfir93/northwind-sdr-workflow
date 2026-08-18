// app/api/records/route.ts
// Reads real CRM records from Postgres for the workbench record browser.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    where: { status: "active" },
    include: {
      account: true,
      _count: { select: { campaignMembers: true } },
      opportunities: { include: { opportunity: { select: { name: true, stage: true } } } },
    },
    orderBy: { id: "asc" },
  });

  const accounts = await prisma.account.findMany({
    include: { _count: { select: { contacts: true, opportunities: true } } },
    orderBy: { id: "asc" },
  });

  const opportunities = await prisma.opportunity.findMany({
    include: { account: true },
    orderBy: { id: "asc" },
  });

  const rows = contacts.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    accountId: c.accountId,
    accountName: c.account.name,
    title: c.title,
    seniority: c.seniority,
    email: c.email,
    persona: c.persona,
    lifecycleStage: c.lifecycleStage,
    engagements: c._count.campaignMembers,
    sparse: !c.title || !c.seniority || !c.persona,
    accountResearched: !!c.account.researchedAt,
    onOpportunity: c.opportunities.length > 0,
    opportunityRole: c.opportunities[0]?.role ?? null,
    opportunityName: c.opportunities[0]?.opportunity?.name ?? null,
  }));

  return NextResponse.json({
    contacts: rows,
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      industry: a.industry,
      employeeSize: a.employeeSize,
      location: a.location,
      dataStack: a.dataStack,
      signalNotes: a.signalNotes,
      accountResearch: a.accountResearch,
      accountAiContext: a.accountAiContext,
      researchedAt: a.researchedAt,
      contactCount: a._count.contacts,
      oppCount: a._count.opportunities,
    })),
    opportunities: opportunities.map((o) => ({
      id: o.id,
      name: o.name,
      accountName: o.account.name,
      stage: o.stage,
      amount: o.amount,
      closeDate: o.closeDate,
      daysInStage: o.daysInStage,
      owner: o.owner,
      context: o.context,
      painPoints: o.painPoints,
      competitor: o.competitor,
      nextSteps: o.nextSteps,
    })),
  });
}
