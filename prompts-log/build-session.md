# Build session log — Phase 2 (the timed box)

An authentic log of making `runWorkflow()` real: live Claude through n8n, the hygiene gate, and the live
Account Research agent. Companion to `Phase1BuildingSession.md`.

## 1. De-risk the long pole first
Before authoring anything, proved the riskiest integration. Found the n8n instance had **no Anthropic
credential** and that credentials can't be created with a secret via the API (UI-only). The user added an
`anthropicApi` credential (`kddgVGeze1YHISCF`). Built a minimal **Generation Runner** workflow via the n8n
MCP SDK — `Webhook (POST /gtm-generate) → Anthropic (text/message) → Respond` — referencing the credential,
validated, created, **published**. Tested it: a real `PONG` / `LIVE` came back through the production webhook
(raw Anthropic `content[].text`, `claude-sonnet-4-6`, ~1s). The round-trip was real before any other code.

## 2. Author the four layers + SKILL contracts + the 3 full prompts
`context/` (9 files), `coordination/` (4), `memory/` (2), and `execution/0*/SKILL.md` (6) + the three full
prompts (`03-build-context`, `04-draft-email`, `02a-hygiene`, plus `05-qa-grade`). Northwind-themed. The
prompts use a `## SYSTEM` / `## USER` split that `lib/prompts.ts` parses, appending the relevant layer files
(brand voice, pillars, persona rubrics, sequence defs, qa rubric, hygiene rules) at render time. Logic stays
in git; n8n stays dumb.

## 3. Wire live generation — app has no LLM SDK
`lib/n8n.ts` POSTs `{model, system, user, maxTokens, webSearch}` to the runner and extracts the completion
(defensive about n8n's response shape), with a 45s timeout. `lib/prompts.ts` renders each step. `api/run`
gained a **live pass**: 03 context → 04 draft → 05 QA, each guarded by try/catch — the deterministic
templated payload is the fallback; live steps overwrite on success. First live run (Marcus Webb / Meridian /
opp stage changed): a grounded Opus draft citing `[oppty: stage]`, `[oppty: pain points]`,
`[pillar: warehouse-native activation]`, `[enrichment: posting publicly]`, `[oppty: next steps]` — QA passed.

## 4. The hygiene gate — deterministic where it matters
`lib/hygiene.ts` does exact-email (deterministic) + fuzzy candidate scoring (Dice bigrams + nickname map +
title/email-localpart). `api/ingest` POST runs the gate: exact → fuzzy → **AI adjudication via n8n for the
ambiguous band only**, writes `HygieneEvent`, promotes survivors. On the seeded set it matched the answer key
exactly — FND001/006 exact-merge, FND002 (Marc/Marcus) + FND005 (Jess/Jessica) AI-merged at 91%/93% with
real rationales, FND003/004 create-new. Analytics ingestion lit up (66.7% duplicate rate).

## 5. Live Account Research — the web-search wow
`lib/prompts.ts → accountResearchPrompt` runs with `webSearch: true`. `lib/research.ts` `ensureAccountResearched`
researches a research-empty account live and caches it (or falls back to `memory/account-research/fallbacks.json`).
Wired lazily into `api/run` (and a standalone `/api/research`). Live test on Vuori returned **real current
facts** — the $825M Nov-2024 round at a $5.5B valuation, ~2,493 employees, a Snowflake CDP relaunch + hiring
for audience activation — and the integrated run on Ramp drafted an email grounded in its live-found "Customer
Data Platform" workstream.

## 6. Docs + export
Exported the n8n workflow (`orchestration/workflow.n8n.json` + `triggers-spec.md`), rewrote the README for the
live system (architecture, tool choices, measurement, rollout, failure modes, cost/ROI, cut-list), and reset
the four real accounts to research-empty so the demo can showcase live research.

## Notes on prioritization (graded under the box)
- Proved n8n first, authored knowledge second, wired live third — highest-risk integration de-risked before
  time pressure.
- Kept the deterministic path as a real safety net so a live failure never bricks the demo.
- One reusable n8n runner over a 6-node orchestration: the robust choice for 3 hours; the fuller in-n8n
  orchestration is documented as next.
