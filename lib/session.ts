import { cookies } from "next/headers";

// The per-visitor session id set by middleware. Falls back to "anon" if a request somehow arrives
// before the cookie is set (e.g. a direct API hit). Scopes all activity (runs, hygiene) per session.
export async function getSessionId(): Promise<string> {
  try {
    return (await cookies()).get("sid")?.value || "anon";
  } catch {
    return "anon";
  }
}
