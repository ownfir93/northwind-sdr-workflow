# PROJECT_PLAN.md — Northwind GTM SDR Research & Outreach Workflow

Take-home build for Northwind (GTM AI / AI Operations). Scenario A: SDR research is eating the day. We design and ship an agentic workflow that ingests leads, reconciles them against the CRM, researches & enriches, builds AI context, and drafts the best next outreach step — selling **Northwind** (composable CDP / Reverse ETL / warehouse-native activation / AI Decisioning). A live web app demos it and a reporting layer proves it works.

This plan is the source of truth. Phase boundaries:
- **Phase 1 (Demo) — untimed scaffolding. DONE.**
- **Phase 2 (Workflow) — the timed 3-hour deliverable: make `runWorkflow()` real.**
- **Phase 3 (Deploy) — untimed, NOT counted in the Phase 2 box.**

---

## Operating principles

- Defensibility over cleverness. Every choice must be explainable line-by-line. If it can't be defended, cut it.
- Logic lives in git, not in the workflow tool. n8n Cloud triggers, grabs context, and delivers output; all knowledge, decision logic, and prompts live in the repo's four layers. Mirrors the hiring manager's own architecture.
- Provider-agnostic. Enrichment and discovery are interfaces with swappable backends (mock CSV today, Clay/LinkedAPI tomorrow). Same input, same output shape.
- AI where context and language create leverage; deterministic where trust and auditability matter. Exact + fuzzy dedup is deterministic; adjudication, research, drafting are AI. Knowing where *not* to use AI is part of the design.
- Human stays in the loop on anything that sends. The workflow writes the **AI Next Email** field; the outreach tool builds the in-sequence email from it and a rep reviews & sends. Never auto-sends.
- Stay in the box. Phase 2 stops at 3:00. Prioritization under constraint is graded — a clean cut with a note beats an unfinished sprawl.

## The timed / untimed boundary

Phase 1 ends with `runWorkflow(recordId, trigger)` returning a **grounded stub** (full orchestration, templated generation). Phase 2 is "make `runWorkflow()` real" — **author the four layers + SKILL contracts + the full prompts**, then wire live Claude through the **real n8n round-trip**, plus the hygiene gate and live Account Research. The **knowledge files, SKILL contracts, and the prompts all count toward the timed box** — they are the scrutinized deliverables. The **only** untimed Phase-1 prep is the **pre-computed Account Research fallback outputs**.

## Robustness model — n8n is the one true runner

The whole point is to model the **automation platform**, not to build a bespoke web app per automation. So:
- **Live path (mandatory, never cut): `event → n8n Cloud webhook → n8n calls Claude (per-step model map) + reads/writes Postgres → result`.** The Anthropic credential and every LLM call live **inside n8n**; **the app holds no LLM SDK.** The app is the demo UI — it fires the n8n webhook and renders what comes back. In production the same n8n workflow is fired by real event webhooks + the nightly cron, with no app in the loop. Using API routes to call Claude would imply hand-building a web app for every automation — exactly the anti-pattern we're avoiding.
- **Demo safety net only:** if n8n/Claude is unreachable mid-walkthrough, `api/run`/`api/ingest` fall back to the existing deterministic templated output so the demo never bricks. This is a safety net, **not** an alternative architecture — n8n is never replaced by API routes. Account Research also has **pre-computed outputs committed as fallback**.
- Net: live-when-it-works, never-broken-when-it-doesn't, architecture unambiguously n8n-as-runner.

---

## Architecture (as built + Phase 2 target)

Automated **events** (not human clicks) fire the workflow. Two entry paths into one generation core, ending at the AI Next Email field and the outreach/human-send layer.

```
Event source (n8n Cloud webhook / schedule)
  ── existing contact ──────────────────────────────────────────────┐
  │  triggers: Gong call · campaign touch · opp stage changed ·       │
  │            opp next-step updated · inbound form ·                 │
  │            rep called / sent email / connected (refresh)         │
  └─> 01 Research (verify CRM signals, cite)                         │
  ── new lead (Clay) ──> Ingest → staged ──> 02a Hygiene gate        │
  │     exact → fuzzy → AI adjudicate → merge | review | create      │
  │     (writes HygieneEvent; survivors promoted to active) ─────────┤
  └─> 02b Enrich (provider-agnostic; mock = contacts_enriched.csv)   │
   ─> [Account researched?]  no → Account Research (lazy, web agent) ─┤
   ─> 03 Build Context (AI Context, every run; opp next-step history)
   ─> 04 Draft best-next-step email (source-attributed lines)
   ─> 05 QA grade (grounded / cited / on-brand / no invented facts)
   ─> Write AI Next Email  → contact.aiNextEmail  ──> Analytics (Run row)
   ─> Outreach sequence (builds in-sequence email from the field)
   ─> Rep reviews & sends (never auto-sends)
  Nightly schedule (n8n-managed cron): sweeps stale-research accounts + new leads.
```

