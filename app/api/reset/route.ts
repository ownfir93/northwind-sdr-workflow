// Resets the CURRENT visitor's demo instance: clears this session's runs + hygiene events so their Analytics
// and recent runs go back to empty. The shared CRM dataset (contacts/accounts/opps) is left intact — it's the
// reference data everyone demos against.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const sessionId = await getSessionId();
    const [runs, hygiene] = await Promise.all([
      prisma.run.deleteMany({ where: { sessionId } }),
      prisma.hygieneEvent.deleteMany({ where: { sessionId } }),
    ]);
    return NextResponse.json({ ok: true, clearedRuns: runs.count, clearedHygiene: hygiene.count });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
