// Provider-agnostic enrichment lookup. Mock path reads fixtures/enrichment/contacts_enriched.csv;
// a live path (Clay / LinkedAPI) would return the same shape. Phase 2's 02b-enrich skill wraps this.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";

export interface EnrichedRecord {
  contactId: string;
  title: string | null;
  seniority: string | null;
  headline: string | null;
  recentRoleChange: string | null;
  tenureYears: number | null;
  persona: string | null;
  source: string;
}

let cache: Map<string, EnrichedRecord> | null = null;

function load(): Map<string, EnrichedRecord> {
  if (cache) return cache;
  const text = readFileSync(
    join(process.cwd(), "fixtures", "enrichment", "contacts_enriched.csv"),
    "utf8",
  );
  const rows: Record<string, string>[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  cache = new Map();
  for (const r of rows) {
    cache.set(r.contact_id, {
      contactId: r.contact_id,
      title: r.title || null,
      seniority: r.seniority || null,
      headline: r.headline || null,
      recentRoleChange: r.recent_role_change || null,
      tenureYears: r.tenure_years ? Number(r.tenure_years) : null,
      persona: r.persona || null,
      source: r.enrichment_source || "mock",
    });
  }
  return cache;
}

// Returns the enriched record for a contact, or null if the provider has nothing
// (graceful degradation: callers proceed on existing data and flag low confidence).
export function enrich(contactId: string): EnrichedRecord | null {
  return load().get(contactId) ?? null;
}
