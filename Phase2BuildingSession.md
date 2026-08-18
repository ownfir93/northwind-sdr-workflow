# Phase 2 Building Session

A log of Phase 2 — making `runWorkflow()` real: live Claude through n8n, the hygiene gate, the live
Account Research agent, and the iterations that followed. Companion to `Phase1BuildingSession.md` and
`PROJECTPLAN.md`. Decisions, options weighed, and what was produced — so the path stays defensible.

Outcome: the existing-contact path executes **live through a 17-node n8n Orchestration workflow** (03→04→05
chained), the new-lead path runs the **hygiene gate** (exact → fuzzy → AI), accounts get **live web
research**, and the Visualizer animates in sync — all themed to Northwind, on the private repo.

---

## 1. De-risk the long pole first
Before authoring anything, proved the riskiest integration. The n8n instance had **no Anthropic credential**,
and credentials can't be created with a secret via the API (UI-only). The user added an `anthropicApi`
credential (`kddgVGeze1YHISCF`). Built a **Generation Runner** workflow via the n8n MCP SDK
(`Webhook → Anthropic → Respond`), published it, and tested: a real `PONG`/`LIVE` came back through the
production webhook (raw Anthropic `content[].text`). The round-trip was real before any other code.

## 2. The four layers + SKILL contracts + the 3 full prompts (timed)
Per the user's correction, these count toward the timed box (they're the scrutinized deliverables; only the
Account Research fallbacks were untimed prep). Authored `context/` (9 files), `coordination/` (4), `memory/`
(2), `execution/0*/SKILL.md` (6), and the three full prompts (`03-build-context`, `04-draft-email`,
`02a-hygiene`, plus `05-qa-grade`). Prompts use a `## SYSTEM` / `## USER` split the app parses.

## 3. Wire live generation — app holds no LLM SDK
**Decision (locked by the user): n8n is the one true runner.** `lib/n8n.ts` POSTs `{model, system, user}` to
the runner and extracts the completion; `lib/prompts.ts` renders each step from the repo files. `api/run`
gained a live pass (03 → 04 → 05), each guarded with a templated fallback. First live run drafted a grounded,
source-attributed Opus email; QA passed.

## 4. The hygiene gate — deterministic, then AI
`lib/hygiene.ts` does exact-email + fuzzy scoring (Dice bigrams + nickname map). `api/ingest` runs the gate:
exact → fuzzy → **AI adjudication via n8n for the ambiguous band only**, writes `HygieneEvent`, promotes
survivors. Matched the seeded answer key exactly (FND002/FND005 AI-merged at 91%/93% with real rationales);
Analytics ingestion lit up (66.7% duplicate rate).

## 5. Live Account Research — the web-search wow
`lib/research.ts` runs the lazy agent (n8n → Claude **web search**) for a research-empty account, caches it,
and falls back to `memory/account-research/fallbacks.json`. Live on Vuori it returned **real current facts**
(the $825M Nov-2024 round at a $5.5B valuation, ~2,493 employees, a Snowflake CDP relaunch). Wired lazily
into `api/run` + a standalone `/api/research`.

## 6. "Why doesn't the n8n workflow showcase the triggers?"
**Caught gap.** The leads ran through the 3-node Generation Runner, so opening n8n showed a Claude proxy, not
the architecture. Built a second workflow — **GTM SDR — Orchestration** (17 nodes): event Webhook + nightly
Schedule triggers → Switch → the full ordered pipeline + new-lead hygiene branch. The canvas now mirrors the
Visualizer.

## 7. "The animation finishes before the steps do"
**Decision: stream.** Converted `api/run` to an SSE stream emitting a `done` event per step; the Visualizer
advances node-by-node in sync (verified: context → draft → qa paced to the real Claude calls). Account
Research stays event-driven; the unresearched account holds "active" through the real ~27s web search.

