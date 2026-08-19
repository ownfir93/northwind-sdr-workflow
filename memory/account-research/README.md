# Account Research fallbacks

Pre-computed outputs for the **live Account Research agent**. The agent
populates `Account.accountResearch` + `Account.accountAiContext` and sets `researchedAt` for a
research-empty account. These files are the **demo safety net**: if the live web call fails or times
out mid-walkthrough, the workflow loads the matching entry from `fallbacks.json` instead.

- One `*.md` per real account = the human-readable research artifact (the shape the agent returns).
- `fallbacks.json` = the structured values keyed by `accountId`, ready to load into Postgres.

> Note: these are illustrative research summaries for **real companies** grounded in public,
> widely-known facts. Firmographic specifics like the exact data stack are **inferred ICP-fit
> assumptions** for the demo, not asserted private facts — flagged inline where inferred.
