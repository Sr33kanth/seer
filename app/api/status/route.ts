import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // DB health
  try {
    const sql = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (await sql`SELECT COUNT(*)::int AS count FROM watchlist`) as any[];
    const count = (rows[0] as { count: number }).count;
    checks.db = { ok: true, detail: `${count} symbol${count !== 1 ? "s" : ""}` };
  } catch (e) {
    checks.db = { ok: false, detail: String(e) };
  }

  // Yahoo Finance reachability
  try {
    const yf = await import("@/lib/yahoo");
    checks.yahooFinance = { ok: !!yf.default, detail: "module loaded" };
  } catch {
    checks.yahooFinance = { ok: false, detail: "module error" };
  }

  // AI
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  checks.ai = {
    ok: hasOpenAIKey,
    detail: hasOpenAIKey ? "API key set" : "OPENAI_API_KEY not configured",
  };

  const allOk = Object.values(checks).every((c) => c.ok);

  return Response.json({
    status: allOk ? "ok" : "degraded",
    checks,
    serverTime: new Date().toISOString(),
  });
}