n8n Cloud is the path between steps; the four layers are what happens at each step; fixtures are the data fed in; the Workflow Visualizer is how reviewers see it.

## Tech stack and why

- **Next.js 16 (App Router) + MUI v7 + MUI X DataGrid + React Flow (`@xyflow/react`).** App + BFF API routes. The **Workflow Visualizer** (React Flow graph, run-a-lead-through animation, click-a-step popups) is the primary surface; **Analytics** is the live reporting view. (The old Workbench was consolidated away.)
- **Postgres + Prisma on Railway.** The "CRM," seeded from CSV fixtures, same engine in dev and prod. App runs locally against the Railway DB via the public proxy. Chosen over an OSS CRM to control the schema (status/source/merge, staging, Run, HygieneEvent, opp next-step history, AI Next Email, account research/AI-context).
- **n8n Cloud** (`ownfir.app.n8n.cloud`). Trigger + orchestration only: webhook + nightly cron, HTTP Request nodes that call Claude with prompt files from the repo. Managed (not self-hosted Docker).
- **Claude via `ANTHROPIC_API_KEY`** (in local `.env`). Per-step model map below. Reviewers add their own key; templated fallback runs without one.
- **Enrichment = mock callout** backed by `contacts_enriched.csv`, identical interface to a live Clay/LinkedAPI call — swapping to live is a one-node change. (LinkedAPI is unofficial; flag ToS/compliance before production.)

Tradeoff for README: chose Claude-native + logic-in-git over heavy n8n branching; n8n stays deliberately dumb (trigger + wire). Provider-agnostic enrichment so Clay/LinkedAPI/Apollo swap without touching logic.

## Model map

Set per step in each skill's call config so n8n selects the right model.

- **Draft email (`04-draft-email`): Opus 4.8** (`claude-opus-4-8`) — the rep-facing artifact; prose quality shows here.
- **Context, research, QA, hygiene adjudication, Account Research (`01`, `03`, `05`, `02a`, account-research): Sonnet 4.6** (`claude-sonnet-4-6`) — reasoning/throughput balance; Account Research uses web search.
- **Transcript generation (event triggers, e.g. new Gong call): Haiku 4.5** (`claude-haiku-4-5`) — speed.
- **Enrichment (`02b-enrich`): deterministic** provider lookup, no LLM in the mock path.

---

## Data model (as built)

`schema.prisma` (Railway Postgres, 5 migrations applied):
- **Account**: firmographics + `dataStack` + `signalNotes` + bifurcated context — `accountResearch` (deep, **lazy**: web-researched once if empty), `accountAiContext` (refreshed every run), `researchedAt` (gate).
- **Contact**: sparse base fields, `status` (active|staged|merged), `source` (crm|clay), `mergedInto/mergedFrom` self-relation, **`aiNextEmail` + `aiNextEmailAt`** (the rep-facing artifact the workflow writes).
- **Opportunity**: `context` / `painPoints` / `competitor` / `nextSteps` + **`OpportunityNextStep[]`** (append-only next-step history — drives the "Opp next-step updated" trigger).
- **CampaignMember**: engagement signal (a campaign-touch run appends a real one).
- **Run / HygieneEvent**: the reporting substrate (Analytics reads these live).

Fixtures (all Northwind-themed): `crm/{accounts,contacts,opportunities,campaign_members,opportunity_next_steps}.csv`, `enrichment/contacts_enriched.csv`, `inbound/found_contacts.csv` (6 leads seeding all three hygiene outcomes; `expected_outcome` is the answer key, stripped at ingest). Four **real, research-empty** accounts (Vuori, Ramp, Calendly, Brooklinen) demo the live Account Research agent.

---

## PHASE 1 — Demo (UNTIMED) — ✅ DONE

A runnable local harness where you pick an event + lead and run it through the visual workflow; generation is grounded-but-templated; the seams are real before the clock starts.

