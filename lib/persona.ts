// Deterministic persona + seniority inference from a job title. Mirrors context/persona-rubrics.md so an
// uploaded brand-new contact gets the same persona mapping the CRM contacts use — no LLM needed for this.

export interface InferredPersona { persona: string; seniority: string }

export function inferPersona(title: string | null | undefined): InferredPersona {
  const t = (title ?? "").toLowerCase().trim();
  if (!t) return { persona: "Champion", seniority: "Manager" };

  // ---- Seniority ----
  let seniority: string;
  if (/\b(ceo|cto|cmo|coo|cfo|cdo|chief|founder|co-?founder|president|owner)\b/.test(t)) seniority = "C-Level / Founder";
  else if (/\b(svp|evp|vp|vice president|head of)\b/.test(t)) seniority = "VP";
  else if (/\bdirector\b/.test(t)) seniority = "Director";
  else if (/\b(manager|lead|principal)\b/.test(t)) seniority = "Manager";
  else if (/\b(analyst|engineer|specialist|coordinator|associate|developer|scientist|architect)\b/.test(t)) seniority = "Individual Contributor";
  else seniority = "Manager";

  // ---- Persona ----
  const technical = /\b(data|analytics|engineer|engineering|platform|infrastructure|warehouse|architect|developer|scientist|bi|information|it)\b/.test(t);
  const seniorMktg = /\b(svp|evp|vp|vice president|head of|chief|cmo|founder|president|owner|director)\b/.test(t)
    && /\b(growth|marketing|revenue|ecommerce|e-commerce|commercial|demand|brand|digital)\b/.test(t);
  const execMktg = /\b(cmo|chief marketing|founder|ceo|president|owner)\b/.test(t);
  const practitioner = /\b(lifecycle|demand gen|demand generation|growth|crm|email|retention|campaign|brand|content|marketing ops|marketing operations|marketing)\b/.test(t);
  const influencer = /\b(product manager|product owner|\bpm\b|analyst)\b/.test(t);

  let persona: string;
  if (technical) persona = "Technical Buyer";
  else if (seniorMktg || execMktg) persona = "Economic Buyer";
  else if (practitioner) persona = "Champion";
  else if (influencer) persona = "Influencer";
  else persona = "Champion";

  return { persona, seniority };
}

// Persona → concrete, persona-specific pain points + outreach angle (from context/persona-rubrics.md).
// Deterministic so a cold uploaded lead grounds in THIS persona's real pains — no extra LLM call, and never
// a generic "data in the warehouse" line. The pains avoid naming a specific warehouse.
export interface PersonaInsight { pains: string[]; angle: string }

const PERSONA_INSIGHT: Record<string, PersonaInsight> = {
  "Economic Buyer": {
    pains: [
      "campaign performance is capped because audience data is slow to activate and CAC/LTV is hard to close the loop on",
      "every new segment or test waits on the data team, slowing speed-to-impact",
    ],
    angle: "tie warehouse activation to a revenue outcome and propose a scoped pilot with a metric",
  },
  "Champion": {
    pains: [
      "shipping a new lifecycle or growth segment still means filing a data ticket and waiting on the data team",
      "rebuilding the same audience lists by hand across channels instead of reusing governed data",
    ],
    angle: "make them the hero who ships campaigns without the data-team bottleneck",
  },
  "Technical Buyer": {
    pains: [
      "activation tools demand a second copy of the data or an SDK, which breaks governance and adds maintenance",
      "the in-house reverse-ETL scripts pushing data to the CRM and ad tools are brittle and unobservable",
    ],
    angle: "lead with architecture and control — no duplicate data, governed and observable syncs",
  },
  "Influencer": {
    pains: [
      "the models and segments they build sit in the warehouse and never reach the tools teams actually act in",
      "there's no clean path to push their work downstream without engineering help",
    ],
    angle: "show how their models reach activation tools directly, without a rebuild",
  },
};

export function personaInsight(persona: string): PersonaInsight {
  return PERSONA_INSIGHT[persona] ?? PERSONA_INSIGHT["Champion"];
}
