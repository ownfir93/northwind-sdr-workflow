// Account Research agent (lazy). Populates accountResearch + accountAiContext + researchedAt for a
// research-empty account via the model runtime. Falls back to the committed outputs in
// memory/account-research/fallbacks.json if the live call fails — the demo never bricks.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { generateJson, llmConfigured } from "@/lib/llm";
import { accountResearchPrompt } from "@/lib/prompts";

export type ResearchSource = "cached" | "live" | "fallback" | "unavailable";

interface AcctLite {
  id: string; name: string; industry: string | null; employeeSize: string | null;
  location: string | null; dataStack: string | null; signalNotes: string | null;
  accountResearch: string | null; accountAiContext: string | null; researchedAt: Date | null;
}

function loadFallback(accountId: string): { accountResearch: string; accountAiContext: string } | null {
  try {
    const all = JSON.parse(readFileSync(join(process.cwd(), "memory", "account-research", "fallbacks.json"), "utf8"));
    const f = all[accountId];
    return f ? { accountResearch: f.accountResearch, accountAiContext: f.accountAiContext } : null;
  } catch {
    return null;
  }
}

// Returns the (possibly newly) researched account + which source produced it.
export async function ensureAccountResearched(acct: AcctLite): Promise<{ source: ResearchSource; accountResearch: string | null; accountAiContext: string | null; researchedAt: Date }> {
  if (acct.researchedAt) {
    return { source: "cached", accountResearch: acct.accountResearch, accountAiContext: acct.accountAiContext, researchedAt: acct.researchedAt };
  }

  let accountResearch: string | null = null;
  let accountAiContext: string | null = null;
  let source: ResearchSource = "unavailable";

  if (llmConfigured()) {
    try {
      const r = await generateJson<any>(accountResearchPrompt({
        account: JSON.stringify({
          name: acct.name, industry: acct.industry, employeeSize: acct.employeeSize,
          location: acct.location, dataStack: acct.dataStack, signalNotes: acct.signalNotes,
        }),
      }));
      if (r?.accountResearch) {
        accountResearch = String(r.accountResearch);
        accountAiContext = r.accountAiContext ? String(r.accountAiContext) : null;
        source = "live";
      }
    } catch { /* fall through to fallback */ }
  }

  if (!accountResearch) {
    const fb = loadFallback(acct.id);
    if (fb) {
      accountResearch = fb.accountResearch;
      accountAiContext = fb.accountAiContext;
      source = "fallback";
    }
  }

  const researchedAt = new Date();
  if (accountResearch) {
    await prisma.account.update({
      where: { id: acct.id },
      data: { accountResearch, accountAiContext, researchedAt },
    });
  }
  return { source, accountResearch, accountAiContext, researchedAt };
}
