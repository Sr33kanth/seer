# Seer — Analyst Copilot MVP

Three loops, human-in-the-loop throughout.

---

## Loop 1 — Source Loop (daily cron, idea generation)

Aggregates signals from reliable sources into a ranked watchlist of ~20–40 names with "why" tags.

**Sources:**
- **SEC EDGAR** — Form 4 insider buys (cluster buys = strong signal), 13F changes, 8-Ks
- **Earnings surprise drift** — post-earnings announcement drift (PEAD), a durable academic anomaly
- **Analyst revisions** (Finnhub / FMP) — direction + magnitude
- **Unusual volume + 52-week breakouts** (Tiingo)
- **Curated substacks/newsletters** → RSS/email ingestion
- **Reddit** — r/investing, r/SecurityAnalysis (not WSB), filtered by author reputation
- **FinTwit lists** — filtered by author reputation
- **Google Trends / Wikipedia pageview spikes** — narrative/buzz detection

**Output:** ranked watchlist with why-tags:
`insider-cluster-buy` | `earnings-beat-drift` | `analyst-revision-up` | `volume-breakout` | `narrative-buzz` | `curated-newsletter`

---

## Loop 2 — Thesis Loop (on-demand per ticker)

Validates a thesis before buying. Human provides (or agent pulls) a thesis statement.

**Flow:**
1. Accept thesis statement (e.g. "Sandisk benefits from AI-memory supercycle + float squeeze post-spinoff")
2. Decompose into falsifiable sub-claims
3. Retrieve data per sub-claim (fundamentals, filings, news, competitor comps)
4. Bull/bear debate grounded in retrieved data
5. Output: confidence per sub-claim, invalidation conditions, monitoring triggers, suggested entry / stop / position size

---

## Loop 3 — Portfolio Loop (daily brief)

Reviews what you already hold.

**Flow:**
1. Ingest holdings (manual CSV to start; broker API later)
2. Per position: thesis-still-intact check, material news since last brief, invalidating catalysts, risk flags (concentration, correlation, upcoming earnings)
3. Suggestions: trim / add / hold / review — never auto-execute

---

## Implementation Status

### Already built
- [x] Next.js App Router scaffold
- [x] Neon DB watchlist (add / remove / list)
- [x] Live quote cards via Yahoo Finance (`quoteSummary` — price, fundamentals, 52W range, etc.)
- [x] Auto-refresh every 60 seconds
- [x] System status panel (DB + Yahoo + AI key check)
- [x] Activity log sidebar
- [x] AI suggestions panel stub (gated on API key, "Run Analysis" button wired to nothing)

### Pending — Loop 1 (Source Loop)
- [ ] Daily cron job (Vercel Cron or external scheduler)
- [ ] SEC EDGAR ingestion — Form 4 cluster-buy detector
- [ ] SEC EDGAR ingestion — 13F changes, 8-K watcher
- [ ] Earnings surprise / PEAD tracker (Finnhub or FMP)
- [ ] Analyst revision feed (Finnhub / FMP)
- [ ] Unusual volume + 52-week breakout scanner (Tiingo)
- [ ] RSS ingestion for curated newsletters / substacks
- [ ] Reddit signal filter (r/investing, r/SecurityAnalysis)
- [ ] Google Trends + Wikipedia pageview spike detector
- [ ] Signal ranking + why-tag assignment
- [ ] DB schema: `signals` table (symbol, source, tag, score, ts, raw_url)
- [ ] UI: "Signal Feed" view showing ranked opportunities with tags

### Pending — Loop 2 (Thesis Loop)
- [ ] OpenAI integration (replace Anthropic stub)
- [ ] Thesis input form per ticker
- [ ] Agent: decompose thesis into sub-claims
- [ ] Agent: retrieve supporting data per sub-claim (fundamentals already available; extend with news + filings)
- [ ] Agent: bull/bear structured debate
- [ ] Output UI: confidence per sub-claim, invalidation criteria, monitoring list, entry/stop/size suggestion
- [ ] DB schema: `theses` table (symbol, thesis_text, sub_claims JSON, output JSON, created_at)

### Pending — Loop 3 (Portfolio Loop)
- [ ] Holdings CSV upload + parse
- [ ] DB schema: `holdings` table (symbol, shares, avg_cost, added_at)
- [ ] Daily brief cron: per-position thesis check
- [ ] News diff: material events since last brief
- [ ] Risk flags: concentration, correlation matrix, earnings calendar
- [ ] Brief output UI: per-position status card with suggestion badge
- [ ] Broker API integration (post-MVP)
