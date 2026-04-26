import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const sql = getDb();
  const rows = await sql`
    SELECT symbol, added_at FROM watchlist ORDER BY added_at DESC
  `;
  return Response.json(rows);
}

export async function POST(request: Request) {
  const { symbol } = await request.json();
  if (!symbol || typeof symbol !== "string") {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }
  const upper = symbol.trim().toUpperCase();
  const sql = getDb();
  try {
    await sql`INSERT INTO watchlist (symbol) VALUES (${upper})`;
  } catch (e: unknown) {
    // Postgres unique violation code
    if ((e as { code?: string }).code === "23505") {
      return Response.json({ error: "already in watchlist" }, { status: 409 });
    }
    throw e;
  }
  return Response.json({ symbol: upper }, { status: 201 });
}
