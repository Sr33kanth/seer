import { neon } from "@neondatabase/serverless";

export type NeonSql = ReturnType<typeof neon>;

let _sql: NeonSql | null = null;

export function getDb(): NeonSql {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set. Add it to .env.local or Vercel environment variables.");
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export async function ensureSchema(): Promise<void> {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS watchlist (
      symbol  TEXT    PRIMARY KEY,
      added_at BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS theses (
      id         BIGSERIAL PRIMARY KEY,
      symbol     TEXT      NOT NULL,
      thesis     TEXT      NOT NULL,
      result     JSONB     NOT NULL,
      created_at BIGINT    NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS theses_symbol_idx ON theses (symbol, created_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS signals (
      id         BIGSERIAL PRIMARY KEY,
      scan_id    TEXT      NOT NULL,
      symbol     TEXT      NOT NULL,
      source     TEXT      NOT NULL,
      tags       TEXT[]    NOT NULL,
      score      INT       NOT NULL,
      detail     TEXT      NOT NULL,
      raw_url    TEXT,
      created_at BIGINT    NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS signals_scan_idx ON signals (scan_id, score DESC)`;
}
