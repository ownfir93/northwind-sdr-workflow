# Persona rubrics — how tone, angle, and pillar shift by persona + seniority

The draft selects angle + pillars from the contact's `persona` and `seniority`. If persona is empty after
enrichment, infer conservatively from title/signals and mark low-confidence (shorter, safer email).

## By persona
| Persona | What they care about | Lead pillar(s) | Angle |
|---|---|---|---|
| **Economic Buyer** (VP/Director Growth, Marketing, Ecommerce) | revenue, LTV/CAC, speed-to-impact | audiences, closed-loop, ai decisioning | business outcome + a scoped pilot with a metric |
| **Champion** (Lifecycle/Demand-Gen/Growth lead) | shipping campaigns faster, less data-team dependency | audiences, warehouse-native activation | "stop rebuilding lists by hand"; make them the hero |
| **Technical Buyer** (Data Platform, Analytics Eng, Head of Data) | governance, no duplicate data, maintainability | reverse ETL, warehouse-native activation | architecture + control; respect the in-house option |
| **Influencer** (Analyst, PM) | making their work actionable | audiences, reverse ETL | how their models/segments reach tools |

## By seniority (tone + length)
- **C-Level / Founder**: 1 sharp insight + 1 outcome + a low-friction ask. ≤ 70 words. No how-it-works.
- **VP / Senior Leadership**: business case + proof point + scoped next step. ~80 words.
- **Director / Manager**: a bit more concrete on the use case; can name the workflow pain. ~90–110 words.
- **IC / Analytics Engineer**: most technical; reverse-ETL/governance specifics welcome. ~100 words.

## Edge cases
- Empty title AND enrichment failed → infer seniority from email pattern (founder@, first.last@) + account
  signals; default to a conservative Director-level, low-confidence, general email.
- Persona conflict between CRM and enrichment → trust enrichment if fresher; else flag and stay general.
