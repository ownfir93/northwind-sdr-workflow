# Northwind GTM SDR Research & Outreach Workflow

An agentic workflow that ingests leads, reconciles them against the CRM, researches & enriches, builds AI
context, and drafts the **best next outreach step** — selling **Northwind** (composable CDP / Reverse ETL /
warehouse-native activation / AI Decisioning). It runs **live through n8n Cloud → Claude**, with a web app to
demo it and a reporting layer to prove it works.

> **Status: live.** Generation, the hygiene gate, and Account Research all execute live via n8n → Claude. The
> deterministic templated path is a demo safety net only. Deployment to Railway is Phase 3.

## The timed/untimed boundary
Phase 1 (untimed) shipped a runnable harness where `runWorkflow(recordId, trigger)` returned a *grounded
stub* (full orchestration, templated generation). Phase 2 (the timed 3-hour box) made it real — authored the
four-layer knowledge files + the prompts, then wired the live n8n round-trip, the hygiene gate, and the live
Account Research agent. That single function — `app/api/run/route.ts` — is the line.

---

## Architecture

```
Automated event (n8n webhook / nightly cron)   ── not a human click ──
  ├─ existing contact ─────────────────────────────────────────────────────────────┐
  │   triggers: Gong call · campaign touch · opp stage changed · opp next-step      │
  │             updated · inbound form · rep called/sent/connected (refresh)        │
  │   01 Research (verify CRM signals, cite)                                         │
  ├─ new lead (Clay) ─→ Ingest → staged → 02a HYGIENE GATE                          │
  │     exact (code) → fuzzy (code) → AI adjudicate (n8n→Claude, ambiguous only)    │
  │     → auto_merge | needs_review | create_new   · writes HygieneEvent            │
  ├─→ 02b Enrich (provider-agnostic; mock CSV today, Clay/LinkedAPI tomorrow)       │
  ├─→ [Account researched?] no → Account Research (lazy · n8n→Claude + WEB SEARCH) ─┤
  ├─→ 03 Build Context  (AI Context, every run)            ── n8n → Claude (Sonnet) │
  ├─→ 04 Draft best-next email (source-attributed lines)   ── n8n → Claude (Opus)   │
  ├─→ 05 QA grade (grounded/cited/on-brand/no-invented)    ── n8n → Claude (Sonnet) │
  ├─→ Write AI Next Email → contact.aiNextEmail            ──→ Analytics (Run row)  │
  └─→ Outreach sequence builds the in-sequence email → Rep reviews & sends (never auto-sends)
```

The **Workflow Visualizer** (`/workflow`) *is* this diagram, live — pick an event, run a lead through, click
any completed step to see its real output (with a `● live via n8n` badge when generation ran live).

## The two things that matter most
1. **n8n Cloud is the runner.** Every Claude call goes through the n8n `Generation Runner` webhook
   (`orchestration/`); the Anthropic credential and the LLM calls live **inside n8n**. The app holds no LLM
   SDK — it renders prompts from git, POSTs to n8n, and persists the result. Adding an automation means
   building an n8n workflow, not coding a bespoke web app.
2. **Source attribution.** Every personalized line in the draft carries an inline tag — `[oppty: pain
   points]`, `[enrichment: recent role change]`, `[pillar: warehouse-native activation]`, `[account:
   research]` — and QA fails any untagged or unverifiable claim. This single mechanic answers the
   hallucination and rep-trust concerns at once.

## Tool choices & why
- **n8n Cloud** — orchestration/runner. Webhook + (scaffolded) nightly cron; the Claude calls run here.
  Chosen so the automation platform is the thing reps/ops extend, not the app.
- **Claude** (`claude-opus-4-8` draft, `claude-sonnet-4-6` context/QA/hygiene/research, web search for
  research) — best prose for the rep-facing artifact; strong reasoning/throughput elsewhere.
- **Next.js 16 + MUI + React Flow** — the demo UI (Visualizer + live Analytics). The app is a thin BFF +
  orchestrator; it holds the four layers and renders prompts, not LLM credentials.
- **Postgres + Prisma on Railway** — the "CRM," same engine in dev and prod. Controls the schema
  (status/source/merge, Run, HygieneEvent, opp next-step history, AI Next Email, account research/AI-context).
