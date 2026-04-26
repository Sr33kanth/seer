import type { Emit, Signal } from "./types";

const SUBREDDITS = ["investing", "SecurityAnalysis", "stocks"];

// Match $TICKER or standalone 2-5 letter uppercase words that look like tickers
// Avoid common false positives (I, A, IPO, ETF, etc.)
const TICKER_RE = /\$([A-Z]{1,5})\b|\b([A-Z]{2,5})\b/g;
const STOPWORDS = new Set([
  "I","A","AI","AND","OR","BUT","THE","FOR","ETF","IPO","CEO","CFO","CTO","IPO",
  "GDP","CPI","FED","SEC","USA","US","UK","EU","IMF","ECB","IMF","IMO","IMHO",
  "DD","DCA","EPS","PE","YTD","YOY","QOQ","OP","TL","DR","TLDR","OT","AM","PM",
  "IT","IS","BE","BY","IN","ON","AT","TO","DO","GO","NO","UP","IF","SO",
  "YOLO","HODL","BTC","ETH","NFT","DAO","APR","APY","TVL","DEX","CEX",
]);

interface RedditPost {
  data: {
    title: string;
    selftext?: string;
    score: number;
    num_comments: number;
    url: string;
    permalink: string;
    subreddit: string;
  };
}

interface RedditListing {
  data: { children: RedditPost[] };
}

function extractTickers(text: string): string[] {
  const tickers: string[] = [];
  let m: RegExpExecArray | null;
  TICKER_RE.lastIndex = 0;
  while ((m = TICKER_RE.exec(text)) !== null) {
    const t = m[1] ?? m[2];
    if (!STOPWORDS.has(t)) tickers.push(t);
  }
  return tickers;
}

export async function runRedditScanner(emit: Emit, scanId: string): Promise<Signal[]> {
  const id = "reddit";
  emit({ type: "scanner_start", id, name: "Reddit — Curated Subs", description: "Scans r/investing, r/SecurityAnalysis, r/stocks hot posts for ticker mentions. Weights by upvotes." });

  const t0 = Date.now();
  const tickerMentions = new Map<string, { score: number; posts: string[]; urls: string[] }>();

  for (const sub of SUBREDDITS) {
    emit({ type: "log", id, message: `Fetching r/${sub} hot posts…` });

    let listing: RedditListing;
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=50`, {
        headers: { "User-Agent": "Seer/1.0 research-aggregator" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      listing = await res.json() as RedditListing;
    } catch (e) {
      emit({ type: "log", id, message: `  ✗ r/${sub} failed: ${String(e)}` });
      continue;
    }

    const posts = listing.data?.children ?? [];
    emit({ type: "log", id, message: `  ${posts.length} posts — extracting tickers…` });

    for (const post of posts) {
      const d = post.data;
      const text = `${d.title} ${d.selftext ?? ""}`;
      const tickers = extractTickers(text);
      const postScore = d.score + d.num_comments * 2; // weight comments higher

      for (const ticker of tickers) {
        if (!tickerMentions.has(ticker)) {
          tickerMentions.set(ticker, { score: 0, posts: [], urls: [] });
        }
        const entry = tickerMentions.get(ticker)!;
        entry.score += postScore;
        if (!entry.posts.includes(d.title)) entry.posts.push(d.title);
        const url = `https://reddit.com${d.permalink}`;
        if (!entry.urls.includes(url)) entry.urls.push(url);
      }
    }
  }

  emit({ type: "log", id, message: `${tickerMentions.size} unique tickers mentioned. Ranking by engagement…` });

  // Sort by score, take top 20
  const ranked = Array.from(tickerMentions.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 20);

  const maxScore = ranked[0]?.[1].score ?? 1;
  const signals: Signal[] = [];

  for (const [ticker, entry] of ranked) {
    // Only surface tickers mentioned in 2+ posts or with high engagement
    if (entry.posts.length < 2 && entry.score < maxScore * 0.1) continue;

    const normalizedScore = Math.round(Math.min(90, (entry.score / maxScore) * 80 + 10));
    const detail = `Mentioned in ${entry.posts.length} post${entry.posts.length > 1 ? "s" : ""}: "${entry.posts[0].slice(0, 80)}${entry.posts[0].length > 80 ? "…" : ""}"`;

    const signal: Signal = {
      symbol: ticker,
      source: "reddit",
      tags: ["reddit-buzz"],
      score: normalizedScore,
      detail,
      url: entry.urls[0],
    };

    signals.push(signal);
    emit({ type: "signal", scanId, ...signal });
    emit({ type: "log", id, message: `  ✦ ${ticker} — ${entry.posts.length} posts, engagement score ${entry.score.toLocaleString()}` });
  }

  emit({ type: "scanner_done", id, found: signals.length, durationMs: Date.now() - t0 });
  return signals;
}