## 8. "The mock leads aren't actually running through the Orchestration workflow"
**Decision (asked the user): route through the Orchestration workflow + estimated stepping.** The
existing-contact path now POSTs to the orchestrator; n8n chains the nodes (04 appends 03's output, 05 appends
04's) and returns `{context, draft, qa}`. Caught a real bug — the 03 node hit `max_tokens` and truncated the
context JSON, which threw and silently fell back; fixed by raising the limit AND parsing each step
independently so one truncation can't sink the draft. Since the orchestrator returns the 3 steps together,
the Visualizer paces 03→04→05 on estimated timing during the real run and snaps forward on result.

## 9. Clean email body
The draft was emitting inline `[source]` tags in the body. **Decision: clean body, attribution in
citations.** Strip tags from the body (live + templated); the prompts + QA rubric now enforce a bracket-free
body and keep the source tags in the `citations` chips.

## 10. Documentation tab
Added a visual in-app explainer next to Analytics: the end-to-end pipeline, the two paths, the four layers,
triggers, skills + model map, the n8n runner + the two workflows, the hygiene gate, source attribution +
lazy research, measurement, and tech stack — using the same node-kind color system as the Visualizer.

## 11. "See Prompt Used" / "See Context Used"
Added expandable bubbles to the 03/04/05 popups. `api/run` returns the rendered prompts + the record fed to
03; the popup shows the prompt that hit each n8n Claude node and the AI Context it used.

## 12. Contact-level opportunity association
**Caught issue.** Opps were account-level, so the context couldn't tell whether a contact was on the deal or
just at the account. Added an **`OpportunityContact`** model (opportunity contact roles); `api/run` uses the
contact's associated opp + role (or "not on an opp"). Opp-stage/next-step triggers now require being on an
opportunity (any role), not Pipeline lifecycle.

## 13. "On an opportunity ⟹ Pipeline" (the strict rule)
The user's invariant: a contact genuinely on an opp must be Pipeline. Fixed the fixture (all opp-contacts →
Pipeline), enforced it in the seed (forces any drift back, logs it), and documented it in the field glossary.
So the two states are unambiguous: on an opp → Pipeline + a role; not on an opp → any other stage.

## 14. Prompt verbosity → relevance-slicing + display compression
**Question.** Why is the draft prompt so verbose — is it injecting all four layers? Yes: it appended the full
text of four `context/` files every call (~10K chars of mostly-irrelevant guardrails). **Decision: option 1 —
relevance-slice.** The draft now injects only what applies to this contact: brand voice (whole) + the
persona's row + seniority line + the candidate pillars for that persona + the trigger overlay (~4.2K chars,
~60% smaller, sharper). And the "See Prompt Used" view shows the core instructions inline and **collapses
each reference layer into its own expandable bubble** (they rarely change; expand on demand). QA keeps the
full pillar list (to validate any cited pillar). Also explained the rules-vs-facts model: the four files are
the RULES (how to write); the 03 AI Context is the FACTS (what to write) — the orchestrator appends 03's
output to 04's prompt, and the draft cites each fact.

## 15. Header polish
Made the top bar **sticky** (frozen on scroll) with a translucent blur, a gradient "H" mark, and active-tab
styling; dropped the "Phase 1 · Demo" chip; renamed to **"Northwind — GTM Personalization Hub."**

---

## State at end of Phase 2
- **Live generation** through the 17-node Orchestration workflow (chained 03 Sonnet → 04 Opus → 05 Sonnet),
  with a Generation Runner for hygiene adjudication + account-research web search; templated fallback throughout.
- **Two n8n workflows** published; the canvas mirrors the Visualizer; leads execute through the full pipeline.
- **Hygiene gate** (exact + fuzzy + AI) writing HygieneEvents; **live Account Research** with web search +
  committed fallbacks; **clean source-attributed** drafts; **real Analytics**.
- **Contact-level opps** with the on-opp⟹Pipeline invariant; **relevance-sliced, layer-collapsed** prompts;
  a **Documentation** tab; a **sticky branded** header.
- Repo: private, `main`, Phase 2 committed across many checkpoints.

## Principles that held
- De-risk the long pole first; prove the integration before authoring.
- n8n is the runner — the app holds no LLM SDK; logic + prompts in git.
- Deterministic where trust matters (exact/fuzzy dedup); AI only for genuine ambiguity.
- Never brick the demo: templated + committed fallbacks behind every live call.
- Honest data: on-opp ⟹ Pipeline; the email body a rep would actually send.

## Artifacts produced this phase
- Four layers (`context/`, `coordination/`, `memory/`), `execution/0*/{SKILL,PROMPT}.md`.
- `lib/{n8n,prompts,hygiene,research}.ts`; `api/{run (SSE),ingest,research}`.
- Two n8n workflows + `orchestration/{workflow,orchestration}.n8n.json` + `triggers-spec.md`.
- `OpportunityContact` model + `fixtures/crm/opportunity_contacts.csv`.
- Documentation page; sticky NavBar; rewritten `README.md`; `prompts-log/build-session.md`; this log.
