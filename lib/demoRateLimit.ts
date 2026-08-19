import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { llmConfigured } from "@/lib/llm";

const FREE_RUN_LIMIT = 10;
const BUTTONDOWN_URL = "https://api.buttondown.email/v1/subscribers";

export type DemoLimitResult =
  | { ok: true; remaining: number | null; emailRequired: false }
  | { ok: false; status: 429; remaining: 0; emailRequired: true; message: string };

export function demoLimitErrorResponse(result: Extract<DemoLimitResult, { ok: false }>) {
  return Response.json({
    error: result.message,
    emailRequired: result.emailRequired,
    remaining: result.remaining,
  }, { status: result.status });
}

export async function enforceDemoRunLimit(req: NextRequest, units = 1, email?: unknown): Promise<DemoLimitResult> {
  if (!llmConfigured()) return { ok: true, remaining: null, emailRequired: false };

  const ipHash = hashIp(getClientIp(req));
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail) {
    await prisma.$transaction(async (tx) => {
      await tx.demoUsage.upsert({
        where: { ipHash },
        create: { ipHash, email: normalizedEmail, freeRunsUsed: FREE_RUN_LIMIT },
        update: { email: normalizedEmail },
      });
      await tx.demoNewsletterSignup.upsert({
        where: { email: normalizedEmail },
        create: { email: normalizedEmail, ipHash },
        update: { ipHash },
      });
    });
    await subscribeToNewsletter(normalizedEmail);
    return { ok: true, remaining: null, emailRequired: false };
  }

  const usage = await prisma.demoUsage.upsert({
    where: { ipHash },
    create: { ipHash, freeRunsUsed: 0 },
    update: {},
  });

  if (usage.email) return { ok: true, remaining: null, emailRequired: false };

  if (usage.freeRunsUsed + units > FREE_RUN_LIMIT) {
    return {
      ok: false,
      status: 429,
      remaining: 0,
      emailRequired: true,
      message: "You used the 10 free demo runs for this network. Add your email to keep running it — it also signs you up for GTM Josh updates.",
    };
  }

  const updated = await prisma.demoUsage.update({
    where: { ipHash },
    data: { freeRunsUsed: { increment: units } },
  });

  return {
    ok: true,
    remaining: Math.max(0, FREE_RUN_LIMIT - updated.freeRunsUsed),
    emailRequired: false,
  };
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function hashIp(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT || "gtm-josh-demo-v1";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

async function subscribeToNewsletter(email: string) {
  const key = process.env.BUTTONDOWN_API_KEY;
  if (!key) return;

  const res = await fetch(BUTTONDOWN_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: email,
      tags: ["ai-context-layer-demo"],
      metadata: { source: "ai-context-layer-demo" },
    }),
  });

  if (res.ok || res.status === 409) return;
  throw new Error(`Buttondown subscribe failed: ${res.status}`);
}
