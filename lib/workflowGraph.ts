// The workflow as a directed graph: automated event sources -> workflow trigger -> the ordered
// skills -> the AI Next Email field write -> the outreach/human send layer, with the new-lead
// (Clay) branch through the hygiene gate and a conditional, lazy Account Research step.
// Shared by the Workflow Visualizer. This same topology is what the app runtime executes.

export type NodeKind = "event" | "process" | "decision" | "terminal" | "handoff" | "scheduled";

export interface WfNodeDef {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle?: string;
  model?: string;
  x: number;
  y: number;
  trigger?: string; // event nodes only — the triggerType they emit
  path?: "new_lead"; // marks the new-lead entry
}

export interface WfEdgeDef {
  source: string;
  target: string;
  label?: string;
  dashed?: boolean;
}

const COL = {
  events: 0, trigger: 230, research: 450, enrich: 670, gate: 890,
  context: 1110, draft: 1330, qa: 1550, ainext: 1790, seq: 2020, rep: 2250,
};
const ROW = { backbone: 210, research: 60, lead: 410, leadReview: 540, analytics: 360, handoff: 150 };

export const WF_NODES: WfNodeDef[] = [
  // ---- Automated event sources (not human-initiated) ----
  { id: "ev_gong", kind: "event", title: "New Gong call", subtitle: "call transcript event", x: COL.events, y: 0, trigger: "new_gong_call" },
  { id: "ev_campaign", kind: "event", title: "Campaign touch", subtitle: "marketing engagement", x: COL.events, y: 64, trigger: "campaign_touch" },
  { id: "ev_opp_stage", kind: "event", title: "Opp stage changed", subtitle: "CRM stage change", x: COL.events, y: 128, trigger: "opp_stage_changed" },
  { id: "ev_opp_nextstep", kind: "event", title: "Opp next-step updated", subtitle: "next step changed", x: COL.events, y: 192, trigger: "opp_next_step" },
  { id: "ev_inbound", kind: "event", title: "Inbound form", subtitle: "website submit", x: COL.events, y: 256, trigger: "inbound_form" },
  { id: "ev_rep_called", kind: "event", title: "Rep called", subtitle: "rep activity → refresh", x: COL.events, y: 320, trigger: "rep_called" },
  { id: "ev_rep_sent", kind: "event", title: "Rep sent email", subtitle: "rep activity → refresh", x: COL.events, y: 384, trigger: "rep_sent_email" },
  { id: "ev_rep_connected", kind: "event", title: "Rep connected", subtitle: "rep activity → refresh", x: COL.events, y: 448, trigger: "rep_connected" },
  { id: "ev_clay", kind: "event", title: "Clay discovery", subtitle: "new leads found", x: COL.events, y: 560, trigger: "clay_found", path: "new_lead" },
  // Scheduled source — visually distinct and spaced clear of the event triggers.
  { id: "ev_schedule", kind: "scheduled", title: "Nightly schedule", subtitle: "scheduled job · runs nightly", model: "Scheduler", x: COL.events, y: 690, trigger: "nightly_batch" },

  // ---- Orchestration ----
  { id: "trigger", kind: "process", title: "Workflow trigger", subtitle: "webhook / schedule", model: "Next API", x: COL.trigger, y: 190 },

  // ---- Ordered skills (existing-contact backbone) ----
  { id: "research", kind: "process", title: "01 Research", subtitle: "verify contact signals", model: "Sonnet 4.6", x: COL.research, y: ROW.backbone },
  { id: "enrich", kind: "process", title: "02b Enrich", subtitle: "provider lookup", model: "deterministic", x: COL.enrich, y: ROW.backbone },

  // ---- Conditional Account Research (lazy) ----
  { id: "acct_gate", kind: "decision", title: "Account researched?", subtitle: "checks researchedAt", x: COL.gate, y: ROW.backbone },
  { id: "acct_research", kind: "process", title: "Account Research", subtitle: "lazy · only if not populated", model: "Sonnet 4.6 · web", x: COL.gate, y: ROW.research },

  { id: "context", kind: "process", title: "03 Build Context", subtitle: "AI Context · every run", model: "Sonnet 4.6", x: COL.context, y: ROW.backbone },
  { id: "draft", kind: "process", title: "04 Draft", subtitle: "best next email", model: "Opus 4.8", x: COL.draft, y: ROW.backbone },
  { id: "qa", kind: "process", title: "05 QA grade", subtitle: "rubric check", model: "Sonnet 4.6", x: COL.qa, y: ROW.backbone },

  // ---- Workflow terminal: write the rep-facing field ----
  { id: "ai_next_email", kind: "terminal", title: "Write AI Next Email", subtitle: "→ contact.aiNextEmail field", x: COL.ainext, y: ROW.backbone },
  { id: "analytics", kind: "terminal", title: "Analytics", subtitle: "Run + HygieneEvent rows", x: COL.ainext, y: ROW.analytics },

  // ---- Outreach + human send layer (downstream of the workflow) ----
  { id: "sequence", kind: "handoff", title: "Outreach sequence", subtitle: "builds the email from the field", x: COL.seq, y: ROW.handoff },
  { id: "rep_send", kind: "handoff", title: "Rep reviews & sends", subtitle: "manual · never auto-sends", x: COL.rep, y: ROW.handoff },

  // ---- New-lead branch (Clay) ----
  { id: "ingest", kind: "process", title: "Ingest", subtitle: "→ staged", x: COL.research, y: ROW.lead },
  { id: "hygiene", kind: "decision", title: "02a Hygiene gate", subtitle: "exact → fuzzy → AI adjudicate", model: "Sonnet 4.6", x: COL.enrich, y: ROW.lead },
  { id: "needs_review", kind: "terminal", title: "Needs review", subtitle: "human adjudication", x: COL.gate, y: ROW.leadReview },
];

