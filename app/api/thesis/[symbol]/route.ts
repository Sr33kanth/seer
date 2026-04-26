import { type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import type { StoredThesis } from "@/lib/thesis";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const sql = getDb();
  const rows = await sql`
    SELECT id, symbol, thesis, result, created_at
    FROM theses
    WHERE symbol = ${symbol.toUpperCase()}
    ORDER BY created_at DESC
    LIMIT 10
  `;
  return Response.json(rows as StoredThesis[]);
}
