import { getDb } from "@/lib/db";
import { runEdgarScanner } from "@/lib/scanners/edgar";
import { runVolumeScanner } from "@/lib/scanners/volume";
import { runRedditScanner } from "@/lib/scanners/reddit";
import type { ScanEvent, Signal } from "@/lib/scanners/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function enc(event: ScanEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET() {
  const scanId = `scan_${Date.now()}`;
  const allSignals: Signal[] = [];
  const t0 = Date.now();

  // Fetch watchlist so volume scanner can include user's symbols
  let watchlistSymbols: string[] = [];
  try {
    const sql = getDb();
    const rows = await sql`SELECT symbol FROM watchlist` as Array<{ symbol: string }>;
    watchlistSymbols = rows.map(r => r.symbol);
  } catch { /* non-fatal */ }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ScanEvent) => {
        controller.enqueue(enc(event));
        // Collect signals for DB insert
        if (event.type === "signal") {
          allSignals.push({
            symbol: event.symbol,
            source: event.source,
            tags: event.tags,
            score: event.score,
            detail: event.detail,
            url: event.url,
          });
        }
      };

      try {
        // Run scanners sequentially so logs stay readable
        await runEdgarScanner(emit, scanId);
        await runVolumeScanner(emit, scanId, watchlistSymbols);
        await runRedditScanner(emit, scanId);

        // Persist to DB
        if (allSignals.length > 0) {
          try {
            const sql = getDb();
            for (const s of allSignals) {
              await sql`
                INSERT INTO signals (scan_id, symbol, source, tags, score, detail, raw_url)
                VALUES (${scanId}, ${s.symbol}, ${s.source}, ${s.tags}, ${s.score}, ${s.detail}, ${s.url ?? null})
              `;
            }
          } catch (e) {
            emit({ type: "log", id: "db", message: `Warning: could not persist signals — ${String(e)}` });
          }
        }

        emit({
          type: "scan_complete",
          scanId,
          totalSignals: allSignals.length,
          durationMs: Date.now() - t0,
        });
      } catch (e) {
        controller.enqueue(enc({ type: "log", id: "system", message: `Fatal error: ${String(e)}` }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