export const WF_EDGES: WfEdgeDef[] = [
  // events -> trigger
  { source: "ev_gong", target: "trigger" },
  { source: "ev_campaign", target: "trigger" },
  { source: "ev_opp_stage", target: "trigger" },
  { source: "ev_opp_nextstep", target: "trigger" },
  { source: "ev_inbound", target: "trigger" },
  { source: "ev_rep_called", target: "trigger" },
  { source: "ev_rep_sent", target: "trigger" },
  { source: "ev_rep_connected", target: "trigger" },
  { source: "ev_clay", target: "trigger" },
  { source: "ev_schedule", target: "trigger", dashed: true },
  // trigger splits into the two paths
  { source: "trigger", target: "research", label: "existing" },
  { source: "trigger", target: "ingest", label: "new lead", dashed: true },
  // existing backbone
  { source: "research", target: "enrich" },
  { source: "enrich", target: "acct_gate" },
  // conditional account research
  { source: "acct_gate", target: "context", label: "researched ✓" },
  { source: "acct_gate", target: "acct_research", label: "not yet", dashed: true },
  { source: "acct_research", target: "context" },
  // continue backbone -> field write
  { source: "context", target: "draft" },
  { source: "draft", target: "qa" },
  { source: "qa", target: "ai_next_email" },
  { source: "ai_next_email", target: "analytics", label: "Run row", dashed: true },
  // outreach + human send layer
  { source: "ai_next_email", target: "sequence" },
  { source: "sequence", target: "rep_send" },
  // new-lead branch
  { source: "ingest", target: "hygiene" },
  { source: "hygiene", target: "enrich", label: "merge / create → survivors" },
  { source: "hygiene", target: "needs_review", label: "needs_review", dashed: true },
  { source: "hygiene", target: "analytics", label: "HygieneEvent", dashed: true },
];

export interface ActivePath {
  path: "existing" | "new_lead";
  nodeIds: string[];
  edgeIds: string[]; // `${source}__${target}`
}

const eid = (s: string, t: string) => `${s}__${t}`;
const TAIL = ["context", "draft", "qa", "ai_next_email", "sequence", "rep_send"];

