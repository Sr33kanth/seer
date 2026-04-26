import YF from "yahoo-finance2";

// yahoo-finance2 v3 requires explicit instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf: YahooFinanceInstance = new (YF as any)({ suppressNotices: ["yahooSurvey"] });

export default yf;

export interface YahooFinanceInstance {
  quote(symbol: string): Promise<RawQuote>;
  quoteSummary(symbol: string, opts: { modules: string[] }): Promise<QuoteSummaryResult>;
}

interface RawQuote {
  symbol?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  marketState?: string;
  currency?: string;
}

export interface QuoteSummaryResult {
  price?: PriceModule;
  summaryDetail?: SummaryDetailModule;
  defaultKeyStatistics?: KeyStatsModule;
}

export interface PriceModule {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  regularMarketPreviousClose?: number;
  regularMarketVolume?: number;
  averageDailyVolume10Day?: number;
  postMarketPrice?: number;
  postMarketChange?: number;
  postMarketChangePercent?: number;
  preMarketPrice?: number;
  preMarketChange?: number;
  preMarketChangePercent?: number;
  marketState?: string;
  marketCap?: number;
  currency?: string;
  currencySymbol?: string;
  exchangeName?: string;
}

export interface SummaryDetailModule {
  trailingPE?: number;
  forwardPE?: number;
  dividendYield?: number;
  dividendRate?: number;
  beta?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  averageVolume?: number;
  payoutRatio?: number;
}

export interface KeyStatsModule {
  trailingEps?: number;
  forwardEps?: number;
  pegRatio?: number;
  priceToBook?: number;
  profitMargins?: number;
  shortRatio?: number;
  heldPercentInsiders?: number;
  heldPercentInstitutions?: number;
  "52WeekChange"?: number;
  beta?: number;
  enterpriseValue?: number;
  enterpriseToEbitda?: number;
  earningsQuarterlyGrowth?: number;
}

// Flat rich quote returned by our API
export interface RichQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  // Price
  price?: number;
  change?: number;
  changePct?: number;
  open?: number;
  prevClose?: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  avgVolume?: number;
  // After/pre market
  postPrice?: number;
  postChange?: number;
  postChangePct?: number;
  prePrice?: number;
  preChange?: number;
  preChangePct?: number;
  // Fundamentals
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  eps?: number;
  forwardEps?: number;
  dividendYield?: number;
  dividendRate?: number;
  beta?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyDayAvg?: number;
  twoHundredDayAvg?: number;
  priceToBook?: number;
  profitMargins?: number;
  pegRatio?: number;
  shortRatio?: number;
  insiderPct?: number;
  institutionPct?: number;
  weekChange52?: number;
  // Meta
  marketState?: string;
  currency?: string;
  exchangeName?: string;
  fetchedAt: string;
  error?: string;
}
