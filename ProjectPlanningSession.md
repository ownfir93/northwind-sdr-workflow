# Project Planning Session

A log of the design discussion behind the Northwind GTM take-home, from receiving the assignment through the finalized build plan. It captures the decisions, the options weighed, and the reasoning, so the path to the architecture is visible and defensible.

Scenario chosen: **A — SDR research is eating the day.** Deliverable: an agentic workflow that ingests leads, reconciles them against the CRM, enriches, builds AI context, and drafts the best next outreach step, with a live web app and a reporting layer.

---

## 1. Assignment intake and scenario selection

**Question.** Three scenarios on offer (SDR research, pipeline-review risk, sales-to-CS handoff). Which to commit to, given a 3-hour box and a desire to ship something working?

**Considered.** A is the obvious pick and error-prone; B is where the deterministic-vs-AI judgment is sharpest but a thinner AI story; C is solvable but the honest answer is "we bought it," which weakens a build demo.

**Decision.** Commit to A, confidently. It is already built in the candidate's production system (context engine, enrichment, human-in-the-loop sequences), it is a direct line to the hiring manager's most-liked post (an account-research Claude skill), and its biggest weakness (AI emails going wrong) is actually the strongest material: the lived story of running a fully-automated version, finding it imprecise, cutting it, and going human-in-the-loop. "Be opinionated" is on the rubric, so no time spent deciding.

**Also set here.** Structure the deliverable as a four-layer git repo to mirror the hiring manager's own architecture. Keep an authentic Claude Code CLI prompt log as an appendix. Open with a sharp clarifying question (email-only vs multi-channel, warehouse/Gong access).

## 2. Salesforce as runtime? No — Salesforce as proof

**Question.** Build the demo by standing up a Trailhead Salesforce sandbox and running it the way the production system runs?

**Decision.** No. Salesforce-as-runtime signals "I build the way you are deliberately moving away from," and a blank sandbox is a setup time bomb inside a 3-hour box. Keep Salesforce as the credibility anchor, not the engine: export sanitized records as data, build the AI core in Claude, diagram it as the target stack, and include one redacted screenshot of the real production output as an appendix. This turns "I built it in Salesforce" into the adaptability story a take-home is secretly testing.

## 3. Does Claude have a native automation layer like n8n?

**Question.** Is there a Claude-native orchestration option instead of n8n?

**Found.** Yes. Claude Code Routines (cloud-hosted saved configs with scheduled, API-webhook, and GitHub triggers; research preview) and Managed Agents scheduled deployments. Plus Outcomes (a rubric grader that loops until a draft passes) and multi-agent orchestration.

**Decision direction.** Routines resonate harder with the hiring manager than n8n (Claude Code + git native), and Outcomes is a strong, current answer to the hallucination/quality concern. But routines are account-bound and research-preview. Held as an option pending the build-tool decision.

## 4. Deploying routines for reviewers, and the repo shape

**Question.** Do I have access, and how would reviewers run it with sample data?

**Decision.** Access is self-checkable at claude.ai/code/routines (paid plans). Reviewers cannot run an account-bound routine, so "see it in action" means reproducible plus recorded: an API-triggered routine pointed at the repo, a short Loom of a real fire, and committed sample inputs/outputs. Human-in-the-loop must sit outside the unattended run (draft to a review channel, never auto-send).

## 5. Bundle routines into a Claude Project?

**Question.** Can routines live inside a Claude Project?

**Decision.** No — different surfaces. The repo is the bundle (four layers + Skills + samples); Skills are the composable unit; a Project would pull logic out of git, the opposite of the desired impression. Reach for the repo, not a Project.

## 6. Ordered Skills, n8n for the flow, and what goes where

**Question.** Use an ordered set of Skills, use n8n to show the flow visually, and where does each piece live in the repo?

**Decision.** Yes to ordered Skills and to n8n as the visual orchestration layer (it gives the architecture diagram the rubric wants and lets us say the workflow tool is deliberately dumb). Governing principle for placement: the four layers are the brain (knowledge and decisions the agents read); n8n, sample data, and the web app are siblings around it. If it is knowledge or instructions, it is a layer; if it is plumbing, data, or UI, it is a sibling folder.

## 7. No pre-baked examples; run live; local stack

**Question.** Avoid canned outputs, run live through n8n on example records, let the app pick any record and fire example triggers (including an AI-generated Gong transcript). Build locally with Next.js, MUI, an open-source CRM, and a Claude key. What is the plan?

**Decision.** Favor a seeded Postgres + Prisma database surfaced through the app as the record browser over a full OSS CRM (Twenty), to cut integration surface and control the schema (campaign members, staging, merge state). Stack: Next.js (App Router) + MUI, Postgres + Prisma, n8n in Docker, Claude via env key. Split the work: staging the model and data is untimed; building the workflow is timed. Declared a cutover fallback up front: if the app-to-n8n-to-Claude loop is shaky, swap n8n for Next API routes running the same prompt files. Scope guards: small data, Haiku for transcripts, Sonnet for reasoning.

## 8. LinkedAPI as an enrichment layer

