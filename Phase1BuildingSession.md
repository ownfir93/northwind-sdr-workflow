# Phase 1 Building Session

A log of the Phase 1 build, from verifying tooling access through shipping a complete, runnable
demo instance and a private repo. It captures the decisions made during the build, the options
weighed, and the pivots — so the path to the demo is visible and defensible. Companion to
`ProjectPlanningSession.md` (the design discussion) and `PROJECTPLAN.md` (the source of truth).

Outcome: a runnable local harness — a Northwind-themed GTM SDR workflow with a live Workflow
Visualizer, real Analytics, a Railway Postgres CRM, and a fully-orchestrated grounded-stub
`runWorkflow()` — committed to a private GitHub repo, staged to start the timed Phase 2.

---

## 1. Verify n8n access

**Question.** Can we reach the n8n instance before relying on it for the architecture?

**Done.** The n8n MCP server was installed but unauthenticated. Ran the OAuth device flow
(`mcp__n8n__authenticate`), the user authorized the code, and the connection came up against
`ownfir.app.n8n.cloud`. Listing workflows returned an empty instance — connection verified, instance
clean. First signal that **n8n is Cloud, not self-hosted Docker** as the original plan assumed.

## 2. Plan review and the three Phase 1 decisions

**Question.** Reviewing `PROJECTPLAN.md`, what's needed before executing Phase 1?

**Found.** The plan's "[DONE]" fixtures existed only as loose files in `Build Resources/`; nothing was
scaffolded (no `package.json`, Next app, Prisma, docker-compose). Local tooling check: Node 24 + git
present, but **no Docker and no local Postgres** — a real blocker for the plan's `docker compose up`
acceptance path.

**Decisions (asked the user).**
- **Database:** the end goal is hosting on Railway, so use a managed Postgres for both dev and prod.
- **n8n runtime:** use the connected **n8n Cloud** instance (not Docker).
- **Repo layout:** scaffold in the current folder, **matching the plan's tree** (the four-layer
  architecture mirrors the hiring manager's repo and is a key design signal).

## 3. Scaffolding

**Produced.** `create-next-app` (Next.js 16, React 19, TypeScript, App Router) merged into the project
root; the full plan tree built (`prisma/`, `fixtures/{crm,enrichment,inbound}/`, `app/`, `lib/`, plus
placeholder `context/ coordination/ memory/ execution/ orchestration/ integrations/`). Dependencies:
MUI v7 + MUI X DataGrid + the App Router cache adapter, Prisma, csv-parse, tsx. Build Resources files
relocated into their mapped destinations. Compatibility note handled up front: the provided dashboard
used MUI's legacy `Grid` API → migrated to v7's `size` prop.

## 4. The database, the hard way → Railway Postgres

**Question.** With no Docker/Postgres locally and a Railway end-goal, how do we run Phase 1's DB?

**Considered.** Local Homebrew Postgres (truly local), Docker Desktop (heavy install), cloud Postgres
(Neon), or Railway Postgres (same engine as eventual prod). The user wanted to **test locally first,
deploy as late as possible** — an auto-mode guard even blocked provisioning Railway PG as "too early."

**Decision.** The user explicitly authorized provisioning **Railway Postgres now** (app runs locally,
DB remote via the public proxy — provisioning a DB ≠ deploying the app). Installed the Railway CLI,
ran a browserless login, linked to the user's new project (`devoted-playfulness`), and added a Postgres
service. Wired the **public proxy `DATABASE_URL`** into `.env` for local dev; documented the internal
URL for deploy-time. `migrate dev` + `db seed` → populated DB.

## 5. Phase 1 core build

**Produced.** `prisma/seed.ts` (loads the CRM CSVs; `found_contacts` parsed but not loaded — it enters
via the ingest path); `lib/prisma.ts` singleton; `api/records` (real CRM reads, sparse-field flag);
`api/run` (grounded stub — pulls the real selected record); `api/ingest` (lists found contacts as
staged, answer key stripped); the Workbench (record browser + trigger selector + flow Stepper + results
panel); the Dashboard (live metrics polling). Acceptance criteria met: migrate+seed populated the DB
(4 accounts, 8 contacts, 3 opps, 7 campaign members), the app listed real records, triggers rendered
the flow with grounded output, the dashboard polled metrics. **Phase 1 baseline complete.**

## 6. First iterations — trigger, enrichment viz, stage vocabulary

**Decisions.** Added an **Opportunity-updated** trigger. Built the **before/after enrichment** view as
the headline of the demo — each field tagged where it drives the email (seniority → tone, persona →
angle, recent role change → opener), so the trigger's impact on personalization is visible. Normalized
the lifecycle **Stage** vocabulary to a controlled set (Suspect, Marketing Engaged, MQL, Working,
Pipeline, Closed Won, Nurture, Disqualified) and made the run output trigger-aware (each trigger
changes opener, subject, next step, CTA).

