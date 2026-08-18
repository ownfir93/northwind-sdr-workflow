// Deterministic tiers of the hygiene gate (02a). Exact + fuzzy candidate scoring live here in code —
// the LLM only adjudicates the genuinely ambiguous band (see coordination/hygiene-rules.md).

const NICKNAMES: Record<string, string> = {
  jess: "jessica", jessie: "jessica", jessi: "jessica",
  marc: "marcus", mark: "marcus",
  mike: "michael", mick: "michael", dave: "david", dan: "daniel", danny: "daniel",
  rob: "robert", bob: "robert", bobby: "robert", will: "william", bill: "william",
  tom: "thomas", tcommy: "thomas", chris: "christopher", matt: "matthew",
  alex: "alexander", sam: "samuel", tobias: "tobias", liz: "elizabeth", beth: "elizabeth",
  kate: "katherine", katie: "katherine", nick: "nicholas", tony: "anthony", jon: "jonathan",
};

const norm = (s: string) => (s || "").toLowerCase().trim();
const canonFirst = (n: string) => {
  const l = norm(n);
  return NICKNAMES[l] ?? l;
};

// Dice coefficient over character bigrams (0..1).
export function dice(a: string, b: string): number {
  a = norm(a);
  b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [bg, ca] of A) overlap += Math.min(ca, B.get(bg) ?? 0);
  const total = a.length - 1 + (b.length - 1);
  return (2 * overlap) / total;
}

const localPart = (email: string | null | undefined) => norm(email || "").split("@")[0] ?? "";

export interface MatchInput {
  firstName: string; lastName: string; title?: string | null; email?: string | null;
}

// Name similarity, nickname-aware. Last name weighted heavier.
export function nameScore(a: MatchInput, b: MatchInput): number {
  const lastSim = norm(a.lastName) === norm(b.lastName) ? 1 : dice(a.lastName, b.lastName);
  const aF = canonFirst(a.firstName);
  const bF = canonFirst(b.firstName);
  const firstSim = aF === bF ? 1 : dice(a.firstName, b.firstName);
  return 0.6 * lastSim + 0.4 * firstSim;
}

export function titleScore(a: MatchInput, b: MatchInput): number {
  const ta = norm(a.title || "");
  const tb = norm(b.title || "");
  if (!ta || !tb) return 0.5; // unknown — neutral
  const tok = (s: string) => new Set(s.split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const A = tok(ta);
  const B = tok(tb);
  if (!A.size || !B.size) return 0.5;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.max(A.size, B.size);
}

export function emailLocalScore(a: MatchInput, b: MatchInput): number {
  const la = localPart(a.email);
  const lb = localPart(b.email);
  if (!la || !lb) return 0;
  return la === lb ? 1 : dice(la, lb);
}

// Combined fuzzy score within the SAME account (0..1).
export function fuzzyScore(found: MatchInput, candidate: MatchInput): number {
  return 0.5 * nameScore(found, candidate) + 0.2 * titleScore(found, candidate) + 0.3 * emailLocalScore(found, candidate);
}

export const HYGIENE_THRESHOLDS = { ambiguousMin: 0.55, strong: 0.85 };
