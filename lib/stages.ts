// Controlled vocabulary for the contact lifecycle Stage, and how each stage maps to
// the "best next step" sequence framing the draft targets. Single source of truth so the
// record browser, the run logic, and (Phase 2) sequence-definitions.md all agree.

export const LIFECYCLE_STAGES = [
  "Suspect",
  "Marketing Engaged",
  "MQL",
  "Working",
  "Pipeline",
  "Closed Won",
  "Nurture",
  "Disqualified",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

// Best-next-step sequence framing per stage. Phase 2 moves this into sequence-definitions.md.
export const STAGE_SEQUENCE: Record<string, { stage: string; reasoning: string }> = {
  Suspect: {
    stage: "Awareness — value-led intro",
    reasoning: "Cold/early; lead with a relevant insight, no ask beyond a soft CTA.",
  },
  "Marketing Engaged": {
    stage: "Education — share a proof point",
    reasoning: "Engaged with marketing; reinforce with a tailored proof point and a light CTA.",
  },
  MQL: {
    stage: "Qualify — connect the signal to a use case",
    reasoning: "Marketing-qualified; tie their recent signal to a concrete use case and offer a call.",
  },
  Working: {
    stage: "Active — book a technical deep-dive",
    reasoning: "Sales-engaged; advance with a specific next meeting and a clear agenda.",
  },
  Pipeline: {
    stage: "Opportunity — multithread to the economic buyer",
    reasoning: "Open opportunity; multithread and align on business value and timing.",
  },
  "Closed Won": {
    stage: "Expand — adjacent team or use case",
    reasoning: "Customer; pivot to expansion and referrals, not net-new pitch.",
  },
  Nurture: {
    stage: "Re-engage — low-touch check-in",
    reasoning: "Dormant; low-pressure re-engagement tied to a fresh, relevant trigger.",
  },
  Disqualified: {
    stage: "Hold — no outreach",
    reasoning: "Disqualified; suppress from active outreach.",
  },
};

export function sequenceForStage(stage: string | null | undefined) {
  return (stage && STAGE_SEQUENCE[stage]) || {
    stage: "Awareness — value-led intro",
    reasoning: "No stage on record; default to a soft, value-led touch.",
  };
}
