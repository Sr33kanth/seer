import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { RichQuote } from "./yahoo";

const SubClaimSchema = z.object({
  claim: z.string().describe("A specific, falsifiable sub-claim of the thesis"),
  verdict: z.enum(["supported", "challenged", "insufficient_data"]),
  confidence: z.number().min(0).max(100).describe("0 = no support, 100 = strongly confirmed"),
  evidence: z.string().describe("Specific data points or reasoning behind the verdict"),
});

export const ThesisResultSchema = z.object({
  subClaims: z.array(SubClaimSchema).min(2).max(6),
  bullCase: z.string().describe("Concise bull case grounded in the available data"),
  bearCase: z.string().describe("Concise bear case and key risks"),
  overallConfidence: z.number().min(0).max(100).describe("Weighted confidence across all sub-claims"),
  invalidationTriggers: z.array(z.string()).min(1).max(5).describe("Specific conditions that would invalidate the thesis"),
  monitoring: z.array(z.string()).min(1).max(5).describe("Metrics or events to watch going forward"),
  entry: z.string().describe("Suggested entry approach (e.g. 'Scale in under $X on confirmed volume breakout')"),
  stop: z.string().describe("Stop-loss logic (e.g. 'Close below 200-day MA or $X hard stop')"),
  positionSize: z.string().describe("Position sizing guidance relative to portfolio (e.g. '1–2% starter, add on confirmation')"),
});

export type ThesisResult = z.infer<typeof ThesisResultSchema>;

export interface StoredThesis {
  id: number;
  symbol: string;
  thesis: string;
  result: ThesisResult;
  created_at: number;
}

function buildQuoteContext(symbol: string, quote?: RichQuote): string {
  if (!quote || quote.error) return `No market data available for ${symbol}.`;

  const lines: string[] = [
    `Symbol: ${symbol} (${quote.longName ?? quote.shortName ?? "Unknown"})`,
    `Exchange: ${quote.exchangeName ?? "?"}  Currency: ${quote.currency ?? "USD"}`,
    ``,
    `--- Price ---`,
    `Current: $${quote.price?.toFixed(2) ?? "?"}  Change: ${quote.changePct != null ? (quote.changePct >= 0 ? "+" : "") + quote.changePct.toFixed(2) + "%" : "?"}`,
    `Open: $${quote.open?.toFixed(2) ?? "?"}  Prev Close: $${quote.prevClose?.toFixed(2) ?? "?"}`,
    `Day Range: $${quote.dayLow?.toFixed(2) ?? "?"} – $${quote.dayHigh?.toFixed(2) ?? "?"}`,
    `52W Range: $${quote.fiftyTwoWeekLow?.toFixed(2) ?? "?"} – $${quote.fiftyTwoWeekHigh?.toFixed(2) ?? "?"}`,
    `52W Change: ${quote.weekChange52 != null ? (quote.weekChange52 >= 0 ? "+" : "") + quote.weekChange52.toFixed(1) + "%" : "?"}`,
    `50-Day MA: $${quote.fiftyDayAvg?.toFixed(2) ?? "?"}  200-Day MA: $${quote.twoHundredDayAvg?.toFixed(2) ?? "?"}`,
    `Market State: ${quote.marketState ?? "?"}`,
  ];

  if (quote.marketCap) lines.push(`\n--- Size ---\nMarket Cap: $${(quote.marketCap / 1e9).toFixed(2)}B`);

  lines.push(`\n--- Volume ---`);
  lines.push(`Volume: ${quote.volume?.toLocaleString() ?? "?"}  Avg Vol: ${quote.avgVolume?.toLocaleString() ?? "?"}`);

  lines.push(`\n--- Valuation ---`);
  lines.push(`P/E (TTM): ${quote.trailingPE?.toFixed(1) ?? "?"}  P/E (Fwd): ${quote.forwardPE?.toFixed(1) ?? "?"}`);
  lines.push(`EPS (TTM): $${quote.eps?.toFixed(2) ?? "?"}  Fwd EPS: $${quote.forwardEps?.toFixed(2) ?? "?"}`);
  lines.push(`P/B: ${quote.priceToBook?.toFixed(2) ?? "?"}  PEG: ${quote.pegRatio?.toFixed(2) ?? "?"}`);
  lines.push(`Profit Margin: ${quote.profitMargins?.toFixed(1) ?? "?"}%`);

  lines.push(`\n--- Risk & Sentiment ---`);
  lines.push(`Beta: ${quote.beta?.toFixed(2) ?? "?"}  Short Ratio: ${quote.shortRatio?.toFixed(1) ?? "?"}`);
  lines.push(`Insider Ownership: ${quote.insiderPct?.toFixed(1) ?? "?"}%  Institutional: ${quote.institutionPct?.toFixed(1) ?? "?"}%`);

  if (quote.dividendYield) {
    lines.push(`\n--- Income ---`);
    lines.push(`Dividend Yield: ${quote.dividendYield.toFixed(2)}%  Div Rate: $${quote.dividendRate?.toFixed(2) ?? "?"}`);
  }

  if (quote.marketState !== "REGULAR") {
    if (quote.prePrice) lines.push(`\nPre-Market: $${quote.prePrice.toFixed(2)} (${quote.preChangePct != null ? (quote.preChangePct >= 0 ? "+" : "") + quote.preChangePct.toFixed(2) + "%" : "?"})`);
    if (quote.postPrice) lines.push(`After-Hours: $${quote.postPrice.toFixed(2)} (${quote.postChangePct != null ? (quote.postChangePct >= 0 ? "+" : "") + quote.postChangePct.toFixed(2) + "%" : "?"})`);
  }

  return lines.join("\n");
}

export async function analyzeThesis(
  symbol: string,
  thesis: string,
  quote?: RichQuote,
): Promise<ThesisResult> {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const quoteContext = buildQuoteContext(symbol, quote);

  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: ThesisResultSchema,
    system: `You are a rigorous equity research analyst. Your job is to stress-test investment theses with discipline and intellectual honesty.

Given a thesis and available market data, you will:
1. Decompose the thesis into 2–6 specific, falsifiable sub-claims
2. Assess each sub-claim against the available data (supported / challenged / insufficient_data)
3. Write concise, data-grounded bull and bear cases
4. Identify what would invalidate the thesis entirely
5. Suggest what metrics/events to monitor
6. Provide entry, stop-loss, and position sizing guidance

Rules:
- Be specific and use numbers from the provided data where possible
- Do not hallucinate data not provided — mark as insufficient_data if evidence is lacking
- Bull and bear cases should each be 2–4 sentences, grounded in data
- Entry/stop/size should be actionable, not vague platitudes
- Overall confidence should reflect the balance of sub-claim verdicts weighted by their importance`,
    prompt: `Thesis: "${thesis}"

Market Data for ${symbol}:
${quoteContext}

Analyze this thesis rigorously.`,
  });

  return object;
}
