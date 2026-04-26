import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sql = getDb();
  const result = await sql`
    DELETE FROM watchlist WHERE symbol = ${symbol.toUpperCase()}
  `;
  // neon returns an array; rowCount is on the raw result
  const changed = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  if (changed === 0) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
