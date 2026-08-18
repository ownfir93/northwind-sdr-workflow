# 02b-enrich

**Model:** none (deterministic) · **Path:** both · **Calls Claude:** no

## Purpose
Provider-agnostic enrichment lookup. Mock = `fixtures/enrichment/contacts_enriched.csv` via
`lib/enrichment.ts`; live = Clay / LinkedAPI (same shape). Returns normalized before/after field deltas,
each tagged with its source, applying `context/enrichment-policy.md`.

## Input
```
{ contactId }
```

## Output
```
{ applied: boolean, provider: string|null,
  fields: [ { key, label, before, after, changed, source, drives? } ] }
```
- `drives` marks fields that flow into the email (seniority → tone, persona → angle, recentRoleChange → opener).

## Rules
- Never overwrite identity keys (email, accountId) from enrichment.
- Trusted-source-per-field per `enrichment-policy.md`.
- **Graceful degradation:** no provider row → `applied:false`, proceed on CRM data, mark the run low-confidence.
  Never fabricate the missing fields.

## Why deterministic
Enrichment is a lookup against a system of record — auditable and cheap. No LLM needed in the mock path;
this is the "know where not to use AI" beat.
