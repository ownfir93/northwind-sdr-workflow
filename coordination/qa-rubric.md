# QA rubric — how `05-qa-grade` grades a draft

Binary per criterion. **Any fail → the whole draft fails → revise once → if still failing, route to human
review** (never send a failing draft). The grader returns `{ passed, rubric: [{criterion, pass}], failedReasons }`.

## Criteria
1. **Grounded** — every personalized claim traces to a real signal in the AI Context (CRM / enrichment /
   research / opp / engagement). No invented specifics (named tools, headcounts, dollar amounts, events) that
   aren't in the context.
2. **Cited** — every personalized claim is grounded in something real in the AI Context (or a fair Northwind
   value prop), and the draft lists the context facts it leaned on in `citations`. Citations are **free-form**
   — do NOT require any tag format (`[oppty: …]` etc. are not required). A personalized claim with no basis in
   the context → fail. Citations are internal metadata, not prospect-facing — judge ONLY the body for tone.
3. **On-brand** — obeys `brand-voice.md`: length (60–110 words, subject ≤ 6 words), one CTA, plain text, no
   banned phrases, **no brackets/tags in the BODY**, **no internal CRM/pipeline stage names or sequence-step
   labels in the BODY** (e.g. "Develop", "Validate", "Engage", "Pipeline", "MQL", "Suspect", "multithread",
   "Awareness step") — the prospect can't see the CRM. Judge the BODY only; ignore the citations block for this
   (it's allowed to contain stage names / raw facts). Tone matches the persona/seniority.
4. **No invented facts** — the strongest cut of #1: if a claim can't be verified against the context, it must be
   removed or softened to a non-specific statement. When in doubt, fail.
5. **Correct sequence stage** — the ask matches the mapped step from `sequence-definitions.md` (e.g. a Pipeline
   opp draft multithreads / references the opp; a rep-sent-email draft is a follow-up, not a fresh intro).

## Mechanical checks
- Any square bracket `[ ]` or inline tag in the **body** → fail criterion 3 (the body a rep sends must be
  clean prose; attribution lives in `citations`).
- Each claim in the **body** must be supportable by a fact in the AI Context (or a fair, general Northwind
  value prop) — else fail `grounded` / `no-invented-facts`.
- Do NOT require a citation tag format, a `[pillar: …]`, or any particular citation schema. Citations are the
  model's free-form list of the facts it used. Never fail because of the contents/format of `citations`
  (e.g. an internal stage name inside a citation is fine — only the body is prospect-facing).

## Confidence handling
- If the run was low-confidence (enrichment failed / thin research), the grader still enforces grounding but
  expects a **shorter, more general** email — it should NOT fail a correctly-cautious draft for being light.
- It SHOULD fail a draft that compensated for thin data by inventing specifics.

## Output → routing
- `passed: true` → write `aiNextEmail`, `Run.outcome = routed_to_review` (a rep still approves).
- `passed: false` after one revision → `Run.outcome = routed_to_review` with a `needsHumanEdit` flag; do not write
  a "ready" draft as if it passed.