// The ordered node sequence a lead traverses for a given trigger value.
// needsResearch=true routes through the lazy Account Research step.
export function activePathFor(triggerType: string, needsResearch = false): ActivePath {
  const researchHop = needsResearch ? ["acct_research"] : [];

  // Clay batch: ingest the whole found set, gate it, emit to analytics (Phase 1 stops at staged).
  if (triggerType === "clay_found") {
    const nodeIds = ["ev_clay", "trigger", "ingest", "hygiene", "analytics"];
    return { path: "new_lead", nodeIds, edgeIds: zipEdges(nodeIds) };
  }
  // Single new lead from Clay: full path through to the field write + outreach.
  if (triggerType === "new_lead") {
    const nodeIds = [
      "ev_clay", "trigger", "ingest", "hygiene",
      "enrich", "acct_gate", ...researchHop, ...TAIL,
    ];
    return { path: "new_lead", nodeIds, edgeIds: zipEdges(nodeIds) };
  }
  // Existing-contact event triggers.
  const eventNode = WF_NODES.find((n) => n.trigger === triggerType);
  const start = eventNode ? [eventNode.id] : [];
  const nodeIds = [
    ...start, "trigger", "research", "enrich", "acct_gate", ...researchHop, ...TAIL,
  ];
  return { path: "existing", nodeIds, edgeIds: zipEdges(nodeIds) };
}

function zipEdges(nodeIds: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < nodeIds.length - 1; i++) out.push(eid(nodeIds[i], nodeIds[i + 1]));
  return out;
}

// Triggers offered in the visualizer.
// eligibleStages: stages a lead must be in (null = any). excludeStages: stages that can't fire it.
// source "found" = pick a lead from the Clay found-contacts table. runnable=false = scheduled scaffold.
export interface VisualizerTrigger {
  value: string;
  label: string;
  path: "existing" | "new_lead";
  eligibleStages: string[] | null;
  excludeStages?: string[];
  requiresOpp?: boolean; // lead must be on an opportunity (a contact role), independent of lifecycle stage
  source?: "found";
  runnable?: boolean;
  scheduled?: boolean;
}

export const VISUALIZER_TRIGGERS: VisualizerTrigger[] = [
  { value: "new_gong_call", label: "New Gong call", path: "existing", eligibleStages: null },
  // A campaign touch pushes a lead to engaged-or-above, so it never fires on a Suspect.
  { value: "campaign_touch", label: "Campaign touch", path: "existing", eligibleStages: null, excludeStages: ["Suspect"] },
  { value: "opp_stage_changed", label: "Opp stage changed", path: "existing", eligibleStages: null, requiresOpp: true },
  { value: "opp_next_step", label: "Opp next-step updated", path: "existing", eligibleStages: null, requiresOpp: true },
  { value: "inbound_form", label: "Inbound form", path: "existing", eligibleStages: ["Marketing Engaged", "MQL"] },
  // Rep-activity triggers: re-run to refresh AI Context + write a fresh AI Next Email
  // (e.g. rep sent an email -> generate the next-in-sequence follow-up).
  { value: "rep_called", label: "Rep called", path: "existing", eligibleStages: null, excludeStages: ["Suspect", "Disqualified"] },
  { value: "rep_sent_email", label: "Rep sent email", path: "existing", eligibleStages: null, excludeStages: ["Suspect", "Disqualified"] },
  { value: "rep_connected", label: "Rep connected", path: "existing", eligibleStages: null, excludeStages: ["Suspect", "Disqualified"] },
  { value: "new_lead", label: "New Lead (from Clay)", path: "new_lead", eligibleStages: null, source: "found" },
  { value: "clay_found", label: "Clay found contacts (batch)", path: "new_lead", eligibleStages: null },
  { value: "nightly_batch", label: "Nightly batch (scheduled)", path: "new_lead", eligibleStages: null, runnable: false, scheduled: true },
];