- **Provider-agnostic enrichment** — mock CSV today, Clay/LinkedAPI tomorrow, same interface.
- **Deterministic vs AI** — exact + fuzzy dedup is code (auditable, cheap); only genuine ambiguity hits the
  LLM. Knowing where *not* to use AI is part of the design.

## Logic in git — the four layers
- `context/` — reusable knowledge: `icp`, `brand-voice`, `messaging-pillars`, `persona-rubrics`,
  `sequence-definitions`, `enrichment-policy`, `source-allowlist`, `measurement-spec`, `field-glossary`.
- `coordination/` — decisions: `triggers`, `hygiene-rules`, `handoffs`, `qa-rubric`.
- `execution/` — the ordered skills; **the 3 full prompts** are `03-build-context/PROMPT.md`,
  `04-draft-email/PROMPT.md`, `02a-hygiene/PROMPT.md` (each edge-case-aware, with the source-attribution
  mechanic). `lib/prompts.ts` renders them + appends the relevant layer files at call time.
- `memory/` — `last-run-state.json`, `reply-performance.md`, and the committed `account-research/` fallbacks.

## Run it
```bash
npm install
cp .env.example .env     # set DATABASE_URL, N8N_GENERATE_URL; ANTHROPIC_API_KEY lives in n8n, not the app
npm run db:migrate && npm run db:seed
npm run dev              # http://localhost:3000
```
In n8n Cloud: import `orchestration/workflow.n8n.json`, attach an Anthropic credential to the **Claude**
node, publish. Point `N8N_GENERATE_URL` at `https://<your-n8n>/webhook/gtm-generate`. Without n8n the app
runs on the deterministic fallback.

**Demo path:** `/workflow` → *Opp stage changed* → a Pipeline lead (e.g. Marcus Webb / Meridian) → **Run** →
click **04 Draft** to see the live, source-attributed email. Then *New Lead (from Clay)* / *Clay batch* to
watch the hygiene gate; then a contact at **Vuori/Ramp/Calendly/Brooklinen** to watch **live web research**
populate the account. `/analytics` reflects every run live.

## Measurement
The live **Analytics** tab + `context/measurement-spec.md`. Measured from the DB: runs, QA pass rate, avg
generation time, enrichment fill rate, ingestion counts, **duplicate rate** (66.7% caught on the seeded set:
2 exact + 2 fuzzy of 6). Baseline → 2-week pilot → 2-month targets and the cost/ROI note are in the spec
(per-run token cost is cents; it replaces ~10–15 min of SDR research per contact, with a rep reviewing
instead of authoring).

## Rollout
Week 1: two friendly reps, existing-contact path only; AI Next Email lands in their sequence, drafts reviewed
before send; measure reply lift + time saved. Month 1: add new-lead + hygiene and live Account Research;
widen to a pod; publish the rep-facing "what the AI read and why" doc. Skeptical-rep move: never auto-send;
show the AI Context + source tags that ground each line; let reps edit and learn from edits.

## What can go wrong (and the mitigations)
- **Sparse/empty fields** → enrichment fills; if it can't, the draft degrades gracefully and is flagged
  low-confidence rather than inventing facts.
- **Hallucination** → QA checks grounded + cited + no-invented-facts + a valid tag per line; fail → revise
  once → human review.
- **Bad/duplicate inbound** → the hygiene gate dedups (exact → fuzzy → AI) before anything reaches a rep;
  **bias to needs_review, never a wrong merge.**
- **n8n / Claude / web search down** → deterministic templated fallback for generation; committed fallbacks
  for Account Research. The demo never bricks; the architecture stays n8n-as-runner.

## Deliberately cut / next (the box ran 3 hours)
- **Latency:** the full live chain (research + context + draft + QA) is ~30–46s on a first, unresearched run
  — genuinely doing web research + 3 model calls. Cached after the first run. *Next:* stream/parallelize.
- **In-n8n orchestration:** one reusable runner (vs a 6-node chain with Postgres nodes + the IF gate) — the
  pragmatic, robust choice for the box. *Next:* move the step orchestration + DB I/O into n8n.
- **Nightly cron:** scaffolded as a Visualizer node, not wired live.
- **`needs_review` queue UI:** decisions are written; the human-adjudication surface is stubbed.
- Phase 3: deploy to Railway; Loom walkthrough against the deployed instance.
