"use client";
import {
  Box, Stack, Card, CardContent, Typography, Chip, Divider, Button,
  Table, TableBody, TableCell, TableHead, TableRow,
} from "@mui/material";

/* ---------- shared visual primitives ---------- */
const KIND: Record<string, { bg: string; border: string; accent: string }> = {
  event: { bg: "#fff7ed", border: "#fb923c", accent: "#c2410c" },
  process: { bg: "#eef2ff", border: "#818cf8", accent: "#4338ca" },
  decision: { bg: "#faf5ff", border: "#c084fc", accent: "#7e22ce" },
  terminal: { bg: "#f1f5f9", border: "#94a3b8", accent: "#334155" },
  handoff: { bg: "#ecfeff", border: "#22d3ee", accent: "#0e7490" },
  scheduled: { bg: "#e2e8f0", border: "#475569", accent: "#1e293b" },
};

function FlowBox({ label, sub, kind = "process", w = 150 }: { label: string; sub?: string; kind?: string; w?: number }) {
  const s = KIND[kind] ?? KIND.process;
  return (
    <Box sx={{ flex: "0 0 auto", width: w, p: 1, borderRadius: 1.5, bgcolor: s.bg, border: `2px solid ${s.border}` }}>
      <Typography variant="caption" fontWeight={800} sx={{ color: s.accent, display: "block", lineHeight: 1.2 }}>{label}</Typography>
      {sub && <Typography variant="caption" sx={{ color: "#475569", fontSize: 10.5 }}>{sub}</Typography>}
    </Box>
  );
}
const Arrow = ({ down }: { down?: boolean }) => (
  <Box sx={{ flex: "0 0 auto", color: "#94a3b8", fontSize: 18, px: 0.25, display: "flex", alignItems: "center" }}>{down ? "↓" : "→"}</Box>
);
function FlowRow({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>{children}</Box>;
}
function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="baseline" sx={{ mb: 1.5 }}>
          <Typography variant="h6" fontWeight={800} sx={{ color: "#4f46e5" }}>{n}</Typography>
          <Typography variant="h6" fontWeight={800}>{title}</Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}
const Mono = ({ children }: { children: React.ReactNode }) => (
  <code style={{ background: "#f0f1f3", padding: "1px 5px", borderRadius: 4, fontSize: "0.85em" }}>{children}</code>
);

