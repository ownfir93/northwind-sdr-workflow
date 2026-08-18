# Hygiene rules — exact → fuzzy → AI adjudication (deterministic-vs-AI)

Governs `02a-hygiene`. A staged inbound (Clay) contact is reconciled against active CRM contacts before it
ever reaches a rep. The point: **be deterministic where trust matters, AI only for genuine ambiguity.**
Writes a `HygieneEvent` per inbound; promotes survivors `staged → active` (or `merged`).

## Tier 1 — Exact (deterministic, no LLM)
- **Match on normalized email** (lowercased, trimmed). Exact email match → `decision = auto_merge`,
  `matchType = exact`, `confidence = 1.0`. Merge the staged record into the existing survivor.
- This tier must never call an LLM — it's the auditable, cheap, always-right path.

## Tier 2 — Fuzzy candidate generation (deterministic threshold)
- For inbounds with **no exact email match**, generate candidate matches within the **same account** scored on:
  - name similarity (first+last, allowing nicknames: Jess≈Jessica, Marc≈Marcus) — Jaro-Winkler / token ratio,
  - title similarity, and email **local-part** similarity / domain variants (e.g. `meridian-health.org` vs `meridianhealth.org`).
- Combined score ≥ **0.85** with corroborating signals (same account + similar title) → treat as a strong fuzzy
  candidate and pass to Tier 3. Score < **0.55** with no candidate → `decision = create_new`, `matchType = none`.
- The 0.55–0.85 band, or strong-score-but-conflicting-signals, is **ambiguous** → Tier 3.

## Tier 3 — AI adjudication (Sonnet 4.6, only for ambiguous pairs)
- Input: the staged record + each candidate + why it's ambiguous. The model decides **merge-safe vs needs-review**,
  returns `{ decision, confidence (0..1), reason }`. See `execution/02a-hygiene/PROMPT.md`.
- **Merge-safe criteria** (model must satisfy all to auto_merge): same person beyond reasonable doubt — same
  account, name is a known variant/nickname, title consistent with a promotion/lateral, no conflicting identity
  signal (different person same name). Confidence ≥ 0.85 → `auto_merge`; else `needs_review`.
- Anything the model is unsure about → `needs_review` (a human adjudicates). **Bias to review, never to a wrong merge.**

## Outcomes on the seeded set (the demo answer key, stripped at ingest)
- FND001 Adam Hale, FND006 Tobias Lang → **exact** email match → auto_merge.
- FND002 Marc/Marcus Webb (diff domain), FND005 Jessica/Jess Romero (name variant, same account) → **fuzzy →
  AI adjudicate** → merge-safe.
- FND003 Elena Cruz, FND004 Raj Patel → **no match** → create_new (promote to active).

## Promotion
- `auto_merge`: staged → `merged`, `mergedInto` = survivor; survivor keeps the canonical id.
- `create_new`: staged → `active`, proceeds to enrich/context/draft.
- `needs_review`: stays `staged`, routed to a human queue; no draft generated.
