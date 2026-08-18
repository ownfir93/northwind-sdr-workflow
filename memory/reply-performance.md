# Reply performance — past reply rates feeding personalization

Lightweight memory the draft can use to lean into what's working. In the demo these are illustrative
baselines; in production they'd be computed from sent + reply data and fed back into `04-draft-email` and the
measurement story.

## By persona (reply rate on grounded drafts)
| Persona | Reply rate | Note |
|---|---|---|
| Technical Buyer (Data Platform / Analytics Eng) | ~9% | responds best to reverse-ETL / governance angle, short + specific |
| Champion (Lifecycle / Demand Gen) | ~12% | "stop rebuilding lists by hand" lands; make them the hero |
| Economic Buyer (VP Growth / Marketing) | ~7% | needs a metric + scoped pilot, not a platform pitch |
| Influencer (Analyst / PM) | ~6% | lower; route value through how their work reaches tools |

## By opener type
- **Recent role change** opener: highest reply lift — always use when present and genuine.
- **Opp next-step / stage move** reference: strong on Pipeline contacts.
- **Campaign-touch topic** reference: solid when the touch is recent and specific.
- Generic value-prop opener (no signal): lowest — only when data is thin.

## Lessons (applied by the draft + QA)
- One grounded specific beats three generic value props.
- Follow-ups (rep-activity triggers) outperform fresh intros on already-engaged contacts — keep them short.
- Drafts with an invented specific that a prospect catches damage trust more than a plain email — hence the
  hard grounding rule.
