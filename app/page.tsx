"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RichQuote } from "@/lib/yahoo";

// ─── Types ───────────────────────────────────────────────────────────────────

type WatchlistItem = { symbol: string; added_at: number };
type QuoteMap = Record<string, RichQuote>;
type JobStatus = "running" | "done" | "error";
interface Job {
  id: string;
  label: string;
  status: JobStatus;
  ts: Date;
  detail?: string;
}
interface SystemStatus {
  status: string;
  checks: Record<string, { ok: boolean; detail?: string }>;
  serverTime: string;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtPrice(n?: number) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n?: number, decimals = 2) {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}
function fmtLarge(n?: number) {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}
function fmtVol(n?: number) {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}
function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        {label}
      </span>
      <span style={{
        fontFamily: "var(--font-space-mono), monospace",
        fontSize: 13,
        color: color ?? "var(--text)",
        fontWeight: 400,
      }}>
        {value}
      </span>
    </div>
  );
}

function WeekRange({ low, high, current }: { low?: number; high?: number; current?: number }) {
  if (!low || !high || !current) return <Stat label="52W Range" value="—" />;
  const pct = Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        52W Range
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-space-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {fmtPrice(low)}
        </span>
        <div style={{ flex: 1, height: 3, background: "var(--border)", borderRadius: 2, position: "relative", minWidth: 60 }}>
          <div style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${pct}%`,
            background: "var(--gold-dim)",
            borderRadius: 2,
          }} />
          <div style={{
            position: "absolute",
            top: "50%",
            left: `${pct}%`,
            transform: "translate(-50%, -50%)",
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--gold)",
            boxShadow: "0 0 4px var(--gold)",
          }} />
        </div>
        <span style={{ fontFamily: "var(--font-space-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {fmtPrice(high)}
        </span>
      </div>
    </div>
  );
}

function TickerCard({
  item,
  quote,
  removing,
  isNew,
  onRemove,
}: {
  item: WatchlistItem;
  quote?: RichQuote;
  removing: boolean;
  isNew: boolean;
  onRemove: () => void;
}) {
  const q = quote;
  const isUp = (q?.changePct ?? 0) > 0;
  const isDown = (q?.changePct ?? 0) < 0;
  const changeColor = !q || q.error
    ? "var(--text-muted)"
    : isUp ? "#4ade80" : isDown ? "#f87171" : "var(--text-secondary)";

  const extPrice = q?.marketState === "PRE" ? q.prePrice : q?.marketState !== "REGULAR" ? q?.postPrice : undefined;
  const extChangePct = q?.marketState === "PRE" ? q.preChangePct : q?.marketState !== "REGULAR" ? q?.postChangePct : undefined;
  const extLabel = q?.marketState === "PRE" ? "Pre-market" : q?.marketState === "POST" || q?.marketState === "CLOSED" ? "After-hours" : null;

  return (
    <li
      className={isNew ? "animate-in" : ""}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
        opacity: removing ? 0.3 : 1,
        transition: "opacity 0.2s, border-color 0.15s",
      }}
    >
      {/* Top row: symbol, name, price, change */}
      <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", gap: 16, borderBottom: q && !q.error ? "1px solid var(--border-subtle)" : "none" }}>
        <span style={{ width: 3, height: 40, borderRadius: 2, background: changeColor, flexShrink: 0, transition: "background 0.4s" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: 17, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text)" }}>
            {item.symbol}
          </div>
          {q && !q.error && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {q.longName ?? q.shortName}
              {q.exchangeName && <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: 11 }}>{q.exchangeName}</span>}
            </div>
          )}
          {!q && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Fetching…</div>}
          {q?.error && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 2 }}>Data unavailable</div>}
        </div>

        {/* Price block */}
        {q && !q.error && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
              {q.currency === "USD" ? "$" : ""}{fmtPrice(q.price)}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 2, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-space-mono)", fontSize: 13, color: changeColor, fontWeight: 700 }}>
                {fmtPct(q.changePct)}
              </span>
              <span style={{ fontFamily: "var(--font-space-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
                {q.change != null ? `${q.change >= 0 ? "+" : ""}${fmtPrice(q.change)}` : ""}
              </span>
              {q.marketState && q.marketState !== "REGULAR" && (
                <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 5px", color: "var(--text-muted)" }}>
                  {q.marketState === "CLOSED" || q.marketState === "POST" ? "Closed" : q.marketState === "PRE" ? "Pre" : q.marketState}
                </span>
              )}
            </div>
            {/* Extended hours price */}
            {extPrice != null && extLabel && (
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-space-mono)" }}>
                {extLabel}: ${fmtPrice(extPrice)}{" "}
                <span style={{ color: (extChangePct ?? 0) >= 0 ? "#4ade80" : "#f87171" }}>
                  {fmtPct(extChangePct)}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onRemove}
          disabled={removing}
          title={`Remove ${item.symbol}`}
          style={{ background: "none", border: "1px solid transparent", borderRadius: 4, color: "var(--text-muted)", cursor: "pointer", padding: "6px 10px", fontSize: 12, transition: "all 0.15s", flexShrink: 0 }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "var(--danger)"; (e.target as HTMLElement).style.borderColor = "rgba(217,95,95,0.3)"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "var(--text-muted)"; (e.target as HTMLElement).style.borderColor = "transparent"; }}
        >
          Remove
        </button>
      </div>

      {/* Stats grid */}
      {q && !q.error && (
        <div style={{ padding: "14px 20px 14px 39px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "14px 24px" }}>
          <Stat label="Open" value={`$${fmtPrice(q.open)}`} />
          <Stat label="Prev Close" value={`$${fmtPrice(q.prevClose)}`} />
          <Stat label="Day High" value={`$${fmtPrice(q.dayHigh)}`} color="#4ade80" />
          <Stat label="Day Low" value={`$${fmtPrice(q.dayLow)}`} color="#f87171" />
          <Stat label="Volume" value={fmtVol(q.volume)} />
          <Stat label="Avg Vol" value={fmtVol(q.avgVolume)} />
          <Stat label="Market Cap" value={fmtLarge(q.marketCap)} />
          <Stat label="P/E (TTM)" value={q.trailingPE != null ? `${q.trailingPE.toFixed(1)}×` : "—"} />
          <Stat label="P/E (Fwd)" value={q.forwardPE != null ? `${q.forwardPE.toFixed(1)}×` : "—"} />
          <Stat label="EPS (TTM)" value={q.eps != null ? `$${q.eps.toFixed(2)}` : "—"} />
          <Stat label="Beta" value={q.beta != null ? q.beta.toFixed(2) : "—"} />
          <Stat label="Div Yield" value={q.dividendYield != null ? fmtPct(q.dividendYield, 2) : "—"} color={q.dividendYield ? "var(--gold)" : undefined} />
          <Stat label="50D Avg" value={q.fiftyDayAvg != null ? `$${fmtPrice(q.fiftyDayAvg)}` : "—"} />
          <Stat label="200D Avg" value={q.twoHundredDayAvg != null ? `$${fmtPrice(q.twoHundredDayAvg)}` : "—"} />
          <Stat label="P/B Ratio" value={q.priceToBook != null ? `${q.priceToBook.toFixed(2)}×` : "—"} />
          <Stat label="Profit Margin" value={q.profitMargins != null ? fmtPct(q.profitMargins) : "—"} />
          {/* 52W range spans full width */}
          <div style={{ gridColumn: "1 / -1" }}>
            <WeekRange low={q.fiftyTwoWeekLow} high={q.fiftyTwoWeekHigh} current={q.price} />
          </div>
          {q.weekChange52 != null && (
            <Stat label="52W Change" value={fmtPct(q.weekChange52)} color={(q.weekChange52 ?? 0) >= 0 ? "#4ade80" : "#f87171"} />
          )}
          {q.insiderPct != null && <Stat label="Insider %" value={fmtPct(q.insiderPct)} />}
          {q.institutionPct != null && <Stat label="Institution %" value={fmtPct(q.institutionPct)} />}
          {q.shortRatio != null && <Stat label="Short Ratio" value={q.shortRatio.toFixed(1)} />}
          {q.pegRatio != null && <Stat label="PEG Ratio" value={q.pegRatio.toFixed(2)} />}
        </div>
      )}
    </li>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

let jobCounter = 0;
function makeJob(label: string, status: JobStatus, detail?: string): Job {
  return { id: String(++jobCounter), label, status, ts: new Date(), detail };
}

export default function Home() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [newSymbol, setNewSymbol] = useState<string | null>(null);
  const [nextRefresh, setNextRefresh] = useState(60);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setTick] = useState(0); // forces re-render for timeAgo

  function addJob(j: Job) {
    setJobs(prev => [j, ...prev].slice(0, 20));
  }
  function updateJob(id: string, patch: Partial<Job>) {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));
  }

  const fetchQuotes = useCallback(async (symbols: string[], trigger = "refresh") => {
    if (symbols.length === 0) return;
    const job = makeJob(`Fetching quotes: ${symbols.join(", ")}`, "running");
    addJob(job);
    try {
      const res = await fetch(`/api/quotes?symbols=${symbols.join(",")}`);
      if (res.ok) {
        const data: QuoteMap = await res.json();
        setQuotes(prev => ({ ...prev, ...data }));
        updateJob(job.id, { status: "done", detail: `${symbols.length} symbol${symbols.length > 1 ? "s" : ""} via Yahoo Finance`, ts: new Date() });
      } else {
        updateJob(job.id, { status: "error", detail: `HTTP ${res.status}` });
      }
    } catch (e) {
      updateJob(job.id, { status: "error", detail: String(e) });
    }
    setNextRefresh(60);
    void trigger;
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) setSysStatus(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchWatchlist = useCallback(async () => {
    const job = makeJob("Loading watchlist from DB", "running");
    addJob(job);
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) {
        const data: WatchlistItem[] = await res.json();
        setItems(data);
        updateJob(job.id, { status: "done", detail: `${data.length} symbol${data.length !== 1 ? "s" : ""}` });
        if (data.length > 0) fetchQuotes(data.map(d => d.symbol), "initial");
      } else {
        updateJob(job.id, { status: "error", detail: `HTTP ${res.status}` });
      }
    } catch (e) {
      updateJob(job.id, { status: "error", detail: String(e) });
    }
  }, [fetchQuotes]);

  useEffect(() => {
    fetchWatchlist();
    fetchStatus();
  }, [fetchWatchlist, fetchStatus]);

  // Countdown + auto-refresh
  useEffect(() => {
    const id = setInterval(() => {
      setNextRefresh(n => {
        if (n <= 1) {
          if (items.length > 0 && document.visibilityState === "visible") {
            fetchQuotes(items.map(i => i.symbol), "auto");
          }
          return 60;
        }
        return n - 1;
      });
      setTick(t => t + 1); // re-render for timeAgo
    }, 1000);
    return () => clearInterval(id);
  }, [items, fetchQuotes]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const symbol = input.trim().toUpperCase();
    if (!symbol) return;
    setAdding(true);
    setError("");
    const job = makeJob(`Adding ${symbol} to watchlist`, "running");
    addJob(job);
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    setAdding(false);
    if (res.ok) {
      updateJob(job.id, { status: "done" });
      setInput("");
      setNewSymbol(symbol);
      await fetchWatchlist();
      setTimeout(() => setNewSymbol(null), 1200);
      inputRef.current?.focus();
    } else {
      const body = await res.json();
      const msg = body.error === "already in watchlist" ? "Already tracking this symbol." : (body.error ?? "Failed to add");
      setError(msg);
      updateJob(job.id, { status: "error", detail: msg });
    }
  }

  async function handleRemove(symbol: string) {
    setRemoving(symbol);
    const job = makeJob(`Removing ${symbol}`, "running");
    addJob(job);
    await fetch(`/api/watchlist/${symbol}`, { method: "DELETE" });
    setItems(prev => prev.filter(i => i.symbol !== symbol));
    setQuotes(prev => { const n = { ...prev }; delete n[symbol]; return n; });
    updateJob(job.id, { status: "done" });
    setRemoving(null);
  }

  const count = items.length;
  const statusColor = sysStatus?.status === "ok" ? "#4ade80" : sysStatus?.status === "degraded" ? "#facc15" : "var(--text-muted)";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "var(--font-outfit), system-ui, sans-serif" }}>

      {/* ── Top bar ── */}
      <header style={{ borderBottom: "1px solid var(--border-subtle)", padding: "0 32px", display: "flex", alignItems: "center", height: 56, gap: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", boxShadow: "0 0 8px var(--gold)", flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 22, fontWeight: 300, color: "var(--text)", letterSpacing: "-0.01em" }}>Seer</span>
        </div>
        <div style={{ flex: 1 }} />
        {/* System status pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, transition: "background 0.3s" }} />
          <span>{sysStatus ? (sysStatus.status === "ok" ? "All systems operational" : "Degraded") : "Checking…"}</span>
        </div>
        <div style={{ width: 1, height: 20, background: "var(--border)" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-space-mono)" }}>
          {count} watching
        </span>
      </header>

      {/* ── Body: main + sidebar ── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 300px", gap: 0 }}>

        {/* ── LEFT: Watchlist ── */}
        <main style={{ padding: "32px 32px 64px", borderRight: "1px solid var(--border-subtle)", minWidth: 0 }}>

          {/* Page title + add form */}
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 38, fontWeight: 300, color: "var(--text)", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
              Watchlist
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 24px", letterSpacing: "0.02em" }}>
              Track any public stock, ETF, or index. Data refreshes every 60 seconds.
            </p>

            <form onSubmit={handleAdd} style={{ display: "flex", gap: 10 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => { setInput(e.target.value.toUpperCase()); setError(""); }}
                placeholder="Add symbol — AAPL, NVDA, BTC-USD…"
                autoFocus
                style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "11px 14px", fontSize: 14, fontFamily: "var(--font-space-mono), monospace", color: "var(--text)", outline: "none", letterSpacing: "0.04em", transition: "border-color 0.2s, box-shadow 0.2s" }}
                onFocus={e => { e.target.style.borderColor = "var(--gold-dim)"; e.target.style.boxShadow = "0 0 0 3px var(--gold-glow)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
              />
              <button
                type="submit"
                disabled={adding || !input.trim()}
                style={{ background: input.trim() && !adding ? "var(--gold)" : "transparent", border: "1px solid", borderColor: input.trim() && !adding ? "var(--gold)" : "var(--border)", color: input.trim() && !adding ? "#060910" : "var(--text-muted)", borderRadius: 6, padding: "11px 22px", fontSize: 13, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", cursor: input.trim() && !adding ? "pointer" : "not-allowed", transition: "all 0.2s", whiteSpace: "nowrap" }}
              >
                {adding ? "Adding…" : "Track"}
              </button>
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => fetchQuotes(items.map(i => i.symbol), "manual")}
                  title="Refresh prices now"
                  style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "11px 14px", fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = "var(--gold-dim)"; (e.target as HTMLElement).style.color = "var(--gold)"; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = "var(--border)"; (e.target as HTMLElement).style.color = "var(--text-secondary)"; }}
                >
                  ↺ Refresh <span style={{ fontFamily: "var(--font-space-mono)", fontSize: 11, opacity: 0.7 }}>{nextRefresh}s</span>
                </button>
              )}
            </form>
            {error && <p style={{ marginTop: 8, fontSize: 13, color: "var(--danger)" }}>{error}</p>}
          </div>

          {/* Ticker list */}
          {count === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }} className="animate-fade">
              <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 22, fontStyle: "italic", fontWeight: 300, color: "var(--text-secondary)", marginBottom: 8 }}>
                Your watchlist is empty
              </div>
              <div style={{ fontSize: 13 }}>Add a ticker above to start tracking</div>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((item, i) => (
                <TickerCard
                  key={item.symbol}
                  item={item}
                  quote={quotes[item.symbol]}
                  removing={removing === item.symbol}
                  isNew={item.symbol === newSymbol}
                  onRemove={() => handleRemove(item.symbol)}
                />
              ))}
            </ul>
          )}
        </main>

        {/* ── RIGHT: Sidebar ── */}
        <aside style={{ padding: "32px 24px", display: "flex", flexDirection: "column", gap: 32, overflowY: "auto" }}>

          {/* System Status */}
          <section>
            <h2 style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 14px", fontWeight: 400 }}>
              System Status
            </h2>
            {sysStatus ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(sysStatus.checks).map(([key, val]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: val.ok ? "#4ade80" : "#f87171", flexShrink: 0, boxShadow: val.ok ? "0 0 6px #4ade80" : "none" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--text)", textTransform: "capitalize" }}>
                        {key === "yahooFinance" ? "Yahoo Finance" : key === "ai" ? "AI (Anthropic)" : key === "db" ? "Database" : key}
                      </div>
                      {val.detail && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {val.detail}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: val.ok ? "#4ade80" : "#f87171" }}>{val.ok ? "OK" : "FAIL"}</span>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, textAlign: "right" }}>
                  Checked {timeAgo(new Date(sysStatus.serverTime))}
                  {" · "}
                  <button onClick={fetchStatus} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline" }}>
                    Recheck
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</div>
            )}
          </section>

          {/* Jobs */}
          <section>
            <h2 style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 14px", fontWeight: 400, display: "flex", justifyContent: "space-between" }}>
              <span>Activity Log</span>
              {jobs.length > 0 && (
                <button onClick={() => setJobs([])} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 10, padding: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Clear
                </button>
              )}
            </h2>
            {jobs.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>No activity yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {jobs.map(job => (
                  <div key={job.id} style={{ display: "flex", gap: 10, padding: "9px 12px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border-subtle)", alignItems: "flex-start" }}>
                    <span style={{ marginTop: 1, fontSize: 13, lineHeight: 1, flexShrink: 0 }}>
                      {job.status === "running" ? "⋯" : job.status === "done" ? "✓" : "✗"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {job.label}
                      </div>
                      {job.detail && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{job.detail}</div>}
                    </div>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }}>{timeAgo(job.ts)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Suggestions */}
          <section>
            <h2 style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 14px", fontWeight: 400 }}>
              AI Suggestions
            </h2>
            {sysStatus?.checks?.ai?.ok ? (
              <div style={{ padding: "14px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)", borderLeft: "3px solid var(--gold)" }}>
                <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 6 }}>Ready to analyze</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Seer can analyze your {count} watched symbol{count !== 1 ? "s" : ""} and surface patterns, valuation signals, and momentum cues.
                </div>
                <button style={{ marginTop: 12, width: "100%", background: "var(--gold)", border: "none", borderRadius: 4, color: "#060910", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "9px", cursor: "pointer" }}>
                  Run Analysis →
                </button>
              </div>
            ) : (
              <div style={{ padding: "14px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 6 }}>
                  Not yet configured
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 10 }}>
                  Seer uses Claude (Anthropic) to analyse your watchlist and surface:
                </div>
                <ul style={{ margin: "0 0 12px", padding: "0 0 0 16px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8, listStyleType: "disc" }}>
                  <li>Valuation signals (P/E vs sector)</li>
                  <li>Momentum & trend analysis</li>
                  <li>Risk flags (beta, short interest)</li>
                  <li>Earnings calendar alerts</li>
                  <li>Buy / hold / watch suggestions</li>
                </ul>
                <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "10px 12px", background: "var(--bg)", borderRadius: 4, fontFamily: "var(--font-space-mono)", lineHeight: 1.6 }}>
                  Set ANTHROPIC_API_KEY in your<br />.env.local to enable
                </div>
              </div>
            )}
          </section>

        </aside>
      </div>
    </div>
  );
}
