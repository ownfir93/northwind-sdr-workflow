# Handoffs — step input/output contracts

The contract each skill consumes and produces, so n8n (or the app orchestrator) can chain them and the QA
grader can verify. Shapes mirror the `api/run` payload. JSON-ish; nulls allowed (graceful degradation).

## 01-research → research object
- **in**: `{ account, contact, opportunity?, campaignMembers[] }`
- **out**: `{ signals: [{ claim, sourceClass, sourceRef }], thin: boolean }` — abstains/flags when data is thin.

## 02a-hygiene (new-lead only) → decision
- **in**: `{ stagedContact, candidates[] }`
- **out**: `{ decision: auto_merge|needs_review|create_new, matchType: exact|fuzzy|none, confidence, reason, mergedIntoId? }`
- side effect: write `HygieneEvent`; promote `status`.

## 02b-enrich → field deltas
- **in**: `{ contactId }`
- **out**: `{ applied: boolean, provider, fields: [{ key, before, after, changed, source, drives? }] }`

## Account Research (gated) → research narrative
- **in**: `{ account }` where `researchedAt` is null/stale
- **out**: `{ accountResearch, accountAiContext, researchedAt, sources[] }`; on failure → load `memory/account-research/fallbacks.json`.

## 03-build-context → AI Context object
- **in**: enriched contact + research + campaign engagement + opp (+ next-step history) + account research/AI-context
- **out**: `{ briefing, historyNote, accountAiContext, opportunityContext{…,nextStepHistory[]}, signals[], nextStep{stage,reasoning} }`

## 04-draft-email → draft
- **in**: AI Context + sequence step + persona + brand-voice + messaging-pillars + persona-rubrics
- **out**: `{ subject, body, citations: ["[enrichment: …]", "[pillar: …]", …] }` — every personalized line tagged.

## 05-qa-grade → verdict
- **in**: draft + AI Context
- **out**: `{ passed: boolean, rubric: [{ criterion, pass }], failedReasons[]? }` — fail → revise once → human review.

## Terminal
- Write `aiNextEmail = "Subject: … \n\n …"` + `aiNextEmailAt` on the contact (existing path).
- Write a `Run` row (trigger, path, flags, qaPassed, outcome, durationMs). New-lead also wrote `HygieneEvent`(s).
- Outreach sequence builds the in-sequence email from `aiNextEmail`; a rep reviews & sends. Never auto-send.
