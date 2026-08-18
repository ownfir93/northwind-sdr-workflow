# 04-draft-email

**Model:** Opus 4.8 (`claude-opus-4-8`) · **Path:** both · **Calls Claude via n8n:** yes

## Purpose
The rep-facing artifact. Fuse the per-contact AI Context with the reusable rules (brand voice, messaging
pillars, persona rubrics, sequence definitions) into the single best next email. Every personalized line is
attributed to a source signal or an approved pillar — the highest-value mechanic in the system: it answers
the hallucination and rep-trust concerns at once.

## Input
```
{ aiContext, sequenceStep, persona, seniority, triggerLabel, triggerNudge }
```
The orchestrator appends `brand-voice.md`, `messaging-pillars.md`, `persona-rubrics.md`,
`sequence-definitions.md` to the system prompt.

## Output
```
{ subject, body, citations: ["[enrichment: …]", "[pillar: …]", …] }
```

## Rules (enforced by QA)
- Every personalized line carries an inline `[source]` tag; every tag maps to a real fact in `aiContext` or an
  approved pillar. No invented specifics.
- Brand voice: 60–110 words, subject ≤ 6 words, one CTA, plain text, no banned phrases.
- Pick angle + pillars from persona/seniority (`persona-rubrics.md`); write for the mapped sequence step.
- Thin/low-confidence context → shorter, general, honestly-grounded email.

See `PROMPT.md` for the full prompt.
