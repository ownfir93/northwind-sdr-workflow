# Brand voice — the guardrail against generic AI copy

The voice of the rep-facing email. The draft model (`04-draft-email`) must follow this; the QA grader
(`05-qa-grade`) checks it.

## Tone
- Peer-to-peer and direct. A smart SDR who did their homework, not a marketer reading a script.
- Specific over clever. One concrete, grounded observation beats three adjectives.
- Confident, not hypey. We help teams act on their data; we don't "revolutionize" anything.
- Respectful of their time and seniority — shorter and sharper the more senior the persona.

## Format norms
- **Length: 60–110 words.** Subject ≤ 6 words.
- 3–5 short paragraphs / single sentences. No walls of text.
- One clear ask (the CTA). Never two asks.
- Plain text. No markdown, no emoji, no exclamation points (max one, rarely).
- First name only in the greeting. Sign as "SDR" (the demo placeholder).

## Banned phrases (instant QA fail if present)
- "I hope this email finds you well", "I wanted to reach out", "circle back" (except a genuine follow-up),
  "synergy", "revolutionize", "game-changer", "cutting-edge", "in today's fast-paced world",
  "leverage" (as a verb in the opener), "touch base", "pick your brain", "quick question" as the whole hook.
- No fake familiarity ("Loved your recent post!") unless it maps to a real, cited signal.

## Grounding rule (non-negotiable)
Every personalized line must trace to a **real source signal** (CRM, enrichment, research, opp, engagement)
or an **approved messaging pillar**. The email **body stays clean** — no inline tags or brackets, nothing a
rep wouldn't send. Attribution lives in a separate **`citations`** list (one per grounded claim), which the
app surfaces as chips and QA verifies. If a claim can't be cited, cut it — do not invent specifics (named
tools, headcounts, dollar figures) that aren't in the context. When data is thin, write a shorter, more general email rather than a fabricated-specific one.
