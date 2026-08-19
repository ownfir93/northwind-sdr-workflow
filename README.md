# AI Context Layer Demo

Runnable demo for the CRM AI context layer guide.

The app ingests leads, reconciles them against a CRM-shaped Postgres database, researches/enriches the account, builds AI context, drafts a next email, QA-checks it, and writes the result back as an “AI Next Email” field. The workflow is visualized in React Flow so you can see each step run.

Runtime is now direct Next API routes → Anthropic. No n8n required.

## Architecture

```text
Automated event / scheduled job
  ├─ existing contact
  │   └─ research → enrich → account research gate → build context → draft → QA
  ├─ new lead
  │   └─ ingest → hygiene gate → survivor joins the same core
  └─ write AI Next Email → analytics
```

## What matters

- `context/` holds the reusable business context: ICP, messaging, field glossary, enrichment policy, source rules.
- `coordination/` holds decisions: triggers, hygiene rules, handoffs, QA rubric.
- `execution/` holds the ordered skills and full prompts.
- `memory/` holds fallback account research so the demo doesn’t brick when live generation is unavailable.
- `lib/llm.ts` is the direct model runtime. If `ANTHROPIC_API_KEY` / `ANTHROPIC_KEY` is missing, callers fall back to deterministic demo output.

## Run locally

```bash
npm install
cp .env.example .env
# set DATABASE_URL
# optionally set ANTHROPIC_API_KEY or ANTHROPIC_KEY for live model calls
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000/workflow`.

## Environment

```bash
DATABASE_URL=""
ANTHROPIC_API_KEY=""
ANTHROPIC_KEY=""

# Optional if the model aliases need to change.
ANTHROPIC_CONTEXT_MODEL=""
ANTHROPIC_DRAFT_MODEL=""
```

Without an Anthropic key, the app still runs. It uses deterministic fallback drafts and committed account-research fallbacks.

## Demo path

1. Open `/workflow`.
2. Pick `Opp stage changed`.
3. Choose a Pipeline lead.
4. Run the workflow.
5. Click `03 Build Context`, `04 Draft`, or `05 QA` to inspect the prompt and output.

Use `Try It` to upload leads or run the seeded Clay batch. `Analytics` reflects runs, QA outcomes, generation timing, ingestion counts, and duplicate handling.

## Deploy notes

The app is configured with:

```ts
basePath: "/guides/crm-ai-context-layer/demo"
```

That lets the main `gtmjosh.com` site proxy the demo under:

```text
/guides/crm-ai-context-layer/demo
```
