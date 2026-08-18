# Measurement spec — what each Analytics metric means + baselines

Defines the `/analytics` tab and the measurement story for the README. Metrics marked **measured** read
live from Postgres (`Run`, `HygieneEvent`, `Contact`); **modeled** are projections clearly labeled as such.

## Ingestion & hygiene (measured)
- **New contacts ingested** — count of `HygieneEvent` rows. **Exact / fuzzy dups caught**, **auto-merged /
  routed-to-review / net-new created** — by `matchType` / `decision`.
- **Duplicate rate** — (auto_merge + needs_review) / ingested. Target < 1% reaching reps.

## Workflow (measured)
- **Runs**, **Context generated**, **Drafts produced** — `Run` counts.
- **QA pass rate** — qaPassed / qaEvaluated.
- **Runs w/ enrichment** — enrichmentApplied true.
- **Avg generation time** — avg `Run.durationMs` (workflow latency, not human time-to-touch).

## Outcomes
- **Field fill rate (measured)** — active contacts with a title / all active. Proxy for "the 40%-empty problem."
- **Projected reply lift (modeled)** — placeholder until pilot reply data exists; labeled "modeled, not measured."

## Baseline → pilot → target (for the README narrative)
| Metric | Baseline (manual SDR) | 2-week pilot goal | 2-month target |
|---|---|---|---|
| Research + draft time per contact | ~10–15 min | < 1 min (AI) + rep review | sustained |
| Field fill rate (active w/ title) | ~60% | > 90% post-enrichment | > 95% |
| Duplicate rate reaching reps | unknown / manual | < 1% via hygiene gate | < 0.5% |
| Reply rate | team baseline X% | +1.3–1.5× on grounded drafts | hold the lift at scale |

## Cost / ROI note (for the README)
Per-run token cost ≈ (context + draft + QA tokens × model rates). At demo volumes this is cents per contact;
the comparison point is the ~10–15 minutes of SDR time it replaces per contact, with a rep reviewing the
output instead of authoring it.
