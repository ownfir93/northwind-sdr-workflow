# Triggers — what each one means, what it fires, the gate, the next step

Each trigger is an automated event (n8n webhook or the n8n-managed nightly cron) — never a human click.
Mirrors `lib/workflowGraph.ts` (`VISUALIZER_TRIGGERS`). Columns: who's eligible, what the run does, which
sequence step it targets.

## Existing-contact triggers (path = existing)
| Trigger | Eligible leads | What it means | Run does | Next step |
|---|---|---|---|---|
| `new_gong_call` | any | a call was logged | research → enrich → context → draft referencing the call | per stage |
| `campaign_touch` | any except Suspect | marketing engagement happened | **writes a real touch**, then refreshes context + draft on that topic | Education |
| `opp_stage_changed` | Pipeline | CRM opp stage moved | draft matched to the new stage | Opportunity (multithread) |
| `opp_next_step` | Pipeline | the agreed opp next step changed | draft drives the new step, references prior (history) | Opportunity |
| `inbound_form` | Marketing Engaged, MQL | inbound interest | fast light-qualify draft | Qualify |
| `rep_called` | any except Suspect, Disqualified | rep dialed | "sorry I missed you" follow-up; **refresh AI Next Email** | follow-up |
| `rep_sent_email` | any except Suspect, Disqualified | rep sent an email | **next-in-sequence follow-up**; refresh AI Next Email | follow-up |
| `rep_connected` | any except Suspect, Disqualified | rep connected live | post-conversation recap + next step | follow-up |

## New-lead triggers (path = new_lead)
| Trigger | Source | Run does |
|---|---|---|
| `new_lead` | one lead from the Clay found-contacts table | ingest → hygiene → (survivor) enrich → context → draft |
| `clay_found` | the whole found batch | ingest all → hygiene each → survivors proceed; dups merged/flagged |

## Scheduled (n8n-managed)
| Trigger | Cadence | Run does |
|---|---|---|
| `nightly_batch` | nightly cron in n8n | sweep accounts with `researchedAt` stale/null → Account Research; process the day's new leads; refresh AI Context |

## The enrichment / research gate
- Enrich runs every existing/new-lead run (deterministic provider lookup; graceful if empty).
- **Account Research is gated**: runs only when `researchedAt` is null/stale (`enrichment-policy.md`).
- Rep-activity triggers always **re-write `aiNextEmail`** so the next sequence step reflects the latest activity.
