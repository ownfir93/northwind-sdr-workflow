# Account Research — Ramp (ACC006)

**Industry:** Financial Services (fintech — corporate cards + spend management) · **HQ:** New York, NY · **Size:** ~500–1,000

## Overview
Ramp is a fast-growing fintech offering corporate cards, bill pay, and spend management, founded 2019
and valued in the multi-billions. It is known for an unusually strong engineering and data culture and
a fast, data-driven GTM motion.

## Why now (signals)
- Sophisticated data org → product + billing + usage data already modeled in the warehouse.
- High-velocity, performance-marketing-heavy GTM that lives and dies on audience quality + closed-loop.
- Strong "build vs. buy" instinct — they will scrutinize ROI and prefer warehouse-native, not a black-box CDP.

## Data stack (inferred ICP fit)
Almost certainly a modern warehouse (**Snowflake**) with **dbt** transformations; performance marketing
into the major ad platforms. *(Inferred — confirm in discovery.)*

## Northwind use case
**Warehouse-to-ads activation + closed-loop**: sync high-intent, product-qualified audiences from the
warehouse to ad platforms and outbound, then close the loop on conversions back to the warehouse — far
cleaner than manual CSV exports. Reverse ETL into CRM/outbound for sales as a fast-follow.

## Personas
- **Economic buyer:** Head of Growth Marketing / VP Marketing.
- **Champion:** Growth / Marketing Ops lead.
- **Technical:** Analytics Engineering / Data Platform.

## Risks / notes
Strong in-house build bias and a discerning data team — win on time-to-value and governance, not on
"we'll do it for you." Expect a technical eval.
