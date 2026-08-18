# 03-build-context

**Model:** Sonnet 4.6 · **Path:** both · **Calls Claude via n8n:** yes

## Purpose
Produce the **AI Context** object that grounds the draft — a compact, current-state synthesis of the CRM
record, enrichment, research signals, campaign engagement, opportunity (with next-step history), and the
account research / AI-context. This is the same shape a rep would want in front of them. Refreshed every run
(the account `accountAiContext` is the continually-updated layer).

## Input
```
{ contact (enriched), account (research + aiContext), opportunity?(+ nextStepHistory), campaignMembers[], research, trigger }
```

## Output (AI Context object)
```
{ briefing, historyNote, accountAiContext, opportunityContext|null, signals[], nextStep{stage,reasoning}, lowConfidence }
```
- `signals[]` each cite a source; `opportunityContext` includes what the next step moved from/to.
- `lowConfidence: true` when enrichment failed / research is thin → the draft stays general.

## Rules
- Only include facts present in the input. No invented details. Tag-able specifics only.
- Resolve enrichment-vs-CRM conflicts per `enrichment-policy.md`.
- Map the recommended `nextStep` from the lifecycle Stage (+ trigger overlay) per `sequence-definitions.md`.

See `PROMPT.md` for the full prompt.
