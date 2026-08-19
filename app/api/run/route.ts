// app/api/run/route.ts
// runWorkflow(recordId, trigger) entry point.
//   Phase 1: STUB. No LLM — but the output is GROUNDED in the real record and
//            varies by trigger + enrichment, so the demo shows how a trigger changes the
//            email and how enrichment (before -> after) drives the personalization.
//   Phase 2: becomes real — calls the model runtime with the ordered prompts.
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";
import { enrich } from "@/lib/enrichment";
import { sequenceForStage } from "@/lib/stages";
import { orchestrateExisting, orchestrateConfigured } from "@/lib/llm";
import { contextPrompt, draftPromptOrch, qaPromptOrch } from "@/lib/prompts";
import { ensureAccountResearched } from "@/lib/research";
import { getSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

// Reads a single inbound found-lead row (the new-lead path picks one of these).
function readFoundRow(id: string): Record<string, string> | null {
  const text = readFileSync(join(process.cwd(), "fixtures", "inbound", "found_contacts.csv"), "utf8");
  const rows: Record<string, string>[] = parse(text, { columns: true, skip_empty_lines: true, trim: true });
  return rows.find((r) => r.found_id === id) ?? null;
}

type StepStatus = "complete" | "skipped";
interface FlowStep {
  key: string;
  label: string;
  model: string | null;
  status: StepStatus;
  summary: string;
}

const val = (v: unknown) =>
  v === null || v === undefined || v === "" ? null : String(v);

// First clause/sentence of a longer narrative.
const firstClause = (s: string) =>
  s.split(/[;.]/)[0].trim();

// Lowercase the first letter unless it looks like an acronym (next char also uppercase).
const lowerFirst = (s: string) =>
  s.length > 1 && s[0] === s[0].toUpperCase() && s[1] === s[1].toLowerCase()
    ? s[0].toLowerCase() + s.slice(1)
    : s;

// Remove inline [source] tags from the email body and tidy whitespace/punctuation.
// Attribution is preserved separately in the `citations` array — the body a rep sends stays clean.
const stripTags = (s: string) =>
  s
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// Runs the workflow, emitting per-step progress via send() so the Visualizer animates in sync with
// real model completions. Returns the final payload (or { __error, __status } on a guard failure).
async function runPipeline(body: any, send: (o: any) => void, sessionId: string): Promise<any> {
  const startedAt = Date.now();
  const contactId: string | undefined = body.contactId;
  const foundId: string | undefined = body.foundId;
  const triggerType: string = body.triggerType ?? "manual";
  const isFound = !!foundId;

  if (!contactId && !foundId) {
    return { __error: "contactId or foundId required", __status: 400 };
  }

  // Normalized lead shape — a DB contact or a Clay found-lead build the same object.
  type Lead = {
    id: string; firstName: string; lastName: string; title: string | null;
    seniority: string | null; email: string | null; persona: string | null;
    lifecycleStage: string | null; headline: string | null; recentRoleChange: string | null;
    tenureYears: number | null; accountId: string;
    account: NonNullable<Awaited<ReturnType<typeof prisma.account.findUnique>>>;
    campaignMembers: { campaignName: string; engagementType: string }[];
    opportunities: { role: string | null; opportunity: any }[];
  };

  let contact: Lead;
  if (isFound) {
    const row = readFoundRow(foundId!);
    if (!row) return { __error: `found lead ${foundId} not found`, __status: 404 };
    const account = await prisma.account.findUnique({ where: { id: row.account_id } });
    if (!account) return { __error: `account ${row.account_id} not found`, __status: 404 };
    contact = {
      id: row.found_id, firstName: row.first_name, lastName: row.last_name,
      title: row.title || null, seniority: row.seniority || null, email: row.email || null,
      persona: row.persona || null, lifecycleStage: null, headline: null,
      recentRoleChange: null, tenureYears: null, accountId: account.id, account,
      campaignMembers: [], opportunities: [],
    };
  } else {
    const c = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        account: true,
        campaignMembers: { orderBy: { engagementDate: "desc" } },
        opportunities: { include: { opportunity: { include: { nextStepHistory: { orderBy: { createdAt: "asc" } } } } } },
      },
    });
    if (!c) return { __error: `contact ${contactId} not found`, __status: 404 };
    contact = c as Lead;
  }

  // How many open opps the ACCOUNT has (for context) vs which one THIS contact is actually on (a role).
  const accountOppCount = await prisma.opportunity.count({ where: { accountId: contact.accountId } });
  const acct = contact.account;
  const name = `${contact.firstName} ${contact.lastName}`;
  // The opp THIS contact is on (via OpportunityContact) + their role. Null if the contact isn't on a deal —
  // even when the account has one. This is what makes "is she on the opp, or just her account?" unambiguous.
  const oppLink = (contact.opportunities ?? [])[0] ?? null;
  const oppty = oppLink?.opportunity ?? null;
  const contactRole: string | null = oppLink?.role ?? null;
  const oppHistory = oppty?.nextStepHistory ?? [];
  const priorNextStep = oppHistory.length >= 2 ? oppHistory[oppHistory.length - 2].note : null;

  // Account Research gate (lazy): a research-empty account is researched live by the model runtime
  // on its first run, then cached. Falls back to memory/account-research/fallbacks.json if the live call fails.
  let researchSource: string = acct.researchedAt ? "cached" : "none";
  if (!isFound) {
    // Always drive the research step so the Visualizer can mark it done. Only call the model runtime when the
    // account hasn't been researched yet; otherwise it's a cache hit — mark done immediately as "cached".
    send({ type: "step", node: "acct_research", status: "active" });
    if (!acct.researchedAt) {
      const r = await ensureAccountResearched(acct);
      acct.accountResearch = r.accountResearch;
      acct.accountAiContext = r.accountAiContext;
      acct.researchedAt = r.researchedAt;
      researchSource = r.source;
    }
    send({ type: "step", node: "acct_research", status: "done", source: researchSource });
  }

  // Campaign touch: a touch just happened. Record it (random type, tied to an existing campaign)
  // so the freshly-generated context is grounded in a real engagement.
  let addedTouch: { campaignName: string; engagementType: string } | null = null;
  if (triggerType === "campaign_touch" && contactId) {
    const distinct = await prisma.campaignMember.findMany({
      select: { campaignName: true },
      distinct: ["campaignName"],
    });
    const campaignPool = distinct.length
      ? distinct.map((c) => c.campaignName)
      : ["Composable CDP Buyer's Guide", "Warehouse-Native Marketing Webinar", "AI Decisioning Newsletter"];
    const typePool = ["email_open", "email_click", "content_download", "webinar", "event_attended"];
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const campaignName = pick(campaignPool);
    const engagementType = pick(typePool);
    await prisma.campaignMember.create({
      data: { contactId, campaignName, engagementType, engagementDate: new Date(), status: "engaged" },
    });
    addedTouch = { campaignName, engagementType };
  }

  const latestCampaign = addedTouch?.campaignName ?? contact.campaignMembers[0]?.campaignName ?? null;
  const touchCount = contact.campaignMembers.length + (addedTouch ? 1 : 0);

  // -------- Enrichment: before (CRM record) -> after (mock provider) --------
  const e = enrich(contact.id);
  const enrichmentFields = [
    { key: "title", label: "Title", before: val(contact.title), after: val(e?.title), drives: null as string | null },
    { key: "seniority", label: "Seniority", before: val(contact.seniority), after: val(e?.seniority), drives: "email tone" },
    { key: "persona", label: "Persona", before: val(contact.persona), after: val(e?.persona), drives: "email angle" },
    { key: "headline", label: "Headline", before: val(contact.headline), after: val(e?.headline), drives: null },
    { key: "recentRoleChange", label: "Recent role change", before: val(contact.recentRoleChange), after: val(e?.recentRoleChange), drives: "email opener" },
    { key: "tenureYears", label: "Tenure (yrs)", before: val(contact.tenureYears), after: val(e?.tenureYears), drives: null },
  ].map((f) => ({
    ...f,
    changed: (f.before ?? "") !== (f.after ?? "") && f.after != null,
  }));
  const filledCount = enrichmentFields.filter((f) => f.changed).length;
  const enrichmentApplied = !!e;

  // Effective (post-enrichment) values the draft uses.
  const eff = {
    seniority: val(e?.seniority) ?? val(contact.seniority),
    persona: val(e?.persona) ?? val(contact.persona),
    recentRoleChange: val(e?.recentRoleChange),
    title: val(e?.title) ?? val(contact.title),
  };

  // -------- Trigger framing: each trigger changes the opener + subject + reasoning --------
  const framing = triggerFraming(triggerType, {
    acct,
    oppty: oppty
      ? {
          name: oppty.name,
          stage: oppty.stage,
          painPoints: val(oppty.painPoints),
          nextSteps: val(oppty.nextSteps),
          priorNextStep,
        }
      : null,
    latestCampaign,
    touchType: addedTouch?.engagementType ?? null,
  });

  // -------- Best next step: stage (+ a nudge from the trigger) --------
  const seq = sequenceForStage(contact.lifecycleStage);

  // -------- Draft: opener (trigger) + personal line (enrichment) + value prop (pillar) --------
  const citations: string[] = [framing.tag];
  const lines: string[] = [`Hi ${contact.firstName},`, "", framing.opener];

  if (
    eff.recentRoleChange &&
    !/same role/i.test(eff.recentRoleChange)
  ) {
    lines.push(
      `Also — congrats on the recent move (${eff.recentRoleChange}). [enrichment: recent role change]`,
    );
    citations.push("[enrichment: recent role change]");
  } else if (eff.seniority) {
    lines.push(
      `Given your remit as ${eff.seniority}, I'll keep this short. [enrichment: seniority]`,
    );
    citations.push("[enrichment: seniority]");
  }

  // Grounded line from the richer CRM context (opp pain first, else account research).
  const groundedPain = val(oppty?.painPoints) ?? val(acct.accountResearch);
  if (groundedPain) {
    const tag = oppty?.painPoints ? "[oppty: pain points]" : "[account: research]";
    lines.push(
      "",
      `What we usually hear from teams like yours: ${lowerFirst(firstClause(groundedPain))}. That's exactly what we fix. ${tag}`,
    );
    citations.push(tag);
  }

  const pillar = acct.dataStack && acct.dataStack !== "None"
    ? `Teams already on ${acct.dataStack} usually want to activate that data into their tools without copying it into another CDP. [pillar: warehouse-native activation]`
    : `Most teams at your stage want to act on warehouse data without standing up yet another data silo. [pillar: warehouse-native activation]`;
  lines.push("", pillar);
  citations.push("[pillar: warehouse-native activation]");

  lines.push("", framing.cta(seq.stage), "", "Best,", "SDR");

  const emailBody = lines.join("\n");

  // Ensure every inline [tag] in the body surfaces as a citation chip (de-duped).
  for (const t of emailBody.match(/\[[^\]]+\]/g) ?? []) {
    if (!citations.includes(t)) citations.push(t);
  }

  // -------- Flow steps (canned, but reflect what actually happened) --------
  const steps: FlowStep[] = [
    {
      key: "research",
      label: "Research & verify signals",
      model: "claude-sonnet-4-6",
      status: "complete",
      summary: `[stub] Verified ${acct.name}: ${acct.signalNotes ?? "no public signal"}.`,
    },
    {
      key: "enrich",
      label: "Enrich (provider-agnostic)",
      model: null,
      status: enrichmentApplied ? "complete" : "skipped",
      summary: enrichmentApplied
        ? `Filled ${filledCount} field(s) from ${e!.source} (mock). See the before/after below.`
        : "[stub] Provider returned nothing — proceeding on existing data, flagged low-confidence.",
    },
    {
      key: "build-context",
      label: "Build AI Context",
      model: "claude-sonnet-4-6",
      status: "complete",
      summary: `[stub] Briefing for ${name} (${eff.persona ?? "persona n/a"}, stage ${contact.lifecycleStage ?? "n/a"}).`,
    },
    {
      key: "draft",
      label: "Draft best-next-step email",
      model: "claude-opus-4-8",
      status: "complete",
      summary: `[stub] Opener driven by trigger "${framing.label}"; personalization from enrichment.`,
    },
    {
      key: "qa",
      label: "QA grade (grounded / cited / on-brand)",
      model: "claude-sonnet-4-6",
      status: "complete",
      summary: `[stub] ${citations.length} source tags present; passes rubric.`,
    },
    {
      key: "route",
      label: "Route to #sdr-review (never auto-send)",
      model: null,
      status: "complete",
      summary: "[stub] Drafted and routed for human approval.",
    },
  ];

  const payload = {
    stub: true,
    runId: "stub-run",
    contactId,
    contactName: name,
    triggerType,
    triggerLabel: framing.label,
    path: isFound ? "new_lead" : "existing",
    steps,
    context: {
      briefing:
        `${name} — ${eff.title ?? "title unknown"} at ${acct.name} ` +
        `(${acct.industry ?? "industry n/a"}, ${acct.employeeSize ?? "size n/a"}). ` +
        `Data stack: ${acct.dataStack ?? "unknown"}. ` +
        `Stage: ${contact.lifecycleStage ?? "n/a"}. ` +
        `${touchCount} campaign touch(es). ` +
        `${oppty
          ? `On the "${oppty.name}" opp (${oppty.stage})${contactRole ? ` as ${contactRole}` : ""}.`
          : `Not personally on an open opp${accountOppCount ? ` (account has ${accountOppCount})` : ""}.`}`,
      historyNote:
        `${new Date().toISOString().slice(0, 10)} — trigger "${framing.label}" fired; ` +
        `${enrichmentApplied ? `${filledCount} fields enriched` : "no enrichment"}.`,
      // Bifurcated account context that grounds generation.
      accountResearch: val(acct.accountResearch),       // deep, lazy (research-if-empty)
      accountAiContext: val(acct.accountAiContext),      // continually-updated current state
      researchStatus: acct.researchedAt ? "researched" : "pending",
      researchSource,
      researchedAt: acct.researchedAt,
      opportunityContext: oppty
        ? {
            name: oppty.name,
            stage: oppty.stage,
            contactRole, // this contact's role on the deal (null if not a stakeholder)
            amount: oppty.amount,
            closeDate: oppty.closeDate,
            daysInStage: oppty.daysInStage,
            owner: val(oppty.owner),
            context: val(oppty.context),
            painPoints: val(oppty.painPoints),
            competitor: val(oppty.competitor),
            nextSteps: val(oppty.nextSteps),
            nextStepHistory: oppHistory.map((h: any) => ({
              note: h.note,
              stage: h.stage,
              setBy: h.setBy,
              date: h.createdAt,
            })),
          }
        : null,
      signals: [
        acct.signalNotes ? `[account signal] ${acct.signalNotes}` : null,
        acct.accountAiContext ? `[account AI context] ${acct.accountAiContext}` : null,
        acct.accountResearch ? `[account research] ${acct.accountResearch}` : null,
        addedTouch ? `[new touch] ${addedTouch.engagementType.replace(/_/g, " ")} · ${addedTouch.campaignName} (just now)` : null,
        latestCampaign ? `[engagement] ${latestCampaign}` : null,
        oppty ? `[oppty] ${name} is ${contactRole ?? "a stakeholder"} on ${oppty.name} — ${oppty.stage}` : null,
        oppty?.painPoints ? `[oppty pain] ${oppty.painPoints}` : null,
        oppty?.competitor ? `[oppty competition] ${oppty.competitor}` : null,
        oppty?.nextSteps ? `[oppty next step] ${oppty.nextSteps}` : null,
        oppHistory.length >= 2
          ? `[oppty next-step history] ${oppHistory.length} updates; previous: ${priorNextStep}`
          : null,
        eff.recentRoleChange ? `[enrichment] ${eff.recentRoleChange}` : null,
      ].filter(Boolean),
    },
    enrichment: {
      applied: enrichmentApplied,
      provider: e?.source ?? null,
      filledCount,
      fields: enrichmentFields,
    },
    nextStep: {
      stage: seq.stage,
      reasoning: seq.reasoning,
      lifecycleStage: contact.lifecycleStage,
      triggerNudge: framing.nudge,
    },
    email: {
      subject: framing.subject(acct.name),
      body: stripTags(emailBody), // clean prose; attribution lives in `citations`
      citations,
    },
    qa: {
      passed: true,
      rubric: [
        { criterion: "grounded", pass: true },
        { criterion: "cited", pass: true },
        { criterion: "on-brand", pass: true },
        { criterion: "no invented facts", pass: true },
        { criterion: "correct sequence stage", pass: true },
      ],
      failedReasons: [] as string[],
    },
    mode: "fallback" as "fallback" | "live",
    generatedBy: "templated fallback",
    // The rendered prompts + the record fed to 03 (surfaced in the Visualizer's "See Prompt / Context Used").
    prompts: null as null | Record<"context" | "draft" | "qa", {
      model: string; instructions: string; user: string; references: { title: string; body: string }[];
    }>,
    recordUsed: "",
  };

  // ---------- LIVE generation pass: 03 context -> 04 draft -> 05 QA through direct model calls ----------
  // The deterministic payload above is the FALLBACK. Each live step overwrites it on success and silently
  // falls back on any error/timeout, so the demo never bricks and "live when it works" holds.
  // Build the rendered prompts + the record fed to 03 — always, so the Visualizer can show them even on the
  // templated fallback path. These are exactly what the live model calls receive.
  const recordStr = JSON.stringify({
    contact: { name, title: eff.title, seniority: eff.seniority, persona: eff.persona, stage: contact.lifecycleStage, email: contact.email },
    account: { name: acct.name, industry: acct.industry, employeeSize: acct.employeeSize, dataStack: acct.dataStack, signalNotes: acct.signalNotes, accountResearch: val(acct.accountResearch), accountAiContext: val(acct.accountAiContext) },
    opportunity: payload.context.opportunityContext,
    campaignMembers: contact.campaignMembers.map((m) => ({ campaign: m.campaignName, type: m.engagementType })),
    enrichment: payload.enrichment.fields, addedTouch,
  }, null, 2);
  const cPrompt = contextPrompt({ triggerLabel: framing.label, record: recordStr, research: JSON.stringify(payload.context.signals) });
  const dPrompt = draftPromptOrch();
  const qPrompt = qaPromptOrch();
  payload.recordUsed = recordStr;
  const promptDisplay = (p: typeof cPrompt) => ({ model: p.model, instructions: p.display.instructions, user: p.user, references: p.display.references });
  payload.prompts = { context: promptDisplay(cPrompt), draft: promptDisplay(dPrompt), qa: promptDisplay(qPrompt) };

  if (orchestrateConfigured()) {
    // Route the whole chain through direct model calls. The runtime appends the prior step output before
    // calling the next prompt, so draft and QA stay grounded in the generated context.
    try {
      const out = await orchestrateExisting({ context: cPrompt, draft: dPrompt, qa: qPrompt });

      const ctx = out.context;
      if (ctx?.briefing) payload.context.briefing = String(ctx.briefing);
      if (ctx?.accountAiContext) payload.context.accountAiContext = String(ctx.accountAiContext);
      if (Array.isArray(ctx?.signals) && ctx.signals.length) payload.context.signals = ctx.signals.map(String);
      if (ctx?.nextStep?.stage) payload.nextStep = { ...payload.nextStep, stage: String(ctx.nextStep.stage), reasoning: ctx.nextStep.reasoning ? String(ctx.nextStep.reasoning) : payload.nextStep.reasoning };

      const draft = out.draft;
      if (draft?.subject && draft?.body) {
        const rawBody = String(draft.body);
        const cites: string[] = Array.isArray(draft.citations) ? draft.citations.map(String) : [];
        for (const t of rawBody.match(/\[[^\]]+\]/g) ?? []) if (!cites.includes(t)) cites.push(t);
        payload.email = { subject: String(draft.subject), body: stripTags(rawBody), citations: cites };
        payload.mode = "live";
        payload.generatedBy = "Direct model runtime (03 Sonnet → 04 Opus → 05 Sonnet)";
      }

      const verdict = out.qa;
      if (typeof verdict?.passed === "boolean") {
        payload.qa = {
          passed: verdict.passed,
          rubric: Array.isArray(verdict.rubric) ? verdict.rubric : payload.qa.rubric,
          failedReasons: Array.isArray(verdict.failedReasons) ? verdict.failedReasons.map(String) : [],
        };
      }
    } catch { /* orchestrator unreachable — keep the deterministic templated payload */ }
  }
  // The 3 AI steps complete together (one orchestrator call); the Visualizer paces 03→04→05 on estimated
  // timing during the real run. These are the backstop completion events.
  send({ type: "step", node: "context", status: "done" });
  send({ type: "step", node: "draft", status: "done" });
  send({ type: "step", node: "qa", status: "done" });

  // The workflow's terminal action: write the rep-facing AI Next Email field on the contact.
  // (Existing contacts only; a found lead becomes a contact after the hygiene create in Phase 2.)
  if (!isFound && contactId) {
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        aiNextEmail: `Subject: ${payload.email.subject}\n\n${payload.email.body}`,
        aiNextEmailAt: new Date(),
      },
    });
  }
  send({ type: "step", node: "ai_next_email", status: "done" });

  // Write the Run row so the Analytics tab reflects real runs (Phase 1 reporting).
  await prisma.run.create({
    data: {
      contactId: isFound ? null : contactId,
      label: isFound ? `${name} · ${acct.name}` : null,
      sessionId,
      triggerType,
      path: isFound ? "new_lead" : "existing",
      contextGenerated: true,
      enrichmentApplied,
      draftGenerated: true,
      researchRan: researchSource === "live",
      qaPassed: payload.qa.passed,
      qaReasons: JSON.stringify(payload.qa.failedReasons ?? []),
      outcome: payload.qa.passed ? "draft_ready" : "failed", // AI email ready for the rep, or flagged for revision
      durationMs: Date.now() - startedAt,
      emailSubject: payload.email.subject,
      emailBody: payload.email.body,
      emailCitations: JSON.stringify(payload.email.citations ?? []),
    },
  });
  send({ type: "step", node: "analytics", status: "done" });

  return { ...payload, aiNextEmailWritten: !isFound };
}

