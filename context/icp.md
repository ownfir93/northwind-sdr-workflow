# ICP — who Northwind sells to

Northwind is a composable CDP / data-activation platform: it activates data from the warehouse
(Snowflake, BigQuery, Databricks, Redshift) into 200+ operational tools — ads, CRM, marketing
automation, sales engagement — via Reverse ETL, an Audience builder, and AI Decisioning. We sell the
ability to *act on warehouse data without copying it into another silo*.

## Firmographic fit
- **Has a cloud data warehouse** (Snowflake / BigQuery / Databricks / Redshift), ideally with dbt.
- **Midmarket sweet spot**: ~200–2,000 employees, or a fast-growing smaller company with a real data team.
- **Verticals**: DTC / ecommerce, B2C subscription, fintech, PLG SaaS, marketplaces, media.
- **GTM maturity**: a marketing/RevOps/growth team that runs lifecycle, paid social, or PLG nurture and
  is bottlenecked moving data from the warehouse into tools.

## Strong buying signals
- Recent migration to a cloud warehouse / dbt adoption / hiring "analytics engineer" or "marketing ops".
- Manual CSV exports to ad platforms or ESPs; "audiences rebuilt by hand in each tool."
- Funding round earmarked to scale data-driven growth; new data/marketing leadership.
- Evaluating or unhappy with a packaged CDP (Segment, mParticle, Tealium) or building in-house on dbt.

## Disqualifiers / weak fit
- No warehouse (data only in app DBs or only in the ESP) — nurture toward a warehouse first.
- No operational use case (pure BI/reporting shop with nothing to activate).
- Tiny team with no data ownership and no budget.

## Competitive landscape (for objection handling)
- **Segment / mParticle / Tealium** (packaged CDPs): we're warehouse-native — no second copy of the data,
  no SDK lock-in, governance stays in the warehouse.
- **Census** (closest reverse-ETL peer): differentiate on Audiences + AI Decisioning + breadth, not just sync.
- **Build in-house on dbt + scripts**: we're the maintained, governed, fast-to-value version of what they'd
  otherwise hand-build and babysit.
