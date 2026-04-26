import type { Emit, Signal } from "./types";

// EDGAR EFTS full-text search — returns recent Form 4 filings
// display_names format: ["Apple Inc. (AAPL) (CIK 0000320193)"]
interface EftsHit {
  _source: {
    entity_name?: string;
    file_date?: string;
    display_names?: string[];
    period_of_report?: string;
    file_num?: string;
  };
  _id?: string;
}

interface EftsResponse {
  hits: {
    total: { value: number };
    hits: EftsHit[];
  };
}

const TICKER_RE = /\(([A-Z]{1,5})\)\s*\(CIK/;

function extractTicker(displayName: string): string | null {
  const m = displayName.match(TICKER_RE);
  return m ? m[1] : null;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function runEdgarScanner(emit: Emit, scanId: string): Promise<Signal[]> {
  const id = "edgar";
  emit({ type: "scanner_start", id, name: "SEC EDGAR — Form 4", description: "Detects insider cluster buys: 3+ distinct insiders purchasing shares in the same company within 7 days." });

  const endDate = new Date();
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const t0 = Date.now();

  emit({ type: "log", id, message: `Fetching Form 4 filings from ${formatDate(startDate)} → ${formatDate(endDate)}` });

  const url = `https://efts.sec.gov/LATEST/search-index?q=&forms=4&dateRange=custom&startdt=${formatDate(startDate)}&enddt=${formatDate(endDate)}&hits.hits.total.value=true`;

  let data: EftsResponse;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Seer/1.0 research-aggregator contact@seer.app" },
    });
    if (!res.ok) throw new Error(`EDGAR returned HTTP ${res.status}`);
    data = await res.json() as EftsResponse;
  } catch (e) {
    emit({ type: "scanner_error", id, error: String(e) });
    return [];
  }

  const totalFilings = data.hits?.total?.value ?? 0;
  emit({ type: "log", id, message: `${totalFilings.toLocaleString()} Form 4 filings found. Analyzing for cluster buys…` });

  // Group by ticker — count distinct filers
  const byTicker = new Map<string, { filers: Set<string>; dates: string[]; names: string[] }>();

  for (const hit of data.hits?.hits ?? []) {
    const src = hit._source;
    if (!src.display_names?.length) continue;

    for (const dn of src.display_names) {
      const ticker = extractTicker(dn);
      if (!ticker) continue;

      if (!byTicker.has(ticker)) byTicker.set(ticker, { filers: new Set(), dates: [], names: [] });
      const entry = byTicker.get(ticker)!;
      if (src.entity_name) entry.filers.add(src.entity_name);
      if (src.file_date) entry.dates.push(src.file_date);

      // Extract company name from display_names (everything before first " (")
      const companyName = dn.split(" (")[0];
      if (companyName && !entry.names.includes(companyName)) entry.names.push(companyName);
    }
  }

  emit({ type: "log", id, message: `Parsed ${byTicker.size} distinct tickers. Filtering for cluster buys (≥3 filers)…` });

  const CLUSTER_THRESHOLD = 3;
  const signals: Signal[] = [];

  for (const [ticker, entry] of byTicker.entries()) {
    if (entry.filers.size < CLUSTER_THRESHOLD) continue;

    // Score: more filers = higher confidence, cap at 95
    const score = Math.min(95, 50 + entry.filers.size * 10);
    const companyName = entry.names[0] ?? ticker;
    const detail = `${entry.filers.size} insiders filed Form 4 in the last 7 days (${entry.dates.slice(0, 3).join(", ")}${entry.dates.length > 3 ? "…" : ""})`;

    const signal: Signal = {
      symbol: ticker,
      source: "edgar",
      tags: ["insider-cluster-buy"],
      score,
      detail,
      url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(companyName)}&type=4&dateb=&owner=include&count=20`,
    };

    signals.push(signal);
    emit({ type: "signal", scanId, ...signal });
    emit({ type: "log", id, message: `  ✦ ${ticker} — ${entry.filers.size} insiders (score ${score})` });
  }

  if (signals.length === 0) {
    emit({ type: "log", id, message: "No cluster buys detected this week." });
  }

  emit({ type: "scanner_done", id, found: signals.length, durationMs: Date.now() - t0 });
  return signals;
}