## 7. Richer account + opportunity context (no account enrichment)

**Question.** Generation needs more context across the account and opportunity objects — but without
adding account *enrichment* to the flow.

**Decision.** Added static CRM context columns: `accountContext` on Account; `context`, `painPoints`,
`competitor`, `nextSteps` on Opportunity. Wove them into the briefing, the research signals, and the
draft (a grounded line from the opp pain points, source-tagged). Migrated + reseeded.

## 8. The Workflow Visualizer

**Question.** The Workbench shows post-enrichment changes, but we need a feature that shows how the
whole thing works as an ongoing, automated process — with flow-chart/arrows and the ability to run a
lead "through" the workflow on example triggers. The triggers aren't human-made even though they're
buttons here.

**Decision.** Built the **Workflow Visualizer** (`/workflow`) with React Flow (`@xyflow/react`): the
end-to-end graph driven by **automated event sources** (not clicks), a run-a-lead-through animation,
and per-step detail. Renamed **Dashboard → Analytics** in the same pass.

## 9. Account Research bifurcation

**Question.** Account research *does* belong in the flow after all — but split "AI Context" (updates
continually) from "Account Research" (deep, web-sourced, only runs if not already populated). Demo it
on real accounts an n8n→Claude agent could research live.

**Decision.** Bifurcated the Account model: `accountResearch` (lazy — populate-if-empty),
`accountAiContext` (every run), `researchedAt` (the gate). Added a **conditional Account Research node
+ gate** to the Visualizer (runs only when `researchedAt` is null). The 4 seeded mock accounts ship as
"researched"; real research-empty accounts demonstrate the live path. Migrated + reseeded.

## 10. Trigger filtering, campaign-touch side effect, and more

**Decisions.** Trigger-based **lead filtering** (Opp Updated → Pipeline only; Inbound Form → Marketing
Engaged + MQL; Campaign touch → any except Suspect). A campaign-touch run now **writes a real touch**
(random engagement type tied to an existing campaign) so the freshly-generated context is grounded in
it. Click-a-step **popup** (with close button, one at a time). **Expandable research bubbles** under
01 Research. Step output shows each node's real output.

## 11. Consolidation and real Analytics

**Decision.** The Workbench felt redundant once the Visualizer's step popups showed the enrichment
diff, context, and email — so the **Workbench was removed** and the Visualizer became home (`/`
redirects to `/workflow`). Made **Analytics real**: `api/run` now writes a `Run` row per run (measured
duration), and metrics (runs, avg generation time, enriched-runs, fill rate) all read live from the DB.

## 12. New-lead trigger, scheduled trigger, and the AI Next Email field

