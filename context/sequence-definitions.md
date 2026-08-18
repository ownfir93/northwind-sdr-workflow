# Sequence definitions — the outreach steps "best next step" maps to

The draft maps to a sequence step from the contact's lifecycle **Stage** (and the trigger). `03-build-context`
emits the recommended step; `04-draft-email` writes for it. Mirrors `lib/stages.ts` (`STAGE_SEQUENCE`).

## Stage → step
| Stage | Sequence step | Intent |
|---|---|---|
| Suspect | Awareness — value-led intro | cold; one insight, soft CTA, no ask beyond a reply |
| Marketing Engaged | Education — share a proof point | reinforce the topic they engaged with; light CTA |
| MQL | Qualify — connect the signal to a use case | tie their signal to a concrete activation use case; offer a call |
| Working | Active — book a technical deep-dive | advance with a specific meeting + agenda |
| Pipeline | Opportunity — multithread to the economic buyer | align on business value + timing; reference the opp |
| Closed Won | Expand — adjacent team / use case | expansion + referral, not net-new pitch |
| Nurture | Re-engage — low-touch check-in | low pressure, tied to a fresh trigger |
| Disqualified | Hold — no outreach | suppress |

## Trigger overlays (the trigger refines the step)
- **opp_stage_changed / opp_next_step**: stay on the opp; reference the stage move or the new next step.
- **rep_sent_email / rep_called / rep_connected**: this is a **follow-up in an active sequence**, not a fresh
  intro — write the next-in-cadence message (reference the prior touch).
- **campaign_touch**: reinforce the exact asset/topic they just engaged with.
- **new_gong_call**: reference what was discussed on the call.
- **inbound_form**: fast, light-qualify response.
- **new_lead (Clay)**: cold first touch; establish relevance fast.

## Cadence note (for README/measurement)
Output is the **AI Next Email** field on the contact; the outreach tool builds the in-sequence email from it
and a rep reviews & sends. The workflow never advances or sends the sequence itself.
