// This session's workflow runs (most recent first), with the persisted AI email for review in Analytics.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionId = await getSessionId();
  const runs = await prisma.run.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      contactId: r.contactId,
      label: r.label,
      triggerType: r.triggerType,
      path: r.path,
      qaPassed: r.qaPassed,
      qaReasons: JSON.parse(r.qaReasons ?? "[]"),
      durationMs: r.durationMs,
      createdAt: r.createdAt,
      email: r.emailBody ? { subject: r.emailSubject, body: r.emailBody, citations: JSON.parse(r.emailCitations ?? "[]") } : null,
    })),
  });
}
