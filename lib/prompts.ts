// Loads the four-layer knowledge files + execution prompt files from the repo and renders the per-step
// prompts sent to the model runtime. Prompts/logic stay in git.
//
// The DRAFT prompt is relevance-sliced: instead of the whole knowledge base it injects only what applies to
// THIS contact (brand voice + the persona's row + seniority + the candidate pillars + the trigger overlay).
// Each builder also returns a structured `display` (instructions + reference sections) so the Visualizer can
// show the core prompt and collapse each reference "layer" into an expandable bubble.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GenInput } from "./llm";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

export interface PromptRef { title: string; body: string }
export interface BuiltPrompt extends GenInput {
  display: { instructions: string; references: PromptRef[] };
}

function splitPrompt(file: string): { system: string; user: string } {
  const txt = read(file);
  const si = txt.indexOf("## SYSTEM");
  const ui = txt.indexOf("## USER");
  if (si < 0 || ui < 0) throw new Error(`prompt ${file} missing SYSTEM/USER sections`);
  return { system: txt.slice(si + 9, ui).trim(), user: txt.slice(ui + 7).trim() };
}

const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : ""));

// Flat reference text appended after the instructions.
const appended = (...files: string[]) =>
  "\n\n---\n# REFERENCE\n\n" + files.map(read).join("\n\n---\n\n");

// Builds the flat system (instructions + references) for the runtime AND the structured display for the UI.
function buildGen(o: {
  model: string; instructions: string; user: string; references: PromptRef[];
  maxTokens?: number; webSearch?: boolean;
}): BuiltPrompt {
  const refText = o.references.length
    ? "\n\n# REFERENCE\n\n" + o.references.map((r) => `## ${r.title}\n\n${r.body}`).join("\n\n---\n\n")
    : "";
  return {
    model: o.model,
    system: o.instructions + refText,
    user: o.user,
    maxTokens: o.maxTokens,
    webSearch: o.webSearch,
    display: { instructions: o.instructions, references: o.references },
  };
}

/* ---------- builders ---------- */

// 03-build-context — Sonnet 4.6
export function contextPrompt(vars: { triggerLabel: string; record: string; research: string }): BuiltPrompt {
  const { system, user } = splitPrompt("execution/03-build-context/PROMPT.md");
  return buildGen({
    model: "claude-sonnet-4-6",
    instructions: system,
    user: fill(user, vars),
    references: [
      { title: "Field glossary", body: read("context/field-glossary.json") },
      { title: "Sequence definitions", body: read("context/sequence-definitions.md") },
    ],
    maxTokens: 1800,
  });
}

// 04-draft-email (Orchestration) — Opus 4.8. Minimal: NO reference templates attached — the model writes its
// own email from the live 03 AI Context the orchestrator appends.
export function draftPromptOrch(): BuiltPrompt {
  const { system, user } = splitPrompt("execution/04-draft-email/PROMPT.md");
  return buildGen({ model: "claude-opus-4-8", instructions: system, user, references: [], maxTokens: 700 });
}

// 05-qa-grade (Orchestration) — Sonnet 4.6. Keeps the FULL pillar list (to validate any cited pillar).
export function qaPromptOrch(): BuiltPrompt {
  const { system } = splitPrompt("execution/05-qa-grade/PROMPT.md");
  return buildGen({
    model: "claude-sonnet-4-6",
    instructions: system,
    user: `Grade the draft appended below against the rubric, using the AI Context appended below. Return only the JSON object.`,
    references: [
      { title: "QA rubric", body: read("coordination/qa-rubric.md") },
      { title: "Messaging pillars (for citation validation)", body: read("context/messaging-pillars.md") },
    ],
    maxTokens: 500,
  });
}

// 02a-hygiene adjudication (Tier 3) — Sonnet 4.6 (Generation Runner path; not shown in the prompt popup).
export function hygienePrompt(vars: { staged: string; candidates: string; ambiguityNote: string }): GenInput {
  const { system, user } = splitPrompt("execution/02a-hygiene/PROMPT.md");
  return {
    model: "claude-sonnet-4-6",
    system: system + appended("coordination/hygiene-rules.md"),
    user: fill(user, vars),
    maxTokens: 400,
  };
}

// Account Research agent — Sonnet 4.6 + web search.
export function accountResearchPrompt(vars: { account: string }): GenInput {
  const system =
    "You are an account research agent for GTM Josh (composable CDP / Reverse ETL / warehouse-native " +
    "data activation). Research the company on the public web and produce a concise, decision-useful brief " +
    "for an SDR.\n\n" +
    "GROUNDING (non-negotiable): assert ONLY facts you actually found in a public source. NEVER guess or " +
    "invent specifics. In particular, do NOT name a data warehouse (Snowflake, BigQuery, Databricks, " +
    "Redshift), a vendor partnership, a customer, a funding figure, or a headcount unless a source explicitly " +
    "confirms it for THIS company — if unconfirmed, say 'their data warehouse' generically or omit it. Any " +
    "ICP-fit reasoning that isn't sourced must be prefixed 'Inferred:'. A shorter, honest brief beats a " +
    "specific wrong one.\n" +
    "Focus on: what they actually do, real why-now signals (funding, hiring, launches, leadership), the " +
    "GTM Josh activation use case, likely personas, and risks.\n" +
    "SEARCH BUDGET: use AT MOST 2 web searches (the company's own site/blog, plus one funding/news source), " +
    "then write the brief from what you found. Do not keep searching — extra searches cost money for little gain.\n\n" +
    "OUTPUT strictly valid JSON, nothing else:\n" +
    '{ "accountResearch": "150-220 word narrative", "accountAiContext": "1-2 sentence current-state", "sources": ["url or outlet", ...] }\n' +
    appended("context/icp.md", "context/source-allowlist.md");
  const user =
    `Research this account and return the JSON.\n\nAccount:\n${vars.account}\n\n` +
    `Output ONLY the JSON object — start your response with "{". No preamble, no "here is the JSON", no markdown fences.`;
  return { model: "claude-sonnet-4-6", system, user, maxTokens: 1400, webSearch: true };
}
