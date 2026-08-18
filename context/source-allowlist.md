# Source allowlist — what research may cite

`01-research` and the live Account Research agent may only ground claims in these source classes, and must
attach a source to every finding. Anything outside the allowlist is not asserted in the email.

## Allowed sources
- **First-party CRM**: the seeded account/contact/opportunity/campaign records (system of record).
- **Enrichment provider**: Clay / LinkedAPI fields (mock CSV in the demo) — tagged `[enrichment: …]`.
- **Public company web**: the company's own site, careers/jobs pages, engineering/data blog, public docs.
- **Reputable press / filings**: funding announcements, leadership changes, earnings/press (named outlet).
- **Public profiles**: LinkedIn-class title/role/tenure signals (treat as enrichment-grade, not gospel).

## Not allowed (never asserted as fact in the email)
- Unverified third-party data brokers, scraped private data, or anything paywalled/grey-area.
- Inferred internals stated as fact (exact headcount, revenue, named internal tooling) unless a cited source
  supports it — otherwise phrase as a hypothesis or omit.
- Personal/sensitive attributes; anything not relevant to a B2B data-activation use case.

## Citation rule
Every research finding returns `{ claim, sourceClass, sourceRef }`. The draft may only use a finding by
referencing its tag; QA fails any personalized line whose claim isn't backed by an allowed, cited source or an
approved pillar.