**Decisions.** Added a **New Lead** trigger (pick an individual lead from the Clay found-contacts table
and run it through the new-lead path to a draft) and a non-runnable **Nightly batch (scheduled)** node
as scaffolding for a repeatable process. Reworked the final step: the workflow ends by **writing the
`aiNextEmail` field** on the contact (real write), then a distinct **outreach + human-send layer**
("Outreach sequence builds the in-sequence email from the field" → "Rep reviews & sends — never
auto-sends").

## 13. The Northwind re-theme (major pivot)

**Question.** The sample data and messaging were search-oriented (Lucidworks-style) — but the demo's
product is **Northwind** (composable CDP / Reverse ETL / warehouse-native activation / AI Decisioning).

**Decision.** Re-themed everything: all fixtures (accounts, opportunities, enrichment, campaigns, found
leads) to Northwind ICP signals (Snowflake/BigQuery + dbt + Braze/Klaviyo/Salesforce; data-activation
pain; Segment/Census competitors); the email **pillar** to `[pillar: warehouse-native activation]`; and
**renamed the `searchVendor` field to `dataStack`** (a data-preserving SQL `RENAME COLUMN` migration).
Added the 4 approved real midmarket accounts (Vuori, Ramp, Calendly, Brooklinen) as research-empty,
with 2–3 sample contacts each. Now 8 accounts / 18 contacts / 6 opps.

## 14. Rep-activity triggers

**Decision.** Added **Rep called / Rep sent email / Rep connected** — rep-activity events that refresh
AI Context and write a **fresh** AI Next Email. Rep-sent-email specifically produces the next-in-sequence
follow-up ("Following up on my last note…"), demonstrating that rep activity adapts the AI's next
message. Excluded Suspect/Disqualified from these.

## 15. Opportunity next-step history

**Question.** Is there an opportunity next-steps field? Add it plus a next-steps *history* — needed for
the opportunity-updated triggers.

**Decision.** `Opportunity.nextSteps` already existed (current step); added the missing **history**: an
append-only `OpportunityNextStep` model (note, stage, setBy, createdAt), seeded with 16 chronological
entries. Surfaced it in the AI Context popup (a timeline with the current step marked) and in the
opportunity-updated email ("Looks like we're past 'define pilot audiences…'").

## 16. Splitting "Opportunity updated," and the scheduled node

**Decision.** Split the single Opportunity-updated trigger into **Opp stage changed** (CRM stage
movement) and **Opp next-step updated** (uses the history) — two distinct events with distinct drafts.
Fixed the scheduled node's visuals: gave it a **distinct steel-gray color**, spaced it well clear of
the trigger nodes, removed the mislabeled edge text, and clarified that the nightly schedule is
**n8n-managed** (n8n Cloud's own cron), with an "n8n Cloud" badge.

## 17. Phase 2 plan, rewritten

**Question.** Build the Phase 2 plan; update `PROJECTPLAN.md` for everything we changed; ensure it's
doable in 3 hours.

**Found.** Most of what the old plan called "Phase 2" was already scaffolded — `api/run` orchestrates
the full pipeline; only the *generation* is templated, not LLM-backed. So Phase 2 is "make it real," not
"build the pipeline." Deployment was moved to **Phase 3** (untimed, per the user).

**Decisions (locked).**
- **n8n is the one true runner — never cut.** The app holds **no LLM SDK**; the Anthropic credential and
  every Claude call live *inside n8n*. Using API routes to call Claude would imply hand-building a web
  app per automation — the anti-pattern we're modeling against. A templated path remains a **demo
  safety net only**.
- **Real Claude calls** (Opus 4.8 draft; Sonnet 4.6 context/QA/hygiene/research) via n8n, with the
  templated fallback.
- **Hygiene:** exact + deterministic fuzzy + AI adjudication; writes `HygieneEvent`; promotes survivors.
- **Account Research:** all 4 real accounts researched **live** via n8n→Claude web search, with the
  committed fallbacks as a safety net; live n8n showcased.
- **Knowledge files, SKILL contracts, and the 3 full prompts count toward the timed box** (they are the
  scrutinized deliverables). The **only** untimed prep is the pre-computed Account Research fallbacks.

Rewrote `PROJECTPLAN.md`: three phases, the Northwind + Railway + n8n-Cloud architecture, the real data
model, the Phase-1 done-inventory, a tight 3:00 budget, and a cut-order in which the **live n8n
round-trip is never cut**.

## 18. Account Research fallbacks + private repo

**Produced.** `memory/account-research/` — readable research artifacts for Vuori, Ramp, Calendly, and
Brooklinen (grounded in public facts; stack specifics flagged as inferred), plus `fallbacks.json`
(structured `accountResearch` / `accountAiContext` / `researchedAt` keyed by `accountId`) as the live
agent's safety net. Initialized git, verified twice that no secrets were staged (`.env*` ignored; a
content scan for the real key, DB password, and proxy host came back clean), committed the full Phase 1,
and created the **private** GitHub repo `ownfir93/northwind-sdr-workflow` on `main`.

---

## State at end of Phase 1

- **App:** Workflow Visualizer (home) + Analytics, MUI + React Flow. 11 triggers across both paths, an
  n8n-managed nightly schedule node, run-a-lead-through animation, click-a-step popups, expandable
  research, the AI Next Email write + outreach/human-send layer.
- **Data:** Railway Postgres; schema across 6 migrations (CRM + status/source/merge; Run; HygieneEvent;
  OpportunityNextStep; `aiNextEmail`; account research/AI-context bifurcation; `dataStack`). Seeded:
  8 accounts, 18 contacts, 6 opps, 16 next-step history rows, 7 campaign members.
- **Generation:** `runWorkflow()` is a fully-orchestrated **grounded stub** — trigger framing, enrichment
  before/after, opp context + next-step history, source-attributed draft, QA, AI Next Email write, real
  `Run` rows. Analytics is live.
- **Theme:** entirely Northwind (CDP / Reverse ETL / warehouse-native activation).
- **Repo:** private, `main`, Phase 1 committed; staged to start the timed Phase 2.

## Principles that held throughout

- Match the four-layer tree — the architecture is the message.
- Provider-agnostic interfaces (mock CSV today, Clay/LinkedAPI tomorrow).
- AI where context/language create leverage; deterministic where trust matters.
- Human in the loop on anything that sends; the workflow writes a field, a rep sends.
- n8n is the automation runner, not a custom web app per automation.
- Test locally first; deploy as late as possible (Phase 3).

## Artifacts produced this session

- Next.js app: Workflow Visualizer (`app/workflow/`), Analytics (`app/analytics/`), API routes
  (`app/api/{run,ingest,records,metrics}`), `lib/{prisma,enrichment,stages,workflowGraph}.ts`.
- `prisma/schema.prisma` + 6 migrations + `prisma/seed.ts`.
- Northwind fixtures (`fixtures/crm/*`, `fixtures/enrichment/*`, `fixtures/inbound/*`).
- `memory/account-research/` (4 research artifacts + `fallbacks.json`).
- Updated `PROJECTPLAN.md` (Phases 1–3) and this log.
- Private repo `ownfir93/northwind-sdr-workflow`.
