# 05-qa-grade

**Model:** Sonnet 4.6 · **Path:** both · **Calls Claude via n8n:** yes

## Purpose
Grade the draft against `coordination/qa-rubric.md`. Pass → write `aiNextEmail`, route to human review.
Fail → revise once; if still failing, route to human review flagged `needsHumanEdit` (never present a failing
draft as ready).

## Input
```
{ draft: { subject, body, citations[] }, context: <AI Context object> }
```

## Output
```
{ passed: boolean, rubric: [ { criterion, pass } ], failedReasons: string[] }
```
criteria = grounded · cited · on-brand · no-invented-facts · correct-sequence-stage.

## Rules
- Mechanical tag check: every `[pillar: x]` must exist in `messaging-pillars.md`; every
  `[enrichment|oppty|engagement|account: …]` must map to a real fact in the context. Unmatched → fail `cited`.
- Enforce `brand-voice.md` (length, one CTA, banned phrases, plain text).
- Low-confidence runs: expect a shorter/general email — don't fail caution; DO fail invented specifics.

## Output contract for the orchestrator
The app reads `passed` to set `Run.qaPassed` + `outcome`. On a fail-then-revise, the second draft is what
gets written (or the review flag is set).