// SSE wrapper: streams per-step progress events, then a final { type: "result", payload }.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sessionId = await getSessionId();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: any) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(o)}\n\n`)); } catch { /* closed */ }
      };
      try {
        const result = await runPipeline(body, send, sessionId);
        if (result && result.__error) send({ type: "error", message: result.__error, status: result.__status });
        else send({ type: "result", payload: result });
      } catch (e) {
        send({ type: "error", message: String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

// ---- Trigger framing table ----
interface FramingCtx {
  acct: { name: string; signalNotes: string | null };
  oppty: { name: string; stage: string; painPoints: string | null; nextSteps: string | null; priorNextStep: string | null } | null;
  latestCampaign: string | null;
  touchType: string | null;
}
interface Framing {
  label: string;
  tag: string;
  nudge: string;
  opener: string;
  subject: (acct: string) => string;
  cta: (stage: string) => string;
}

function triggerFraming(triggerType: string, ctx: FramingCtx): Framing {
  const { acct, oppty, latestCampaign, touchType } = ctx;
  const oppRef = oppty ? `${oppty.name} (now ${oppty.stage})` : null;
  const touchVerb: Record<string, string> = {
    email_open: "opened our email about",
    email_click: "clicked through our email on",
    content_download: "downloaded our",
    webinar: "attended our webinar",
    event_attended: "stopped by our event",
  };

  switch (triggerType) {
    case "opp_stage_changed":
      return {
        label: "Opp stage changed",
        tag: oppty ? `[trigger: stage -> ${oppty.stage}]` : "[trigger: opp stage changed]",
        nudge: "CRM stage moved — match the conversation to the new stage.",
        opener: oppty
          ? `Saw the ${oppRef} move forward — great momentum. [trigger: opp stage changed]`
          : `As your evaluation progresses, I wanted to line up the right next step. [trigger: opp stage changed]`,
        subject: (a) => `${a} — next step as things move forward`,
        cta: (stage) =>
          oppty?.nextSteps
            ? `Proposed next step: ${lowerFirst(firstClause(oppty.nextSteps))}. Worth 20 min this week? [oppty: next steps]`
            : `Worth a short ${stage.includes("deep-dive") ? "technical deep-dive" : "working session"} this week?`,
      };
    case "opp_next_step":
      return {
        label: "Opp next-step updated",
        tag: "[trigger: next-step updated]",
        nudge: "The agreed next step changed — drive toward the new one, referencing what it moved from.",
        opener: oppty
          ? `Quick note as we line up the next step on ${oppty.name}${oppty.priorNextStep ? ` — now that we're past "${lowerFirst(firstClause(oppty.priorNextStep))}"` : ""}. [trigger: next-step updated]`
          : `Wanted to line up the next step on your evaluation. [trigger: next-step updated]`,
        subject: (a) => `${a} — lining up the next step`,
        cta: () =>
          oppty?.nextSteps
            ? `Next up: ${lowerFirst(firstClause(oppty.nextSteps))}. Want me to set it up? [oppty: next steps]`
            : `Want me to set up the next step we discussed?`,
      };
    case "opp_created":
      return {
        label: "Opportunity created",
        tag: "[trigger: opp created]",
        nudge: "New opp — establish the eval plan and stakeholders.",
        opener: oppty
          ? `Now that ${oppRef} is underway, I want to make the eval easy. [trigger: opp created]`
          : `Now that you're evaluating, I want to make it easy. [trigger: opp created]`,
        subject: (a) => `${a} — making the evaluation easy`,
        cta: () =>
          oppty?.nextSteps
            ? `I can tee up the first step: ${lowerFirst(firstClause(oppty.nextSteps))}. Open to it? [oppty: next steps]`
            : `Can I send a short eval plan tailored to your stack?`,
      };
    case "new_gong_call":
      return {
        label: "New Gong call",
        tag: "[trigger: new Gong call]",
        nudge: "Recent call — reference what was discussed.",
        opener: `Following up on your team's recent call about ${acct.signalNotes ?? "your data activation roadmap"}. [trigger: new Gong call]`,
        subject: (a) => `${a} — following up on your team's call`,
        cta: () => `Happy to turn the call notes into a concrete next step — open to 20 min?`,
      };
    case "campaign_touch":
      return {
        label: "Campaign touch",
        tag: latestCampaign ? `[engagement: ${latestCampaign}]` : "[trigger: campaign touch]",
        nudge: "Marketing engagement — reinforce the topic they engaged with.",
        opener: latestCampaign
          ? `Saw you ${touchType && touchVerb[touchType] ? touchVerb[touchType] : "engaged with"} "${latestCampaign}" — that topic is exactly where we help. [engagement: ${latestCampaign}]`
          : `Saw your recent engagement with our content. [trigger: campaign touch]`,
        subject: (a) => `${a} — building on what you read`,
        cta: () => `Want the 2-minute version applied to your team?`,
      };
    case "inbound_form":
      return {
        label: "Inbound form",
        tag: "[trigger: inbound form]",
        nudge: "Inbound interest — respond fast, qualify lightly.",
        opener: `Thanks for reaching out via our site — happy to help. [trigger: inbound form]`,
        subject: (a) => `${a} — thanks for reaching out`,
        cta: () => `What prompted the look? A quick call and I'll point you to the right use case.`,
      };
    case "rep_called":
      return {
        label: "Rep called",
        tag: "[trigger: rep called]",
        nudge: "Rep just called — send a 'sorry I missed you' follow-up that adds value.",
        opener: `Tried giving you a quick call just now — wanted to follow up in writing. [trigger: rep called]`,
        subject: (a) => `Tried to reach you — a quick note for ${a}`,
        cta: () => `When's a good time for a quick call this week?`,
      };
    case "rep_sent_email":
      return {
        label: "Rep sent email",
        tag: "[trigger: rep sent email]",
        nudge: "Rep already emailed — generate the next-in-sequence follow-up, not a fresh intro.",
        opener: `Following up on my last note${oppty ? ` about ${oppty.name}` : ""} — didn't want it to get buried. [trigger: rep sent email]`,
        subject: (a) => `Following up — ${a}`,
        cta: () =>
          oppty?.nextSteps
            ? `Still happy to ${lowerFirst(firstClause(oppty.nextSteps))} — worth a quick look? [oppty: next steps]`
            : `Worth a quick reply to see if it's relevant?`,
      };
    case "rep_connected":
      return {
        label: "Rep connected",
        tag: "[trigger: rep connected]",
        nudge: "Rep connected live — send the post-conversation recap + next step.",
        opener: `Great connecting earlier — as promised, here's the quick follow-up. [trigger: rep connected]`,
        subject: (a) => `Great speaking — next steps for ${a}`,
        cta: () =>
          oppty?.nextSteps
            ? `As discussed, next is to ${lowerFirst(firstClause(oppty.nextSteps))}. Want me to set it up? [oppty: next steps]`
            : `Want me to set up the next step we discussed?`,
      };
    case "new_lead":
      return {
        label: "New Lead",
        tag: "[trigger: new lead (Clay)]",
        nudge: "Net-new lead — cold first touch, establish relevance fast.",
        opener: `Reaching out because ${acct.name}${acct.signalNotes ? ` — ${acct.signalNotes}` : " looks like exactly the kind of team we help activate warehouse data"}. [trigger: new lead (Clay)]`,
        subject: (a) => `A quick idea for the ${a} team`,
        cta: () => `Worth a short intro to see if warehouse-native activation is relevant for you?`,
      };
    default:
      return {
        label: "Manual",
        tag: "[trigger: manual]",
        nudge: "Rep-initiated — lead with the most relevant account signal.",
        opener: `Reaching out about activating your warehouse data at ${acct.name}. [trigger: manual]`,
        subject: (a) => `Quick idea for ${a}`,
        cta: () => `Worth a short conversation?`,
      };
  }
}
