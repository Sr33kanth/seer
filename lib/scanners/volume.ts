import yf from "@/lib/yahoo";
import type { Emit, Signal } from "./types";

// Curated scan universe: S&P 100 + liquid ETFs
// These are checked for unusual volume and 52W breakouts
const UNIVERSE = [
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","BRK-B","AVGO","JPM",
  "LLY","V","MA","UNH","XOM","JNJ","PG","HD","COST","MRK","ABBV","CVX",
  "CRM","BAC","NFLX","AMD","ORCL","KO","PEP","TMO","ACN","MCD","WMT","CSCO",
  "INTC","IBM","QCOM","TXN","GS","MS","WFC","AXP","CAT","DE","HON","RTX",
  "BA","LMT","GE","MMM","UPS","FDX","SBUX","NKE","DIS","CMCSA","VZ","T",
  "NEE","D","DUK","SO","SRE","PLD","AMT","EQIX","CCI","SPG","O","WELL",
  "UNP","CSX","NSC","WM","RSG","ECL","SHW","APD","LIN","DD","DOW","NEM",
  "FCX","AA","NUE","CLF","X","CF","MOS","ADM","BG","TSN","CAG","K","GIS",
  "HCA","CI","ELV","CVS","MCK","ABC","WBA","ZTS","IDXX","ISRG","EW","BSX",
  // ETFs for sector momentum
  "SPY","QQQ","IWM","XLK","XLF","XLE","XLV","XLI","XLY","XLP","XLU","GLD","SLV",
];

export async function runVolumeScanner(
  emit: Emit,
  scanId: string,
  watchlistSymbols: string[] = [],
): Promise<Signal[]> {
  const id = "volume";
  emit({ type: "scanner_start", id, name: "Volume & Breakout Screener", description: "Flags unusual volume (>2× 10-day avg) and 52-week high breakouts across ~120 liquid tickers + your watchlist." });

  const t0 = Date.now();
  const symbols = Array.from(new Set([...UNIVERSE, ...watchlistSymbols]));
  emit({ type: "log", id, message: `Scanning ${symbols.length} tickers via Yahoo Finance quoteSummary…` });

  // Batch into groups of 20 to avoid hammering Yahoo
  const BATCH = 20;
  const results: Signal[] = [];
  let processed = 0;

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map(s => yf.quoteSummary(s, { modules: ["price", "summaryDetail"] }))
    );

    for (let j = 0; j < batch.length; j++) {
      const r = settled[j];
      if (r.status !== "fulfilled") continue;
      const p = r.value.price;
      const s = r.value.summaryDetail;
      if (!p) continue;

      const sym = batch[j];
      const price = p.regularMarketPrice;
      const volume = p.regularMarketVolume;
      const avgVol = p.averageDailyVolume10Day ?? s?.averageVolume;
      const high52 = s?.fiftyTwoWeekHigh;
      const low52 = s?.fiftyTwoWeekLow;
      const changePct = p.regularMarketChangePercent;

      if (!price || !volume || !avgVol) continue;

      const volRatio = volume / avgVol;
      const pctFrom52High = high52 ? ((price - high52) / high52) * 100 : null;

      const tags: string[] = [];
      let score = 0;
      const parts: string[] = [];

      // Unusual volume
      if (volRatio >= 3) {
        tags.push("volume-spike");
        score += 40;
        parts.push(`volume ${volRatio.toFixed(1)}× avg`);
      } else if (volRatio >= 2) {
        tags.push("unusual-volume");
        score += 20;
        parts.push(`volume ${volRatio.toFixed(1)}× avg`);
      }

      // 52W breakout (within 2% of high)
      if (pctFrom52High !== null && pctFrom52High >= -2) {
        tags.push("52w-breakout");
        score += 35;
        parts.push(`within ${Math.abs(pctFrom52High).toFixed(1)}% of 52W high`);
      }

      // Strong day move + unusual volume = momentum signal
      if (changePct && Math.abs(changePct) >= 0.05 && volRatio >= 2) {
        tags.push("momentum");
        score += 15;
        parts.push(`${(changePct * 100).toFixed(1)}% today`);
      }

      // 52W range position as bonus
      if (high52 && low52 && pctFrom52High !== null) {
        const rangePos = (price - low52) / (high52 - low52);
        if (rangePos >= 0.9) score = Math.min(score + 10, 95);
      }

      if (tags.length === 0 || score < 20) continue;

      const detail = parts.join(" · ");
      const signal: Signal = { symbol: sym, source: "volume", tags, score, detail };
      results.push(signal);
      emit({ type: "signal", scanId, ...signal });
    }

    processed += batch.length;
    emit({ type: "log", id, message: `  ${processed}/${symbols.length} scanned — ${results.length} signals so far` });
  }

  if (results.length === 0) {
    emit({ type: "log", id, message: "No unusual volume or breakout signals found." });
  }

  emit({ type: "scanner_done", id, found: results.length, durationMs: Date.now() - t0 });
  return results;
}