Built and verified:
- **App**: Workflow Visualizer (`/`, `/workflow`) + Analytics (`/analytics`), MUI + React Flow.
- **DB**: Railway Postgres, schema + 5 migrations, seed (8 accounts, 18 contacts, 6 opps, 16 next-step history rows, 7 campaign members).
- **`api/run`** (the `runWorkflow` stub): full orchestration — trigger framing for all 11 triggers, enrichment before/after, opp context + next-step history, source-attributed draft, QA rubric, writes `aiNextEmail`, writes `Run` row. Real per-run analytics.
- **`api/ingest`**: lists `found_contacts` as staged (answer key stripped; no hygiene logic yet).
- **`api/records` / `api/metrics`**: real reads; Analytics is live (runs/avg-gen-time/enriched-runs/fill-rate all from the DB).
- **Triggers**: Gong call, campaign touch (writes a real touch; excludes Suspect), opp stage changed, opp next-step updated (Pipeline-only), inbound form (Marketing Engaged + MQL), rep called/sent/connected (refresh → fresh AI Next Email), New Lead (from Clay table), Clay batch, n8n-managed nightly schedule (scaffold, not runnable).

### Remaining untimed Phase-1 prep (the ONLY pre-box item)

**Account Research fallbacks** — pre-run the web agent once per real account (Vuori, Ramp, Calendly, Brooklinen) and commit the outputs under `memory/account-research/`, so the live demo has a safety net if web research fails mid-walkthrough. Everything else (the four layers, the six `SKILL.md` contracts, and the 3 full prompts) is **authored inside the Phase-2 timed box**.

---

## PHASE 2 — Workflow (TIMED, 3 hours) — make `runWorkflow()` real

Goal: live Claude generation through the **real n8n round-trip** (templated fallback), the **real hygiene gate**, and the **live Account Research agent** — so the app generates live and Analytics lights up. Knowledge files are pre-authored (Phase-1 prep), so this box is wiring + verification.

### Build decisions locked
- **n8n: real round-trip, MANDATORY (never cut).** `event → n8n Cloud webhook → HTTP nodes call Claude + Postgres → return`. The Anthropic credential + every LLM call live **inside n8n**; the app has **no LLM SDK**. Templated path is a demo safety net only, never an alternative runner.
- **Generation: live Claude** (Opus 4.8 draft; Sonnet 4.6 context/QA/hygiene/research) via n8n, `ANTHROPIC_API_KEY` configured as an **n8n credential**.
- **Hygiene: exact + deterministic fuzzy + AI adjudication** on the seeded dup pairs; writes `HygieneEvent`; promotes survivors.
- **Account Research: all 4 real accounts live** via n8n→Claude web search; outputs saved as committed fallback; live n8n showcased in the demo.

### Wiring
- **n8n Cloud workflow (the runner):** Webhook trigger → read context (Postgres nodes, or received from the app) → per-step Claude HTTP nodes using the repo's prompt files (`03`/`04`/`05`, `02a` adjudication, Account Research with web search) → write back / respond. **Anthropic credential + all LLM calls live in n8n.** Export `orchestration/workflow.n8n.json` + `triggers-spec.md`.
- **Prompts in git, loaded by n8n:** the four-layer files + `execution/0*/SKILL.md` are the source of truth; n8n loads the rendered prompt (app passes it, or n8n fetches from the repo/app), so logic stays in git and n8n stays dumb.
- **App (`api/run` / `api/ingest`):** fire the n8n webhook; render real context, before/after enrichment, next-step reasoning + history, the mapped sequence step, the source-attributed email, the QA verdict; persist `Run`/`HygieneEvent`/`aiNextEmail` (n8n nodes or app — decided live by time). Templated safety net only if n8n is unreachable.
- **Nightly schedule:** a real n8n cron that sweeps unresearched accounts + new leads.

### Phase 2 time budget (3:00) — knowledge + prompts are IN the box

- **0:35** — four layers (lean, Northwind-themed) + the six `SKILL.md` input/output contracts.
- **0:40** — the 3 full prompts (`03-build-context`, `04-draft-email`, `02a-hygiene`), edge-case-aware, with the per-line source-attribution mechanic.
- **0:30** — n8n Cloud workflow: webhook → context → Claude nodes (`03`/`04`/`05`) → respond; app fires it; templated safety net proven. Existing-contact path live end-to-end.
- **0:30** — hygiene gate live (`02a`): exact + deterministic fuzzy + AI adjudication via n8n; write `HygieneEvent`; promote survivors; new-lead path; Analytics ingestion + duplicate-rate light up.
- **0:25** — Account Research live via n8n→Claude web search (4 accounts; saved fallback if it fails); conditional gate fires; rep/opp triggers verified live; n8n nightly cron demoed.
- **0:20** — README core (diagram, tool choices, measurement, rollout, failure modes, cost/ROI) + prompt-log appendix + cut-list.

