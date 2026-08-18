// app/api/ingest/route.ts
//   GET  — list the inbound found_contacts (answer key stripped). Lightweight; feeds the New-Lead dropdown.
//   POST — run the HYGIENE GATE on the whole batch: exact (deterministic) -> fuzzy (deterministic) ->
//          AI adjudication (n8n -> Claude, ambiguous only). Writes HygieneEvent rows, promotes survivors
//          (staged -> active | merged). Idempotent: clears prior clay records + HygieneEvents first.
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";
import { generateJson, n8nConfigured } from "@/lib/n8n";
import { hygienePrompt } from "@/lib/prompts";
import { fuzzyScore, HYGIENE_THRESHOLDS, type MatchInput } from "@/lib/hygiene";
import { getSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

type Row = Record<string, string>;
const normEmail = (e: string | null | undefined) => (e || "").toLowerCase().trim();

function readFound(): Row[] {
  const text = readFileSync(join(process.cwd(), "fixtures", "inbound", "found_contacts.csv"), "utf8");
  return parse(text, { columns: true, skip_empty_lines: true, trim: true });
}

function stagedShape(r: Row) {
  return {
    foundId: r.found_id, accountId: r.account_id, firstName: r.first_name, lastName: r.last_name,
    title: r.title || null, seniority: r.seniority || null, email: r.email || null,
    persona: r.persona || null, source: r.source, discoveredDate: r.discovered_date, status: "staged",
    // expected_outcome intentionally omitted — it's the answer key, stripped at ingest.
  };
}

// GET: list only (no hygiene, no writes).
export async function GET() {
  const rows = readFound();
  return NextResponse.json({ count: rows.length, staged: rows.map(stagedShape) });
}

// POST: run the hygiene gate.
export async function POST() {
  const rows = readFound();
  const sessionId = await getSessionId();

  // Idempotent reset so the batch can be re-run cleanly. Hygiene events are per-session; the staged clay
  // contacts are shared demo records (fixed ids) and get reset + recreated.
  await prisma.hygieneEvent.deleteMany({ where: { sessionId } });
  await prisma.contact.deleteMany({ where: { source: "clay" } });

  const active = await prisma.contact.findMany({
    where: { status: "active" },
    select: { id: true, firstName: true, lastName: true, title: true, email: true, accountId: true },
  });

  const results: any[] = [];

  for (const r of rows) {
    const found: MatchInput = { firstName: r.first_name, lastName: r.last_name, title: r.title, email: r.email };
    const foundId = r.found_id;

    let matchType: "exact" | "fuzzy" | "none" = "none";
    let decision: "auto_merge" | "needs_review" | "create_new" = "create_new";
    let confidence = 0;
    let matchedContactId: string | null = null;
    let reason = "No matching contact in the account — net-new.";

    // Tier 1 — exact email (deterministic, no LLM).
    const exact = r.email ? active.find((c) => normEmail(c.email) === normEmail(r.email)) : undefined;
    if (exact) {
      matchType = "exact"; decision = "auto_merge"; confidence = 1; matchedContactId = exact.id;
      reason = `Exact email match to ${exact.id} (${exact.firstName} ${exact.lastName}).`;
    } else {
      // Tier 2 — fuzzy candidates within the same account (deterministic scoring).
      const candidates = active
        .filter((c) => c.accountId === r.account_id)
        .map((c) => ({ c, score: fuzzyScore(found, { firstName: c.firstName, lastName: c.lastName, title: c.title, email: c.email }) }))
        .sort((a, b) => b.score - a.score);
      const best = candidates[0];

      if (best && best.score >= HYGIENE_THRESHOLDS.ambiguousMin) {
        // Tier 3 — AI adjudication (ambiguous band only).
        matchType = "fuzzy";
        const top = candidates.slice(0, 2).map((x) => ({ id: x.c.id, name: `${x.c.firstName} ${x.c.lastName}`, title: x.c.title, email: x.c.email, score: +x.score.toFixed(2) }));
        const ambiguityNote = `Best fuzzy score ${best.score.toFixed(2)} (≥ ${HYGIENE_THRESHOLDS.ambiguousMin}); same account, name/title/email-localpart similar but no exact email match.`;
        let adjudicated = false;
        if (n8nConfigured()) {
          try {
            const v = await generateJson<any>(hygienePrompt({
              staged: JSON.stringify({ foundId, firstName: r.first_name, lastName: r.last_name, title: r.title, email: r.email, accountId: r.account_id }),
              candidates: JSON.stringify(top),
              ambiguityNote,
            }));
            if (v?.decision === "auto_merge" || v?.decision === "needs_review" || v?.decision === "create_new") {
              decision = v.decision;
              confidence = typeof v.confidence === "number" ? v.confidence : best.score;
              matchedContactId = v.matchedContactId ?? (decision === "create_new" ? null : best.c.id);
              reason = v.reason ? String(v.reason) : "AI-adjudicated.";
              adjudicated = true;
            }
          } catch { /* fall through to safe default */ }
        }
        if (!adjudicated) {
          // Safe fallback: never auto-merge without adjudication.
          decision = "needs_review"; confidence = best.score; matchedContactId = best.c.id;
          reason = "AI adjudication unavailable — routed to human review (never auto-merge unverified).";
        }
      } else {
        matchType = "none"; decision = "create_new"; confidence = best ? +best.score.toFixed(2) : 0;
        reason = "No same-account candidate above the fuzzy threshold — net-new.";
      }
    }

    // Promote: write the staged contact in its resolved state.
    const status = decision === "auto_merge" ? "merged" : decision === "create_new" ? "active" : "staged";
    await prisma.contact.create({
      data: {
        id: foundId, accountId: r.account_id, firstName: r.first_name, lastName: r.last_name,
        title: r.title || null, seniority: r.seniority || null, email: r.email || null,
        persona: r.persona || null, linkedinUrl: r.linkedin_url || null,
        status, source: "clay",
        discoveredDate: r.discovered_date ? new Date(r.discovered_date) : null,
        mergedIntoId: decision === "auto_merge" ? matchedContactId : null,
      },
    });

    await prisma.hygieneEvent.create({
      data: { foundId, matchType, decision, confidence, matchedContactId, reason, sessionId },
    });

    results.push({ ...stagedShape(r), hygiene: { decision, matchType, confidence, matchedContactId, reason } });
  }

  const by = (d: string) => results.filter((x) => x.hygiene.decision === d).length;
  return NextResponse.json({
    count: results.length,
    summary: { auto_merge: by("auto_merge"), needs_review: by("needs_review"), create_new: by("create_new") },
    staged: results,
  });
}
