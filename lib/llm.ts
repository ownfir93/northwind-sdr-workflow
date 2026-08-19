// Direct model runtime for the demo. This keeps the same prompt contracts but calls Anthropic
// from the Next API routes.
// If no Anthropic key is present or a call fails, callers keep their deterministic fallback.

const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const TIMEOUT_MS = 60000;
const ORCH_TIMEOUT_MS = 90000;

export interface GenInput {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  webSearch?: boolean;
}

export interface OrchestrateInput {
  context: GenInput;
  draft: GenInput;
  qa: GenInput;
}

export function llmConfigured(): boolean {
  return !!API_KEY;
}

export function orchestrateConfigured(): boolean {
  return llmConfigured();
}

export async function orchestrateExisting(prompts: OrchestrateInput): Promise<{ context: any; draft: any; qa: any }> {
  if (!API_KEY) throw new Error("ANTHROPIC_API_KEY or ANTHROPIC_KEY not set");

  return withTimeout(ORCH_TIMEOUT_MS, async () => {
    const context = await generateJson(prompts.context);
    const draft = await generateJson({
      ...prompts.draft,
      user:
        `${prompts.draft.user}\n\n` +
        `# AI Context\n\n${JSON.stringify(context, null, 2)}`,
    });
    const qa = await generateJson({
      ...prompts.qa,
      user:
        `${prompts.qa.user}\n\n` +
        `# AI Context\n\n${JSON.stringify(context, null, 2)}\n\n` +
        `# Draft\n\n${JSON.stringify(draft, null, 2)}`,
    });

    return { context, draft, qa };
  });
}

export async function generate({ model, system, user, maxTokens = 1500 }: GenInput): Promise<string> {
  if (!API_KEY) throw new Error("ANTHROPIC_API_KEY or ANTHROPIC_KEY not set");

  return withTimeout(TIMEOUT_MS, async (signal) => {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: resolveModel(model),
        system,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: user }],
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 200)}`);
    }

    return extractText(await res.json());
  });
}

export async function generateJson<T = any>(input: GenInput): Promise<T> {
  return parseJsonLoose(await generate(input)) as T;
}

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

function resolveModel(model: string): string {
  if (/opus/i.test(model)) return process.env.ANTHROPIC_DRAFT_MODEL || model;
  return process.env.ANTHROPIC_CONTEXT_MODEL || model;
}

function extractText(data: any): string {
  if (data == null) throw new Error("empty Anthropic response");
  if (typeof data === "string") return data.trim();
  if (Array.isArray(data?.content)) {
    return data.content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => c.text)
      .join("")
      .trim();
  }
  if (typeof data?.content === "string") return data.content.trim();
  if (typeof data?.text === "string") return data.text.trim();
  throw new Error("no text in Anthropic response");
}

function parseJsonLoose(s: string): any {
  const cleaned = s.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(cleaned.slice(a, b + 1));
    throw new Error("Anthropic response was not JSON: " + cleaned.slice(0, 200));
  }
}
