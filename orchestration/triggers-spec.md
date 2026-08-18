# Orchestration — n8n Cloud node map & contract

n8n Cloud is the **runner**. The Anthropic credential and every Claude call live inside n8n; the app holds
no LLM SDK. Adding an automation = building an n8n workflow, not coding the app.

## Generation Runner (live, deployed)
- **Workflow:** `GTM SDR — Generation Runner` (id `hGETMYafoHXjKjWJ`) — exported in `workflow.n8n.json`.
- **Nodes:** `Webhook (POST /gtm-generate)` → `Claude (Anthropic text/message)` → `Respond to Webhook`.
- **Production URL:** `https://ownfir.app.n8n.cloud/webhook/gtm-generate`
- **Credential:** `anthropicApi` (attached to the Claude node; created in the n8n UI — not in the repo).

### Request (the app POSTs this per LLM step)
```json
{ "model": "claude-opus-4-8 | claude-sonnet-4-6",
  "system": "<rendered system prompt incl. four-layer files>",
  "user": "<rendered user prompt incl. AI Context>",
  "maxTokens": 700,
  "webSearch": false }
```
### Response
Raw Anthropic Messages object: `{ content: [{ type: "text", text }], usage, ... }`. The app extracts
`content[].text` (`lib/n8n.ts`).

### Who calls it (per the model map)
| Caller (app) | Step | model | webSearch |
|---|---|---|---|
| `lib/prompts.ts → contextPrompt` | 03 Build Context | `claude-sonnet-4-6` | false |
| `draftPrompt` | 04 Draft (rep-facing) | `claude-opus-4-8` | false |
| `qaPrompt` | 05 QA grade | `claude-sonnet-4-6` | false |
| `hygienePrompt` | 02a adjudication (ambiguous only) | `claude-sonnet-4-6` | false |
| `accountResearchPrompt` | Account Research (lazy) | `claude-sonnet-4-6` | **true** |

Prompts/knowledge live in git (`context/`, `coordination/`, `execution/`); the app renders them and passes
the rendered prompt to n8n, so logic stays in git and n8n stays dumb.

## Orchestration workflow (the architecture mirror, published)
- **Workflow:** `GTM SDR — Orchestration` (id `TpMeMkrZQKlkCLGa`) — exported in `orchestration.n8n.json`.
- **Triggers:** `Event Trigger (webhook, POST /gtm-orchestrate)` + `Nightly Schedule (cron, 02:00 daily)`.
- **Topology (mirrors the Visualizer):** `Switch (existing | new_lead)` → existing: `01 Research → 02b Enrich
  → Account Research → 03 Build Context → 04 Draft → 05 QA → Write AI Next Email → Respond`; new-lead:
  `Ingest → 02a Hygiene (AI adjudicate) → Promote survivors → Respond`; schedule: `Sweep stale-research
  accounts → Process new leads`.
- **Live nodes:** 03/04/05 + Hygiene are real Claude (Anthropic) nodes reading `body.prompts.<step>`; the
  deterministic steps are NoOp markers. Open this in n8n to see the triggers + full pipeline on the canvas.

## Two workflows, both used
- **Orchestration** — the **executor for the existing-contact path**. The app POSTs `{ path, prompts }`; n8n
  runs `Switch → 03 → 04 → 05` and chains the outputs (04 appends 03's, 05 appends 04's), returning
  `{ context, draft, qa }`. So a run genuinely executes through the full 17-node pipeline (visible in n8n
  executions, all nodes light up). The app parses each step independently (a truncated step can't sink the
  draft) and persists.
- **Generation Runner** — the per-step Claude caller used for **hygiene adjudication** (`api/ingest`, one
  call per ambiguous pair) and **Account Research web search** (`lib/research`). Granular + reusable.
- **Animation:** the orchestrator returns the 3 AI steps together, so the Visualizer paces 03→04→05 on
  **estimated timing** during the real run and snaps forward the moment the result arrives; Account Research
  stays event-driven (its own real call). Per-step DB-side streaming from one webhook isn't possible.
- Moving the Postgres reads/writes + the IF gate for Account Research INTO the orchestrator is the documented
  next step (see the README cut-list).

## Nightly schedule (scaffolded)
The `nightly_batch` trigger in the Visualizer maps to an n8n **Schedule Trigger** (cron) that would sweep
research-empty accounts (calling the same runner with `webSearch:true`) and process the day's new leads.
Represented as scaffolding; not wired live in the timed box.

## Demo safety net
If n8n/Claude is unreachable, the app falls back to deterministic templated output, and Account Research
falls back to `memory/account-research/fallbacks.json`. The architecture is unambiguously n8n-as-runner; the
fallback is never an alternative runner.
