// "Try It" / Clay batch — runs brand-new contacts (≤10) through the workflow: live account research (deduped
// per company) → persona match + persona-specific pains → AI Context → drafted next email, all via n8n.
// Streams progress per contact over SSE and records each as a Run so it shows in Analytics.
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { orchestrateConfigured, orchestrateExisting, generateJson, n8nConfigured } from "@/lib/n8n";
import { contextPrompt, draftPromptOrch, qaPromptOrch, accountResearchPrompt } from "@/lib/prompts";
import { inferPersona, personaInsight, type PersonaInsight } from "@/lib/persona";
import { prisma } from "@/lib/prisma";
import { getSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Row = { firstName: string; lastName: string; email: string; title: string; company: string; persona?: string; seniority?: string };

const clean = (s: any) => String(s ?? "").trim();
function normalizeRow(r: any): Row {
  return { firstName: clean(r.firstName), lastName: clean(r.lastName), email: clean(r.email), title: clean(r.title), company: clean(r.company) };
}
const stripTags = (s: string) => (s ?? "").replace(/\s*\[[^\]]*\]/g, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

type Research = { accountResearch: string | null; accountAiContext: string | null; source: "live" | "unavailable" };

async function researchCompany(company: string): Promise<Research> {
  if (company && n8nConfigured()) {
    try {
      const r = await generateJson<any>(accountResearchPrompt({ account: JSON.stringify({ name: company }) }));
      if (r?.accountResearch) {
        return { accountResearch: String(r.accountResearch), accountAiContext: r.accountAiContext ? String(r.accountAiContext) : null, source: "live" };
      }
    } catch { /* fall through to unavailable */ }
  }
  return { accountResearch: null, accountAiContext: null, source: "unavailable" };
}

// Templated fallback — grounded in the persona pain, never names a specific warehouse.
function fallbackDraft(r: Row, persona: string, accountAiContext: string | null, insight: PersonaInsight) {
  const fn = r.firstName || "there";
  const co = r.company || "your team";
  const hook = accountAiContext ? `saw what ${co} is building` : `for ${persona.toLowerCase()}s at teams like ${co}`;
  return {
    subject: `${co}: activating your warehouse data`,
    body: `${fn}, ${hook}, ${insight.pains[0]}. Northwind activates data straight from your warehouse into the tools your team already uses — governed, no second copy.\n\nWorth a short call to see how it maps to ${co}?\n\nSDR`,
    citations: ["[pillar: warehouse-native activation]"] as string[],
  };
}

async function processRow(row: Row, triggerType: string, sessionId: string, getResearch: (c: string) => Promise<Research>, send: (o: any) => void, index: number) {
  const t0 = Date.now();
  const name = `${row.firstName} ${row.lastName}`.trim() || row.email || "lead";
  send({ type: "progress", index, status: "researching" });
  const research = await getResearch(row.company);

  const inferred = inferPersona(row.title);
  const persona = row.persona || inferred.persona;
  const seniority = row.seniority || inferred.seniority;
  const insight = personaInsight(persona);

  send({ type: "progress", index, status: "drafting" });
  const signals = [
    research.accountAiContext ? `[account research] ${research.accountAiContext}` : null,
    `[persona] ${persona} · ${seniority}`,
    ...insight.pains.map((p) => `[persona pain] ${p}`),
    `[angle] ${insight.angle}`,
    `[lead] brand-new cold lead — no CRM history or opportunity`,
  ].filter(Boolean) as string[];

  const record = JSON.stringify({
    contact: { name, title: row.title || "unknown", persona, seniority, email: row.email, personaPainPoints: insight.pains, outreachAngle: insight.angle },
    account: { name: row.company || "unknown", accountResearch: research.accountResearch, accountAiContext: research.accountAiContext },
    note: "Brand-new cold lead — no CRM history, no opportunity. Write a cold first-touch email grounded in the persona pain points above. If the account's data warehouse isn't in the research, say 'your warehouse' — do not name one.",
  }, null, 2);

  let aiCtx: any = null, draft: any = null, qa: any = null;
  let mode: "live" | "fallback" = "fallback";
  if (orchestrateConfigured()) {
    try {
      const out = await orchestrateExisting({
        context: contextPrompt({ triggerLabel: "New lead (cold)", record, research: signals.join("\n") }),
        draft: draftPromptOrch(),
        qa: qaPromptOrch(),
      });
      aiCtx = out.context; draft = out.draft; qa = out.qa;
      if (draft?.subject && draft?.body) mode = "live";
    } catch { /* fall back to templated */ }
  }

  const email = draft?.subject && draft?.body ? draft : fallbackDraft(row, persona, research.accountAiContext, insight);
  const qaPassed = typeof qa?.passed === "boolean" ? qa.passed : null;
  const result = {
    firstName: row.firstName, lastName: row.lastName, email: row.email, title: row.title, company: row.company,
    persona, seniority, painPoints: insight.pains,
    accountResearch: research.accountResearch, accountAiContext: research.accountAiContext, researchSource: research.source,
    briefing: aiCtx?.briefing ?? `${name} — ${row.title || "title unknown"} at ${row.company || "unknown"}. ${persona} (${seniority}); cold first touch.`,
    signals: Array.isArray(aiCtx?.signals) ? aiCtx.signals : signals,
    nextStep: aiCtx?.nextStep?.stage ?? "Awareness — value-led intro",
    subject: stripTags(email.subject), body: stripTags(email.body), citations: email.citations ?? [],
    qaPassed, mode,
  };

  // Record the run so it shows in Analytics.
  await prisma.run.create({
    data: {
      contactId: null, label: `${name} · ${row.company || "—"}`, sessionId, triggerType, path: "new_lead",
      contextGenerated: !!aiCtx, enrichmentApplied: false, draftGenerated: true,
      researchRan: research.source === "live",
      qaPassed, qaReasons: JSON.stringify(qa?.failedReasons ?? []), outcome: qaPassed === false ? "failed" : "draft_ready", durationMs: Date.now() - t0,
      emailSubject: result.subject, emailBody: result.body, emailCitations: JSON.stringify(result.citations ?? []),
    },
  }).catch(() => {});

  send({ type: "result", index, result });
}

async function pool<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// The Clay "found contacts" batch — staged inbound leads, company resolved from their account.
async function loadClayRows(): Promise<Row[]> {
  const found: any[] = parse(readFileSync(join(process.cwd(), "fixtures", "inbound", "found_contacts.csv"), "utf8"), { columns: true, skip_empty_lines: true, trim: true });
  const accts = await prisma.account.findMany({ select: { id: true, name: true } });
  const nameById = new Map(accts.map((a) => [a.id, a.name]));
  return found.slice(0, 10).map((f) => ({
    firstName: clean(f.first_name), lastName: clean(f.last_name), email: clean(f.email), title: clean(f.title),
    company: clean(nameById.get(f.account_id) ?? f.account_id), persona: clean(f.persona) || undefined, seniority: clean(f.seniority) || undefined,
  }));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sessionId = await getSessionId();
  const isClay = body.source === "clay";
  const triggerType = isClay ? "clay_found" : "csv_upload";
  const rows: Row[] = isClay
    ? await loadClayRows()
    : (Array.isArray(body.rows) ? body.rows : []).map(normalizeRow).filter((r: Row) => r.firstName || r.lastName || r.email || r.company).slice(0, 10);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: any) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(o)}\n\n`)); } catch {} };
      try {
        if (!rows.length) { send({ type: "error", message: isClay ? "No staged Clay contacts found." : "No valid rows found in the CSV." }); return; }
        send({ type: "start", count: rows.length, rows: rows.map((r) => ({ firstName: r.firstName, lastName: r.lastName, title: r.title, company: r.company })) });
        const cache = new Map<string, Promise<Research>>();
        const getResearch = (c: string) => {
          const key = (c || "").toLowerCase().trim() || "__unknown__";
          if (!cache.has(key)) cache.set(key, researchCompany(c));
          return cache.get(key)!;
        };
        await pool(rows, 3, (row, i) => processRow(row, triggerType, sessionId, getResearch, send, i));
        send({ type: "done" });
      } catch (e) {
        send({ type: "error", message: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
