import { NextRequest, NextResponse } from "next/server";

// Give every visitor a stable session id (cookie) so their runs/analytics are isolated from everyone else's.
// The CRM dataset stays shared (it's the demo reference data); activity is per-session.
// (Next.js 16 "proxy" convention — formerly middleware.)
export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get("sid")?.value) {
    res.cookies.set("sid", crypto.randomUUID(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
