# Enrichment policy — freshness, trusted source per field, conflict resolution

Governs `02b-enrich` (provider lookup) and how enriched values flow into context + the draft. Mock provider =
`fixtures/enrichment/contacts_enriched.csv` via `lib/enrichment.ts`; live = Clay / LinkedAPI (same shape).

## Trusted source per field
| Field | Preferred source | Notes |
|---|---|---|
| title, seniority | enrichment > CRM | CRM titles go stale; enrichment reflects current role |
| persona | enrichment > CRM | derived from title + signals |
| recentRoleChange | enrichment only | the highest-value opener signal |
| headline, tenureYears | enrichment only | context, not asserted in the email unless tagged |
| email, accountId | CRM (system of record) | never overwrite identity keys from enrichment |
| lifecycleStage | CRM only | owned by marketing ops, not enrichment |

## Freshness
- Treat enrichment as current at run time (mock is static). Live: prefer values < 90 days old; older →
  use but flag "stale" in context.
- Account Research (`accountResearch`) is **lazy** — only (re)run when `researchedAt` is null or older than 90
  days. AI Context (`accountAiContext`) refreshes every run.

## Conflict resolution
- enrichment vs CRM on the same field → take the trusted source above; if both present and disagree on a
  *material* field (title/seniority), keep CRM value but note the discrepancy in context.
- Never let enrichment introduce a claim the email then asserts without a `[enrichment: …]` tag.

## Graceful degradation
- Provider unavailable / no row for the contact → proceed on existing CRM data, set `enrichmentApplied=false`,
  and mark the draft low-confidence. Do **not** invent the missing fields. A sparse contact still gets a
  shorter, general, honestly-grounded email.
