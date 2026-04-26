import { type NextRequest } from "next/server";
import { analyzeThesis } from "@/lib/thesis";
import { getDb } from "@/lib/db";
import type { RichQuote } from "@/lib/yahoo";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  const { symbol, thesis, quote } = (await request.json()) as {
    symbol: string;
    thesis: string;
    quote?: RichQuote;
  };

  if (!symbol || typeof symbol !== "string") {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }
  if (!thesis || typeof thesis !== "string" || thesis.trim().length < 10) {
    return Response.json({ error: "thesis must be at least 10 characters" }, { status: 400 });
  }

  const upperSymbol = symbol.trim().toUpperCase();

  const result = await analyzeThesis(upperSymbol, thesis.trim(), quote);

  // Persist to DB
  const sql = getDb();
  const rows = await sql`
    INSERT INTO theses (symbol, thesis, result)
    VALUES (${upperSymbol}, ${thesis.trim()}, ${JSON.stringify(result)})
    RETURNING id, created_at
  `;
  const row = (rows as Array<{ id: number; created_at: number }>)[0];

  return Response.json({ id: row.id, symbol: upperSymbol, thesis: thesis.trim(), result, created_at: row.created_at });
}
