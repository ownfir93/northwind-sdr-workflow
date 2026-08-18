// Shared seed logic — used by `prisma db seed` (CLI) AND /api/reset (the Visualizer "Reset demo" button).
// Wipes the dynamic state (runs, hygiene events, lazy research, generated emails, merges) and reloads the
// CRM fixtures, restoring the exact baseline demo instance.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import type { PrismaClient } from "@prisma/client";

const FIX = join(process.cwd(), "fixtures");
type Row = Record<string, string>;

function readCsv(relPath: string): Row[] {
  return parse(readFileSync(join(FIX, relPath), "utf8"), { columns: true, skip_empty_lines: true, trim: true });
}
const orNull = (v: string | undefined): string | null => (v && v.trim().length > 0 ? v.trim() : null);
const orNum = (v: string | undefined): number | null => { const n = orNull(v); return n == null ? null : Number(n); };
const orDate = (v: string | undefined): Date | null => { const n = orNull(v); return n == null ? null : new Date(n); };

export async function seedDatabase(prisma: PrismaClient, log: (m: string) => void = () => {}) {
  // Clean slate (FK-safe order).
  await prisma.hygieneEvent.deleteMany();
  await prisma.run.deleteMany();
  await prisma.campaignMember.deleteMany();
  await prisma.opportunityContact.deleteMany();
  await prisma.opportunityNextStep.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.account.deleteMany();

  const accounts = readCsv("crm/accounts.csv");
  for (const a of accounts) {
    await prisma.account.create({
      data: {
        id: a.account_id, name: a.name, industry: orNull(a.industry), employeeSize: orNull(a.employee_size),
        location: orNull(a.location), dataStack: orNull(a.current_data_stack), signalNotes: orNull(a.signal_notes),
        accountResearch: orNull(a.account_research), accountAiContext: orNull(a.account_ai_context), researchedAt: orDate(a.researched_at),
      },
    });
  }

  const contacts = readCsv("crm/contacts.csv");
  for (const c of contacts) {
    await prisma.contact.create({
      data: {
        id: c.contact_id, accountId: c.account_id, firstName: c.first_name, lastName: c.last_name,
        title: orNull(c.title), seniority: orNull(c.seniority), email: orNull(c.email), linkedinUrl: orNull(c.linkedin_url),
        persona: orNull(c.persona), lifecycleStage: orNull(c.lifecycle_stage), status: "active", source: "crm",
      },
    });
  }

  const opps = readCsv("crm/opportunities.csv");
  for (const o of opps) {
    await prisma.opportunity.create({
      data: {
        id: o.opp_id, accountId: o.account_id, name: o.name, stage: o.stage, amount: orNum(o.amount),
        closeDate: orDate(o.close_date), daysInStage: orNum(o.days_in_stage), owner: orNull(o.owner),
        context: orNull(o.opportunity_context), painPoints: orNull(o.pain_points), competitor: orNull(o.competitor), nextSteps: orNull(o.next_steps),
      },
    });
  }

  const nextSteps = readCsv("crm/opportunity_next_steps.csv");
  for (const n of nextSteps) {
    await prisma.opportunityNextStep.create({
      data: { opportunityId: n.opp_id, note: n.note, stage: orNull(n.stage), setBy: orNull(n.set_by), createdAt: new Date(n.created_at) },
    });
  }

  const oppContacts = readCsv("crm/opportunity_contacts.csv");
  for (const oc of oppContacts) {
    await prisma.opportunityContact.create({ data: { opportunityId: oc.opp_id, contactId: oc.contact_id, role: orNull(oc.role) } });
  }
  // Invariant: a contact on an opportunity is always Pipeline.
  const onOppIds = [...new Set(oppContacts.map((oc) => oc.contact_id))];
  await prisma.contact.updateMany({ where: { id: { in: onOppIds }, NOT: { lifecycleStage: "Pipeline" } }, data: { lifecycleStage: "Pipeline" } });

  const members = readCsv("crm/campaign_members.csv");
  for (const m of members) {
    await prisma.campaignMember.create({
      data: { contactId: m.contact_id, campaignName: m.campaign_name, engagementType: m.engagement_type, engagementDate: new Date(m.engagement_date), status: m.status },
    });
  }

  log(`seeded ${accounts.length} accounts, ${contacts.length} contacts, ${opps.length} opps, ${oppContacts.length} opp-contacts`);
  return { accounts: accounts.length, contacts: contacts.length, opps: opps.length };
}
