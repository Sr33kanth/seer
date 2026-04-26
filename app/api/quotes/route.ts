import { type NextRequest } from "next/server";
import yf, { type RichQuote, type QuoteSummaryResult } from "@/lib/yahoo";

export const runtime = "nodejs";

function flattenSummary(symbol: string, r: QuoteSummaryResult): RichQuote {
  const p = r.price ?? {};
  const s = r.summaryDetail ?? {};
  const k = r.defaultKeyStatistics ?? {};
  return {
    symbol,
    shortName: p.shortName,
    longName: p.longName,
    price: p.regularMarketPrice,
    change: p.regularMarketChange,
    changePct: p.regularMarketChangePercent != null
      ? p.regularMarketChangePercent * 100
      : undefined,
    open: p.regularMarketOpen,
    prevClose: p.regularMarketPreviousClose,
    dayHigh: p.regularMarketDayHigh,
    dayLow: p.regularMarketDayLow,
    volume: p.regularMarketVolume,
    avgVolume: p.averageDailyVolume10Day,
    postPrice: p.postMarketPrice,
    postChange: p.postMarketChange,
    postChangePct: p.postMarketChangePercent != null
      ? p.postMarketChangePercent * 100
      : undefined,
    prePrice: p.preMarketPrice,
    preChange: p.preMarketChange,
    preChangePct: p.preMarketChangePercent != null
      ? p.preMarketChangePercent * 100
      : undefined,
    marketCap: p.marketCap,
    trailingPE: s.trailingPE,
    forwardPE: s.forwardPE,
    eps: k.trailingEps,
    forwardEps: k.forwardEps,
    dividendYield: s.dividendYield != null ? s.dividendYield * 100 : undefined,
    dividendRate: s.dividendRate,
    beta: s.beta ?? k.beta,
    fiftyTwoWeekLow: s.fiftyTwoWeekLow,
    fiftyTwoWeekHigh: s.fiftyTwoWeekHigh,
    fiftyDayAvg: s.fiftyDayAverage,
    twoHundredDayAvg: s.twoHundredDayAverage,
    priceToBook: k.priceToBook,
    profitMargins: k.profitMargins != null ? k.profitMargins * 100 : undefined,
    pegRatio: k.pegRatio,
    shortRatio: k.shortRatio,
    insiderPct: k.heldPercentInsiders != null ? k.heldPercentInsiders * 100 : undefined,
    institutionPct: k.heldPercentInstitutions != null ? k.heldPercentInstitutions * 100 : undefined,
    weekChange52: k["52WeekChange"] != null ? k["52WeekChange"] * 100 : undefined,
    marketState: p.marketState,
    currency: p.currency,
    exchangeName: p.exchangeName,
    fetchedAt: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const symbols = request.nextUrl.searchParams.get("symbols");
  if (!symbols) return Response.json({ error: "symbols param required" }, { status: 400 });

  const list = symbols.split(",").map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 50);
  if (list.length === 0) return Response.json({});

  const results = await Promise.allSettled(
    list.map(s => yf.quoteSummary(s, { modules: ["price", "summaryDetail", "defaultKeyStatistics"] }))
  );

  const quotes: Record<string, RichQuote> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      quotes[list[i]] = flattenSummary(list[i], r.value);
    } else {
      quotes[list[i]] = { symbol: list[i], fetchedAt: new Date().toISOString(), error: "unavailable" };
    }
  });

  return Response.json(quotes);
}