**Question.** Integrate LinkedAPI (the LinkedIn data API) as enrichment, where Clay would otherwise sit?

**Decision.** Model it as a provider, not a layer. n8n plays Clay's orchestration role; LinkedAPI is one swappable provider behind a provider-agnostic enrichment step. The decision to enrich lives in coordination, the policy in context, the step in execution, the wiring in orchestration, the contract in integrations. Constraints noted: auth is account-bound (so mock for reviewers), and it is an unofficial LinkedIn tool (flag ToS/compliance before production).

## 9. Model enrichment as a pre-enriched CSV (the Clay callout stub)

**Question.** Instead of a live provider, use a second CSV of the same contacts, enriched, acting as the Clay callout?

**Decision.** Correct approach, and a cleaner architectural statement: it is a stub/fixture standing in for the provider. Keep the contract identical to a real callout (call an enrichment function backed by CSV today, API tomorrow). Model it as a before-to-after diff with each filled field tagged by source, so the enrichment visibly improves the context and the next email. Make the enriched set meaningfully richer (seniority, recent role change, persona) so the draft actually changes.

## 10. Rename, two-part plan, demo-first

**Decision.** Keep the `coordination/` folder (it mirrors the hiring manager's exact four-layer repo) but make the lead file `triggers.md` for clarity. Split the plan into Part 1 (Demo, untimed) and Part 2 (Workflow, timed), and build the demo first to understand the data before the clock starts. Generated the five CRM fixtures (accounts, sparse contacts, enriched contacts, opportunities, campaign members) with consistent IDs and deliberately sparse base records.

## 11. New vs existing contacts, dedup hygiene, and a reporting layer

**Question.** Add existing-vs-newly-found contacts (Clay feeding new ones), demonstrate dedup/hygiene against the existing DB, and bake in a reporting layer that proves the system works.

**Decision.** Three additions. (1) New contacts get their own staged source (`found_contacts.csv`) and a real `status` (active/staged/merged), not just a flag, giving the workflow two entry paths. (2) A hygiene gate as a new Skill (exact match deterministic, then fuzzy, then AI adjudication into merge/review/create) — the production Database Health Center in miniature, and a clean deterministic-vs-AI beat. (3) A Dashboard view in the app, event-driven, that aggregates ingestion, hygiene, and workflow metrics live as reviewers run scenarios. Scope guard: keep exact-match dedup deterministic and cheap; treat the AI fuzzy tier as the "if time" sophistication.

## 12. Scaffolding the extension

**Produced.** `found_contacts.csv` with six records seeding all three outcomes (two exact dups, two fuzzy dups, two net-new), plus a built-in `expected_outcome` answer key. Updated `schema.prisma` with status/source/merge self-relation and the `Run` and `HygieneEvent` reporting tables. A runnable Dashboard shell (`app/dashboard/page.tsx`) and metrics API (`app/api/metrics/route.ts`) that render empty states and fill as scenarios run.

## 13. The project plan for Claude Code

**Produced.** `PROJECT_PLAN.md`, the build brief: operating principles, the timed/untimed boundary (`runWorkflow()` stub becomes real), the cutover fallback, architecture and both contact paths, the repo tree tagged by phase, the data model, Phase 1 and Phase 2 tasks with acceptance-criteria gates, the ordered Skills with input/output contracts, deliverables mapped to the rubric, and a rollout/failure-modes narrative for the README.

## 14. Model map and email-generation context

**Decision.** Per-step models: Opus 4.8 (`claude-opus-4-8`) for the draft (the rep-facing artifact where prose quality shows), Sonnet 4.6 (`claude-sonnet-4-6`) for context, research, QA, and hygiene adjudication, Haiku 4.5 (`claude-haiku-4-5`) for transcript generation, and no LLM for the mock enrichment lookup. Email-generation context splits across two places: the reusable know-how in `context/` (`brand-voice.md`, `messaging-pillars.md`, `sequence-definitions.md`, `persona-rubrics.md`) and the per-contact AI Context handed in by upstream skills. Highest-value design element: the draft must attribute every personalized line to a source signal or an approved pillar, so QA can verify grounding and a skeptical AE can see why the email said what it said. This single mechanic answers the hallucination and AE-trust rubric lines at once. Updated `PROJECT_PLAN.md` accordingly.

---

## Principles that held throughout

- Defensibility over cleverness; if it cannot be explained, cut it.
- Logic in git; the workflow tool stays dumb.
- Provider-agnostic interfaces; mock today, live tomorrow, same shape.
- AI where context and language create leverage; deterministic where trust and auditability matter.
- Human in the loop on anything that sends.
- Prioritize under the constraint, and write down what was cut and why.

## Artifacts produced in this session

- Fixtures: `accounts.csv`, `contacts.csv`, `contacts_enriched.csv`, `opportunities.csv`, `campaign_members.csv`, `found_contacts.csv`
- `schema.prisma` (CRM + status/source/merge + Run + HygieneEvent)
- `app/dashboard/page.tsx` and `app/api/metrics/route.ts`
- `PROJECT_PLAN.md` (both phases)
- This session log