### Cut order (if the box runs short) — the live n8n round-trip is NEVER cut
1. AI fuzzy adjudication → deterministic fuzzy only. 2. Trim the four layers to the three the prompts lean on most (`brand-voice`, `messaging-pillars`, `qa-rubric`); stub the rest. 3. Live research for 2 of 4 accounts → committed fallback. 4. New-lead depth → keep exact + deterministic dedup, defer the AI tier. **Always protect:** the **live n8n round-trip** on the existing-contact path with a real Claude draft + source attribution + QA, and the 3 full prompts committed.

### Acceptance criteria
- Existing-contact path: fire any trigger, get **real Claude** context + source-attributed email + QA verdict, `aiNextEmail` written, `Run` row, Analytics increments.
- New-lead path: Clay batch + single New Lead show exact/fuzzy/AI hygiene outcomes, survivors promoted, `HygieneEvent` rows, duplicate rate visible.
- Account Research: a research-empty account is researched **live via n8n→Claude** and populates `accountResearch`; fallback used if the live call fails.
- Enrichment shows a before/after that changes the draft; rep triggers regenerate the AI Next Email.
- Human-in-the-loop: drafts land in the field for the outreach sequence; nothing auto-sends.

---

## PHASE 3 — Deploy (UNTIMED, separate from the Phase 2 box)

Ship the demo as a hosted web app on Railway for reviewers.

- Deploy the Next app to the existing Railway project (`devoted-playfulness`); link the Postgres service; set env (`DATABASE_URL` internal, `ANTHROPIC_API_KEY`, `N8N_WEBHOOK_URL`). `build` already runs `prisma generate`; add `prisma migrate deploy` on release; run seed once.
- Point n8n Cloud's production webhook + nightly cron at the deployed app.
- Smoke-test both paths in prod; add a README deploy section; share the URL. Record the Loom walkthrough against the deployed instance.

---

## Deliverables mapped to the rubric

- **Architecture diagram**: the Workflow Visualizer *is* the live diagram; static version + flow above in README.
- **Tool choices + why**: README — n8n-vs-Claude-native, Railway, provider-agnostic enrichment, deterministic-vs-AI.
- **2–3 key prompts**: `03-build-context`, `04-draft-email`, `02a-hygiene` (full, in `execution/`).
- **Measurement**: the live Analytics tab + `measurement-spec.md` (baseline, 2-week pilot, 2-month targets).
- **Rollout plan**: README (below).
- **What can go wrong**: README (below).
- **Bonus**: live web app (Phase 3) + Loom + prompt-log + cost/ROI note (per-run token cost × volume).

### Rollout narrative (README)

Week 1: two friendly reps on the existing-contact path only; AI Next Email lands in their sequence, drafts reviewed before send; measure reply lift + time saved. Month 1: add the new-lead + hygiene path and live Account Research; widen to a pod; publish the rep-facing doc showing what the AI read and why an email came out as it did. Skeptical-rep move: never auto-send; show the AI Context + source tags that ground each line; let them edit and learn from edits. Trust comes from transparency, not from hiding the machine.

### Failure modes (README)

- Empty/sparse fields: enrichment fills; if it can't, the draft degrades gracefully and is flagged low-confidence rather than inventing facts.
- Hallucination: QA grader checks grounded + cited + no-invented-facts + valid source/pillar tag per line; fail → revise once → human review.
- Bad/duplicate inbound: the hygiene gate (exact → fuzzy → AI adjudication) dedups before anything reaches a rep.
- Ignored tool: output slots into the existing outreach sequence as the next step (the AI Next Email field) — meets reps where they work.
- Provider/LLM/n8n down: research + enrichment degrade gracefully; generation falls back to the templated path; Account Research uses committed fallbacks. The run continues and flags reduced confidence.

## Definition of done

Both paths run **live** (real Claude via n8n, with fallback) in the app, Analytics reflects real runs, the three full prompts are committed, the four layers hold all logic, the README covers all rubric sections with the diagram, a Loom walks the flow, and the prompt-log appendix is included. Deployment (Phase 3) is separate. If the box runs out, ship what runs and write down what was cut and why.