/* ---------- page ---------- */
export default function Documentation() {
  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h4" fontWeight={800}>Documentation</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
        How this AI context layer demo works — and the thinking behind each call.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip size="small" color="success" label="● generation, hygiene & research run through direct model calls" />
        <Chip size="small" variant="outlined" label="GTM Josh: composable CDP / Reverse ETL / warehouse-native activation" />
      </Stack>

      {/* Demo video removed during the rebrand: the old recording still shows the
          previous branding. Re-record against the current UI, then restore. */}

      {/* 1. Overview */}
      <Section n="01" title="What I built">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          SDR research eats the day, so I built an agentic workflow that ingests leads, reconciles them against
          the CRM, researches and enriches them, builds context, and drafts the <b>best next outreach step</b> —
          all in service of selling GTM Josh. A rep still reviews and sends; nothing goes out on its own. I gave
          it three surfaces:
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Card variant="outlined" sx={{ flex: "1 1 200px" }}><CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Workflow Visualizer</Typography>
            <Typography variant="caption" color="text.secondary">The live workflow as a graph. Pick an event, run a lead through, click any step to see its real output.</Typography>
          </CardContent></Card>
          <Card variant="outlined" sx={{ flex: "1 1 200px" }}><CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Try It</Typography>
            <Typography variant="caption" color="text.secondary">Upload your own CSV (or the Clay batch) and watch real contacts get researched, persona-matched, and drafted — then download the enriched CSV.</Typography>
          </CardContent></Card>
          <Card variant="outlined" sx={{ flex: "1 1 200px" }}><CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Analytics</Typography>
            <Typography variant="caption" color="text.secondary">Live reporting — AI emails generated, QA pass rate, generation time, ingestion + duplicate counts, accounts researched — all read from Postgres.</Typography>
          </CardContent></Card>
        </Stack>
      </Section>

      {/* 2. End-to-end pipeline */}
      <Section n="02" title="The pipeline, end to end">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          An <b>automated event</b> (or the nightly schedule) kicks off the workflow. I run the deterministic
          steps in code and the AI steps through direct model calls. It ends by writing the <b>AI Next Email</b>
          field; the outreach tool builds the in-sequence email from that, and a rep sends.
        </Typography>
        <FlowRow>
          <FlowBox kind="event" label="Event" sub="Gong · campaign · opp · rep · inbound" w={170} />
          <Arrow />
          <FlowBox kind="process" label="01 Research" sub="verify signals" w={120} />
          <Arrow />
          <FlowBox kind="process" label="02b Enrich" sub="provider lookup" w={120} />
        </FlowRow>
        <Box sx={{ pl: 2, my: 0.5 }}><Arrow down /></Box>
        <FlowRow>
          <FlowBox kind="decision" label="Account researched?" sub="lazy gate" w={150} />
          <Arrow />
          <FlowBox kind="process" label="03 Build Context" sub="AI Context · every run" w={150} />
          <Arrow />
          <FlowBox kind="process" label="04 Draft" sub="Opus · best next email" w={130} />
          <Arrow />
          <FlowBox kind="process" label="05 QA grade" sub="rubric check" w={120} />
        </FlowRow>
        <Box sx={{ pl: 2, my: 0.5 }}><Arrow down /></Box>
        <FlowRow>
          <FlowBox kind="terminal" label="Write AI Next Email" sub="→ contact.aiNextEmail" w={160} />
          <Arrow />
          <FlowBox kind="handoff" label="Outreach sequence" sub="builds email from the field" w={170} />
          <Arrow />
          <FlowBox kind="handoff" label="Rep reviews & sends" sub="never auto-sends" w={160} />
        </FlowRow>
        <Box sx={{ mt: 1.5, display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          {Object.entries({ event: "event source", process: "skill / process", decision: "decision", terminal: "field write / terminal", handoff: "outreach + human send" }).map(([k, v]) => (
            <Stack key={k} direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 11, height: 11, borderRadius: "3px", border: `2px solid ${KIND[k].border}` }} />
              <Typography variant="caption" color="text.secondary">{v}</Typography>
            </Stack>
          ))}
        </Box>
      </Section>

      {/* 3. Two paths */}
      <Section n="03" title="Two entry paths, one generation core">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Existing contacts go straight to research. New leads from Clay get staged and run through the hygiene
          gate first; the survivors then join the same core. I wanted one generation engine, two ways in.
        </Typography>
        <Typography variant="overline" color="text.secondary">Existing contact</Typography>
        <FlowRow>
          <FlowBox kind="event" label="Event trigger" w={130} />
          <Arrow />
          <FlowBox kind="process" label="Research → Enrich → Context → Draft → QA" w={300} />
          <Arrow />
          <FlowBox kind="terminal" label="AI Next Email" w={120} />
        </FlowRow>
        <Box sx={{ my: 1.5 }}><Divider /></Box>
        <Typography variant="overline" color="text.secondary">New lead (Clay)</Typography>
        <FlowRow>
          <FlowBox kind="event" label="Clay discovery" w={120} />
          <Arrow />
          <FlowBox kind="process" label="Ingest → staged" w={120} />
          <Arrow />
          <FlowBox kind="decision" label="02a Hygiene gate" sub="exact → fuzzy → AI" w={150} />
          <Arrow />
          <FlowBox kind="process" label="survivors → core" sub="merge / review / create" w={150} />
        </FlowRow>
      </Section>

      {/* 4. Four layers */}
      <Section n="04" title="Logic lives in git — the four layers">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          The workflow code stays thin on purpose. Every bit of knowledge, decision logic, and prompt lives in
          the repo, mirroring the way the context layer itself should work. My rule of thumb: the runtime should
          execute the rules, not become the place where the rules secretly live.
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {[
            { t: "context/", d: "reusable knowledge", items: "icp · brand-voice · messaging-pillars · persona-rubrics · sequence-definitions · enrichment-policy · source-allowlist · measurement-spec · field-glossary" },
            { t: "coordination/", d: "decision logic", items: "triggers · hygiene-rules · handoffs · qa-rubric" },
            { t: "execution/", d: "the ordered skills + the full prompts", items: "01-research · 02a-hygiene · 02b-enrich · 03-build-context · 04-draft-email · 05-qa-grade" },
            { t: "memory/", d: "run state + fallbacks", items: "last-run-state · reply-performance · account-research fallbacks" },
          ].map((l) => (
            <Card key={l.t} variant="outlined" sx={{ flex: "1 1 230px", borderColor: "#818cf8" }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={800} sx={{ color: "#4338ca" }}><Mono>{l.t}</Mono></Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>{l.d}</Typography>
                <Typography variant="caption" sx={{ fontSize: 10.5 }}>{l.items}</Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Section>

      {/* 5. Triggers */}
      <Section n="05" title="Triggers — automated events, not human clicks">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          In production these fire from real webhooks and a scheduled job. I made the rep-activity triggers re-write
          the AI Next Email so the next sequence step always reflects the latest activity.
        </Typography>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Trigger</TableCell><TableCell>Path</TableCell><TableCell>Eligible</TableCell><TableCell>What it does</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {[
              ["New Gong call", "existing", "any", "draft references the call"],
              ["Campaign touch", "existing", "any except Suspect", "writes a real touch, then drafts on that topic"],
              ["Opp stage changed", "existing", "on an opp (Pipeline)", "matches the conversation to the new stage"],
              ["Opp next-step updated", "existing", "on an opp (Pipeline)", "drives the new step (uses next-step history)"],
              ["Inbound form", "existing", "Marketing Engaged, MQL", "fast light-qualify draft"],
              ["Rep called / sent / connected", "existing", "engaged+", "refresh AI Context + a fresh follow-up email"],
              ["Clay found contacts", "new lead", "the batch", "ingest + hygiene the whole found set"],
              ["Nightly batch (scheduled)", "scheduled", "cron job", "sweep stale-research accounts + new leads"],
            ].map((r, i) => (
              <TableRow key={i}>
                <TableCell><b>{r[0]}</b></TableCell>
                <TableCell><Chip size="small" variant="outlined" label={r[1]} sx={{ height: 18 }} /></TableCell>
                <TableCell sx={{ fontSize: 12 }}>{r[2]}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{r[3]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      {/* 6. Skills + model map */}
      <Section n="06" title="The ordered skills & model map">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          I lean on AI where context and language create leverage, and stay deterministic where trust and
          auditability matter. Each skill has an input/output contract; the heavier prompts are committed in full
          under <Mono>execution/</Mono>.
        </Typography>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Skill</TableCell><TableCell>Model</TableCell><TableCell>Role</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {[
              ["01 Research", "Sonnet 4.6", "verify CRM signals, cite sources, abstain when thin"],
              ["02a Hygiene", "Sonnet 4.6 (fuzzy tier only)", "adjudicate ambiguous dup matches — bias to review"],
              ["02b Enrich", "deterministic (no LLM)", "provider lookup; before/after field deltas, source-tagged"],
              ["Account Research", "Sonnet 4.6 + web search", "lazy: research an account once if not populated"],
              ["03 Build Context", "Sonnet 4.6", "the AI Context object — refreshed every run"],
              ["04 Draft", "Opus 4.8", "the rep-facing email; prose quality shows here"],
              ["05 QA grade", "Sonnet 4.6", "grade against the rubric; fail → revise once → human"],
            ].map((r, i) => (
              <TableRow key={i}>
                <TableCell><b>{r[0]}</b></TableCell>
                <TableCell><Chip size="small" color={r[1].startsWith("Opus") ? "secondary" : r[1].startsWith("deterministic") ? "default" : "primary"} variant="outlined" label={r[1]} sx={{ height: 18 }} /></TableCell>
                <TableCell sx={{ fontSize: 12 }}>{r[2]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      {/* 7. Claude skills & prompts */}
      <Section n="07" title="Claude skills & the prompts I built">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          I wrote each step as a small, single-responsibility <b>Claude skill</b> with an explicit input/output
          contract — the same idea as Claude Agent Skills, so the model only ever sees the one job in front of it.
          The three I scrutinized most (context, draft, hygiene) are committed as full prompts under{" "}
          <Mono>execution/*/PROMPT.md</Mono>; the rest are contract docs (<Mono>SKILL.md</Mono>) the runner fills in.
        </Typography>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Skill</TableCell><TableCell>Files</TableCell><TableCell>What I prompted it to do</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {[
              ["01 Research", "SKILL", "verify each CRM signal, cite the source, and abstain when the evidence is thin"],
              ["02a Hygiene", "SKILL + PROMPT", "adjudicate only the ambiguous dup band; bias to “review”, never a wrong merge"],
              ["02b Enrich", "SKILL (no LLM)", "deterministic provider lookup with before/after field deltas"],
              ["03 Build Context", "SKILL + PROMPT", "turn the record into the AI Context object — briefing, signals, recommended next step"],
              ["04 Draft Email", "SKILL + PROMPT", "the rep-facing email — clean prose, one CTA, sources in a citations array"],
              ["05 QA Grade", "SKILL + PROMPT", "grade the draft against the rubric; fail → one revise → human"],
              ["Account Research", "PROMPT (web)", "a sourced brief in ≤2 searches; never invent the data stack"],
            ].map((r, i) => (
              <TableRow key={i}>
                <TableCell><b>{r[0]}</b></TableCell>
                <TableCell><Chip size="small" variant="outlined" label={r[1]} sx={{ height: 18 }} /></TableCell>
                <TableCell sx={{ fontSize: 12 }}>{r[2]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2, mb: 0.5 }}>Prompt techniques I leaned on</Typography>
        <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
          {[
            <><b>System / User split</b> in every <Mono>PROMPT.md</Mono>, parsed by the app and sent to the model runtime verbatim.</>,
            <><b>The grounding rule</b> — every personalized line must trace to a real signal or an approved pillar; sources go in a <Mono>citations</Mono> array, never inline, so the body stays clean and QA can verify it.</>,
            <><b>Relevance-slicing the draft</b> — instead of the whole knowledge base, the draft prompt injects only the contact’s persona row, the candidate pillars for that persona, and the trigger overlay (~60% smaller, sharper).</>,
            <><b>Chaining in the runtime</b> — the app appends 03’s output into 04, and 04 + 03 into 05, so each step builds on the last.</>,
            <><b>Anti-hallucination on research</b> — sourced-only, ≤2 web searches, JSON-only, and “say ‘your warehouse’ if you can’t confirm the stack” (this is what stopped it inventing a Snowflake partnership).</>,
            <><b>Deterministic where I could</b> — persona and the persona-specific pain points come from a code map (<Mono>lib/persona.ts</Mono>), not an extra LLM call.</>,
          ].map((li, i) => <li key={i}><Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{li}</Typography></li>)}
        </Box>
      </Section>

      {/* 8. Runtime */}
      <Section n="08" title="The app runtime is the runner">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Every model call goes through a small helper in <Mono>lib/llm.ts</Mono>. The important part is that the
          prompts and rules still live in git. The runtime just loads the right context, calls the model, chains
          the outputs, and persists the result.
        </Typography>
        <FlowRow>
          <FlowBox kind="terminal" label="App (BFF)" sub="renders prompts · persists" w={140} />
          <Arrow />
          <FlowBox kind="process" label="Model runtime" sub="calls Anthropic" w={130} />
          <Arrow />
          <FlowBox kind="event" label="Claude" sub="Opus / Sonnet" w={130} />
          <Arrow />
          <FlowBox kind="process" label="Runtime chains" sub="03 → 04 → 05" w={130} />
          <Arrow />
          <FlowBox kind="terminal" label="App renders" w={120} />
        </FlowRow>
        <Box sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Card variant="outlined" sx={{ flex: "1 1 320px" }}><CardContent sx={{ py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>Workflow visualizer <Chip size="small" color="success" label="executor" sx={{ height: 18, ml: 0.5 }} /></Typography>
              <Typography variant="caption" color="text.secondary">Automated event → route → full pipeline + hygiene branch. The existing-contact path runs through it; the runtime chains 03→04→05 and the UI lights up each step.</Typography>
            </CardContent></Card>
            <Card variant="outlined" sx={{ flex: "1 1 320px" }}><CardContent sx={{ py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>Generation helper</Typography>
              <Typography variant="caption" color="text.secondary">A reusable direct Anthropic call. I use it for hygiene adjudication, account research, context generation, drafting, and QA.</Typography>
            </CardContent></Card>
          </Stack>
        </Box>
      </Section>

      {/* 9. Hygiene gate */}
      <Section n="09" title="The hygiene gate — deterministic, then AI">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          I reconcile a staged inbound before it ever reaches a rep. Exact and clear cases get decided in code;
          the LLM only sees genuine ambiguity, and I told it to <b>bias to review — never a wrong merge.</b>
        </Typography>
        <FlowRow>
          <FlowBox kind="process" label="Exact email" sub="deterministic · no LLM" w={140} />
          <Arrow />
          <FlowBox kind="process" label="Fuzzy score" sub="name+title+email, code" w={150} />
          <Arrow />
          <FlowBox kind="decision" label="AI adjudicate" sub="ambiguous band only" w={140} />
          <Arrow />
          <FlowBox kind="terminal" label="merge | review | create" sub="writes HygieneEvent" w={170} />
        </FlowRow>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          On the seeded set: 2 exact-merges, 2 fuzzy→AI merges (Marc↔Marcus, Jess↔Jessica at ~91–93%), 2 net-new
          — which is what lights up the Analytics duplicate rate.
        </Typography>
      </Section>

      {/* 10. Source attribution + account research */}
      <Section n="10" title="Grounding: source attribution & lazy research">
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Card variant="outlined" sx={{ flex: "1 1 320px" }}><CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Source attribution</Typography>
            <Typography variant="caption" color="text.secondary">
              Every personalized claim has to trace to a real signal (CRM, enrichment, research, opp, engagement)
              or an approved pillar. I keep the email body clean and put attribution in a <Mono>citations</Mono> list
              the UI shows as chips and QA verifies — which answers the hallucination and rep-trust concerns at once.
            </Typography>
          </CardContent></Card>
          <Card variant="outlined" sx={{ flex: "1 1 320px" }}><CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Account Research (lazy)</Typography>
            <Typography variant="caption" color="text.secondary">
              I split it: <Mono>accountResearch</Mono> (deep, web-sourced, runs once if empty) vs{" "}
              <Mono>accountAiContext</Mono> (refreshed every run). A research-empty account gets researched on its
              first run, then cached; a committed fallback covers a live failure.
            </Typography>
          </CardContent></Card>
        </Stack>
      </Section>

      {/* 11. Measurement */}
      <Section n="11" title="Measurement — proving it works">
        <Typography variant="body2" sx={{ mb: 1 }}>
          The Analytics tab reads live from Postgres (<Mono>Run</Mono>, <Mono>HygieneEvent</Mono>, <Mono>Account</Mono>).
          I measure AI emails generated, QA pass rate, avg generation time, ingestion + duplicate counts, and
          accounts researched. The baseline → pilot → target story lives in <Mono>context/measurement-spec.md</Mono>:
          ~10–15 min of SDR research per contact replaced by a sub-minute draft a rep reviews instead of authors.
        </Typography>
      </Section>

      {/* 12. Tech stack */}
      <Section n="12" title="Tech stack & why I picked it">
        <Table size="small">
          <TableBody>
            {[
              ["Next API routes", "Workflow runner. Loads prompts, calls the model runtime, chains 03→04→05, writes the result, and streams progress to the visualizer."],
              ["Claude", "Opus 4.8 (draft), Sonnet 4.6 (context / QA / hygiene / research + web search). Best prose where it shows; strong reasoning everywhere else."],
              ["Next.js + MUI + React Flow", "The UI (Visualizer + Try It + Analytics + this page). A thin BFF + orchestrator that holds the four layers and calls the model runtime."],
              ["Postgres + Prisma (Railway)", "The CRM. Same engine dev & prod; I control the schema (status/source/merge, Run, HygieneEvent, opp next-step history, AI Next Email, account research)."],
              ["Provider-agnostic enrichment", "Mock CSV today, Clay / LinkedAPI tomorrow — same interface."],
            ].map((r, i) => (
              <TableRow key={i}>
                <TableCell sx={{ width: 220, verticalAlign: "top" }}><b>{r[0]}</b></TableCell>
                <TableCell sx={{ fontSize: 12 }}>{r[1]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      {/* 13. Demo + phases */}
      <Section n="13" title="Try it · phases">
        <Typography variant="body2" sx={{ mb: 1 }}>
          <b>Demo path:</b> <Mono>Workflow Visualizer</Mono> → <i>Opp stage changed</i> → a Pipeline lead → <b>Run</b> →
          click <b>04 Draft</b> for the live, clean, source-attributed email. Then <i>Clay found contacts</i> for the
          hygiene gate, and the <Mono>Try It</Mono> tab to run your own contacts through live web research. Analytics updates as you go.
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          <Chip color="success" variant="outlined" label="Phase 1 — Demo harness ✓" />
          <Chip color="success" variant="outlined" label="Phase 2 — Live via direct model calls ✓" />
          <Chip color="success" variant="outlined" label="Phase 3 — Deployed to Railway ✓" />
        </Stack>
      </Section>

      {/* 14. Rep enablement */}
      <Section n="14" title="Why reps will trust it — and actually use it">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          The fastest way to kill a tool like this is for reps to feel it&apos;s writing over them. It isn&apos;t — it
          hands them a running start. They were going to send these emails anyway; this just turns the blank page
          into a strong, grounded first draft instead of a generic template they&apos;d have to rewrite.
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Card variant="outlined" sx={{ flex: "1 1 280px" }}><CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Still the human in the loop</Typography>
            <Typography variant="caption" color="text.secondary">Nothing sends on its own. The rep reviews, tweaks, and hits send — exactly like today. The only change is they start from a draft grounded in real truth (the account, the opp, the latest activity), not boilerplate.</Typography>
          </CardContent></Card>
          <Card variant="outlined" sx={{ flex: "1 1 280px" }}><CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>No more being the “living integration”</Typography>
            <Typography variant="caption" color="text.secondary">Good outreach today means a rep manually stitching account research, recent activity, the opp&apos;s next step, and persona into one coherent angle — every single time. The workflow does that synthesis for them, so they&apos;re not the integration layer between five tabs.</Typography>
          </CardContent></Card>
          <Card variant="outlined" sx={{ flex: "1 1 280px" }}><CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Less work, same ownership</Typography>
            <Typography variant="caption" color="text.secondary">It runs in the background, so a rep does nothing to get a ready-to-review draft waiting for them. They keep full control over what goes out — just with the busywork removed and far less time spent per send.</Typography>
          </CardContent></Card>
        </Stack>
      </Section>

      {/* 15. What I'd change with more time */}
      <Section n="15" title="What I'd change with more time">
        <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
          {[
            <>Flesh out the prompts further — <b>especially per individual trigger-case</b>. Each trigger (Gong call, opp next-step, rep follow-up, inbound) deserves its own tuned framing rather than sharing one drafting prompt.</>,
            <>Build a <b>dedicated error path across each workflow step</b>, so it's far easier to diagnose exactly when and why something broke instead of falling back silently.</>,
            <>Token usage is higher than I'd like. I'd experiment with a <b>cheaper model (e.g. Haiku) for context generation and/or the web-search</b> step to see whether I can hit similar email quality at a lower cost.</>,
            <>Close the loop on outcomes: <b>integrate real email performance from the sequencing platform</b>, log which emails actually perform, and feed that back to shape the prompt system itself.</>,
          ].map((li, i) => <li key={i}><Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>{li}</Typography></li>)}
        </Box>
      </Section>

      {/* 16. How long did this take */}
      <Section n="16" title="How long did this take?">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          In total — including building <i>and</i> deploying this web app — I have about <b>4 hours</b> in the
          project. In a real production environment I wouldn't need to build a web app and sample data just to
          give myself a working place to operate, so I split the work into two distinct phases:
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          <Card variant="outlined" sx={{ flex: "1 1 300px" }}><CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Phase 1 — the environment <Chip size="small" variant="outlined" label="~2 hrs" sx={{ height: 18, ml: 0.5 }} /></Typography>
            <Typography variant="caption" color="text.secondary">Built the web app and most of the scaffolding for visualizing the workflow — the tangible environment to demonstrate the flow in action.</Typography>
          </CardContent></Card>
          <Card variant="outlined" sx={{ flex: "1 1 300px" }}><CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Phase 2 — the workflow <Chip size="small" variant="outlined" label="~2 hrs" sx={{ height: 18, ml: 0.5 }} /></Typography>
            <Typography variant="caption" color="text.secondary">Building the actual workflow, the four-layer prompts/skills, and testing it end to end.</Typography>
          </CardContent></Card>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          That's how I landed at ~4 hours rather than the allotted 3. Since so much of Phase 1 went toward
          giving myself a tangible environment to build and demo in — work I wouldn't repeat in production — I
          elected not to count it against the time allotment.
        </Typography>
      </Section>

      {/* 17. Links */}
      <Section n="17" title="Links">
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button variant="contained" size="small" disableElevation href="/workflow">
            Open the live app ↗
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          Full detail lives in{" "}
          <Mono>README.md</Mono>, the four layers, <Mono>execution/*/PROMPT.md</Mono>, <Mono>orchestration/</Mono>, and the session logs.
        </Typography>
      </Section>
    </Box>
  );
}
