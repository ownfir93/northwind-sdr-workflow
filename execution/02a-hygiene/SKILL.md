# 02a-hygiene

**Model:** Sonnet 4.6 (fuzzy adjudication tier only) · **Path:** new-lead only · **Calls Claude via app runtime:** yes (Tier 3 only)

## Purpose
Reconcile a staged inbound (Clay) contact against active CRM contacts before it reaches a rep. The
deterministic-vs-AI showcase: **exact and clear cases are decided in code; the LLM only sees genuine
ambiguity.** Writes a `HygieneEvent`; promotes survivors `staged → active` (or `merged`).

## Tiers (see `coordination/hygiene-rules.md`)
1. **Exact** (deterministic): normalized email match → `auto_merge`, `matchType: exact`, conf 1.0. No LLM.
2. **Fuzzy candidate gen** (deterministic): same-account name+title+email-localpart similarity. Score ≥ 0.85
   with corroboration → ambiguous → Tier 3. Score < 0.55 / no candidate → `create_new`, `matchType: none`.
3. **AI adjudication** (Sonnet 4.6): only the 0.55–0.85 / conflicting band. See `PROMPT.md`.

## Input / Output
```
in:  { stagedContact, candidates[] }
out: { decision: auto_merge|needs_review|create_new, matchType: exact|fuzzy|none, confidence, matchedContactId?, reason }
```

## Rules
- **Bias to needs_review — never risk a wrong merge.** A wrong merge corrupts a real rep's record.
- Promotion: `auto_merge` → staged becomes `merged` (mergedInto survivor); `create_new` → `active`;
  `needs_review` → stays `staged`, human queue, no draft.

## Seeded outcomes (answer key, stripped at ingest)
exact: FND001, FND006 · fuzzy→AI: FND002, FND005 · create_new: FND003, FND004.
