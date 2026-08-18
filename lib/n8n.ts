// Calls the n8n Cloud "generation runner" webhook (Webhook → Claude → Respond). The Anthropic credential
// and the LLM call live INSIDE n8n; the app holds no LLM SDK. Every Claude call goes through this.
// Returns the completion text, or throws — callers fall back to the deterministic templated path.

const URL = process.env.N8N_GENERATE_URL;
const ORCH_URL = process.env.N8N_ORCHESTRATE_URL;
const TIMEOUT_MS = 60000; // web-search research can run 30–50s, esp. under concurrent upload runs
const ORCH_TIMEOUT_MS = 90000;

export interface GenInput {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  webSearch?: boolean;
}

export function n8nConfigured(): boolean {
  return !!URL;
}

export function orchestrateConfigured(): boolean {
  return !!ORCH_URL;
}

export interface OrchestrateInput {
  context: GenInput;
  draft: GenInput;
  qa: GenInput;
}

// Drives the full Orchestration workflow (Switch → 03 → 04 → 05) in one call. n8n chains the nodes:
// 04 appends 03's output, 05 appends 04's. Returns the parsed JSON for each step.
export async function orchestrateExisting(prompts: OrchestrateInput): Promise<{ context: any; draft: any; qa: any }> {
  if (!ORCH_URL) throw new Error("N8N_ORCHESTRATE_URL not set");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ORCH_TIMEOUT_MS);
  // Send only the fields n8n reads — drop any `display` breakdown the builders attached for the UI.
  const lean = (p: GenInput) => ({ model: p.model, system: p.system, user: p.user, maxTokens: p.maxTokens, webSearch: p.webSearch });
  try {
    const res = await fetch(ORCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "existing", prompts: { context: lean(prompts.context), draft: lean(prompts.draft), qa: lean(prompts.qa) } }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`n8n orchestrate ${res.status}`);
    const data = await res.json();
    // Parse each step independently — a truncated/malformed one (e.g. a long context) must not sink the
    // draft. Returns null for any step that didn't parse; the caller keeps its templated value for that step.
    return {
      context: parseJsonSafe(safeText(data.context)),
      draft: parseJsonSafe(safeText(data.draft)),
      qa: parseJsonSafe(safeText(data.qa)),
    };
  } finally {
    clearTimeout(t);
  }
}

function safeText(o: any): string {
  try { return extractText(o); } catch { return ""; }
}
function parseJsonSafe(s: string): any | null {
  if (!s) return null;
  try { return parseJsonLoose(s); } catch { return null; }
}

export async function generate({ model, system, user, maxTokens = 1500, webSearch = false }: GenInput): Promise<string> {
  if (!URL) throw new Error("N8N_GENERATE_URL not set");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, system, user, maxTokens, webSearch }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`n8n webhook ${res.status}`);
    return extractText(await res.json());
  } finally {
    clearTimeout(t);
  }
}

export async function generateJson<T = any>(input: GenInput): Promise<T> {
  return parseJsonLoose(await generate(input)) as T;
}

// The n8n runner returns the raw Anthropic Messages response: { content: [{type:'text', text}], ... }.
// Be defensive about shape (n8n can wrap items in arrays / {json}).
function extractText(data: any): string {
  if (data == null) throw new Error("empty n8n response");
  if (typeof data === "string") return data.trim();
  if (Array.isArray(data?.content)) {
    return data.content.filter((c: any) => c?.type === "text").map((c: any) => c.text).join("").trim();
  }
  if (typeof data?.content === "string") return data.content.trim();
  if (typeof data?.text === "string") return data.text.trim();
  if (Array.isArray(data) && data.length) return extractText(data[0]?.json ?? data[0]);
  if (data?.json) return extractText(data.json);
  throw new Error("no text in n8n response");
}

function parseJsonLoose(s: string): any {
  const cleaned = s.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(cleaned.slice(a, b + 1));
    throw new Error("n8n response was not JSON: " + cleaned.slice(0, 200));
  }
}
