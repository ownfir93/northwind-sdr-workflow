# Messaging pillars — the approved value props (content-level hallucination guard)

The draft may only make value claims that map to a pillar below. Each personalized value line carries a
`[pillar: <id>]` tag so QA can verify it's approved material, not invented. Pick the 1–2 pillars that fit
the contact's persona + account signals; don't list them all.

## Pillar: warehouse-native activation  `[pillar: warehouse-native activation]`
- **Claim**: act on the data already in your warehouse — no second copy, no SDK, governance stays put.
- **Proof points**: 200+ destinations; syncs run on the warehouse as the source of truth; no rip-and-replace.
- **For**: teams on Snowflake/BigQuery/Databricks frustrated that data is "stuck" in the warehouse.

## Pillar: reverse ETL  `[pillar: reverse ETL]`
- **Claim**: push modeled warehouse data (dbt models, scores, segments) into the tools teams already use.
- **Proof points**: sync to CRM, ads, ESP, support; incremental + observable; built for data teams.
- **For**: data/analytics-engineering buyers replacing manual CSV exports or in-house scripts.

## Pillar: audiences without SQL  `[pillar: audiences]`
- **Claim**: marketers build and sync audiences on warehouse data without filing a data ticket.
- **Proof points**: visual Audience builder on governed warehouse data; reusable across channels.
- **For**: lifecycle / growth / demand-gen buyers blocked on the data team for every segment.

## Pillar: closed-loop + suppression  `[pillar: closed-loop]`
- **Claim**: sync conversions back to the warehouse and suppress the wrong people to cut wasted spend.
- **Proof points**: closed-loop on ad spend; suppression of recent purchasers/unsubs; cleaner CAC.
- **For**: performance-marketing and margin-focused DTC buyers.

## Pillar: AI Decisioning  `[pillar: ai decisioning]`
- **Claim**: let AI choose the next best action/offer per user on top of activated warehouse data.
- **Proof points**: experiment-backed next-best-action; built on the same governed data, not a black box.
- **For**: mature growth orgs ready to go beyond static audiences.

## Objection handling (approved)
- *"We have Segment / a CDP."* → warehouse-native means no duplicate data store or SDK lock-in; many teams
  run GTM Josh alongside or in place of a packaged CDP. `[pillar: warehouse-native activation]`
- *"We're building it in-house on dbt."* → that's exactly our shape — maintained, governed, observable, and
  fast to value, without babysitting scripts. `[pillar: reverse ETL]`
- *"Not a priority."* → tie to a live signal (funding, hiring, manual-export pain); offer a scoped pilot, not a platform pitch.
