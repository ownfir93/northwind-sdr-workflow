# 01-research

**Model:** Sonnet 4.6 · **Path:** both · **Calls Claude via app runtime:** yes (existing accounts: verify; new web research lives in the Account Research agent)

## Purpose
Verify the signals we'll ground the email in, and abstain when data is thin. For an already-researched
account this is a fast CRM-signal verification; net-new web discovery is handled by the gated Account
Research agent (see `../../coordination/triggers.md`).

## Input
```
{ account, contact, opportunity?, campaignMembers[] }
```

## Output
```
{ signals: [ { claim, sourceClass, sourceRef } ], thin: boolean }
```
- `sourceClass` ∈ `source-allowlist.md` (crm | enrichment | public-web | press | profile).
- `thin: true` when there is no recent activity, no opp, and sparse fields — tells downstream to write a
  shorter, more general email.

## Rules
- Only cite from `context/source-allowlist.md`. Every signal carries a source.
- Do not invent specifics. If a likely fact can't be sourced, omit it or mark it a hypothesis.
- Prefer the freshest, most action-relevant signals (recent role change, opp movement, recent campaign touch).

## Edge cases
- No campaign touches + no opp + sparse contact → `thin: true`, return only the account-level signal.
- Conflicting CRM vs enrichment → surface both, let `03-build-context` resolve per `enrichment-policy.md`.
