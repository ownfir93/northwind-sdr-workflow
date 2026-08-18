// app/api/research/route.ts
// Standalone Account Research trigger (also used by the nightly batch). POST { accountId } runs the
// lazy research agent (n8n -> Claude + web search) if the account isn't researched yet.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAccountResearched } from "@/lib/research";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const accountId: string | undefined = body.accountId;
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const acct = await prisma.account.findUnique({ where: { id: accountId } });
  if (!acct) return NextResponse.json({ error: `account ${accountId} not found` }, { status: 404 });

  const res = await ensureAccountResearched(acct);
  return NextResponse.json({ accountId, ...res });
}
