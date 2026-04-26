"use client";

import { useRef, useState } from "react";
import type { ScanEvent, SignalEvent } from "@/lib/scanners/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScannerStatus = "pending" | "running" | "done" | "error";

interface ScannerState {
  id: string;
  name: string;
  description: string;
  status: ScannerStatus;
  logs: string[];
  found: number;
  durationMs?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  "insider-cluster-buy": "#c084fc",
  "volume-spike":        "#f59e0b",
  "unusual-volume":      "#fbbf24",
  "52w-breakout":        "#4ade80",
  "momentum":            "#38bdf8",
  "reddit-buzz":         "#fb7185",
};

const SOURCE_LABEL: Record<string, string> = {
  edgar:  "EDGAR",
  volume: "Volume",
  reddit: "Reddit",
};

function scoreColor(score: number) {
  if (score >= 70) return "#4ade80";
  if (score >= 45) return "#facc15";
  return "#f87171";
}

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

// ─── Components ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ScannerStatus }) {
  const styles: Record<ScannerStatus, { bg: string; shadow?: string; animate?: boolean }> = {
    pending: { bg: "var(--text-muted)" },
    running: { bg: "#facc15", shadow: "0 0 6px #facc15", animate: true },
    done:    { bg: "#4ade80", shadow: "0 0 6px #4ade80" },
    error:   { bg: "#f87171" },
  };
  const s = styles[status];
  return (
    <span style={{
      width: 8, height: 8, borderRadius: "50%", display: "inline-block", flexShrink: 0,
      background: s.bg, boxShadow: s.shadow,
      animation: s.animate ? "pulse 1s ease-in-out infinite" : undefined,
    }} />
  );
}

function ScannerCard({ scanner, expanded, onToggle }: {
  scanner: ScannerState;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden" }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
      >
        <StatusDot status={scanner.status} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{scanner.name}</div>
          {scanner.status === "pending" && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{scanner.description}</div>
          )}
          {scanner.status === "running" && (
            <div style={{ fontSize: 12, color: "#facc15", marginTop: 2 }}>Running…</div>
          )}
          {scanner.status === "done" && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              {scanner.found} signal{scanner.found !== 1 ? "s" : ""} found
              {scanner.durationMs != null && <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>in {fmtMs(scanner.durationMs)}</span>}
            </div>
          )}
          {scanner.status === "error" && (
            <div style={{ fontSize: 12, color: "#f87171", marginTop: 2 }}>Failed</div>
          )}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-muted)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s", display: "inline-block" }}>▾</span>
      </div>

      {/* Log lines */}
      {expanded && scanner.logs.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "10px 18px 12px", background: "var(--bg)" }}>
          <div style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            {scanner.logs.map((line, i) => (
              <div key={i} style={{ color: line.startsWith("  ✦") ? "#4ade80" : line.startsWith("  ✗") ? "#f87171" : "var(--text-secondary)" }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SignalRow({ signal, onAdd, adding, added }: {
  signal: SignalEvent;
  onAdd: () => void;
  adding: boolean;
  added: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      {/* Score */}
      <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--bg)", border: `1px solid ${scoreColor(signal.score)}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--font-space-mono)", fontSize: 12, fontWeight: 700, color: scoreColor(signal.score) }}>{signal.score}</span>
      </div>

      {/* Symbol + detail */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontFamily: "var(--font-space-mono)", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{signal.symbol}</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 6px", letterSpacing: "0.06em" }}>
            {SOURCE_LABEL[signal.source] ?? signal.source}
          </span>
          {signal.tags.map(tag => (
            <span key={tag} style={{ fontSize: 10, color: TAG_COLORS[tag] ?? "var(--text-secondary)", border: `1px solid ${(TAG_COLORS[tag] ?? "#6b7a90")}40`, borderRadius: 3, padding: "1px 6px", letterSpacing: "0.05em" }}>
              {tag}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{signal.detail}</div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {signal.url && (
          <a href={signal.url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 10px", textDecoration: "none", letterSpacing: "0.04em" }}>
            Source ↗
          </a>
        )}
        <button
          onClick={onAdd}
          disabled={adding || added}
          style={{ fontSize: 11, background: added ? "transparent" : "var(--gold)", color: added ? "var(--text-muted)" : "#060910", border: added ? "1px solid var(--border)" : "none", borderRadius: 4, padding: "5px 12px", cursor: added ? "default" : "pointer", fontWeight: 600, letterSpacing: "0.04em", transition: "all 0.15s" }}
        >
          {added ? "Added ✓" : adding ? "Adding…" : "+ Watchlist"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const SCANNER_IDS = ["edgar", "volume", "reddit"];

export default function ScanPage() {
  const [scanning, setScanning] = useState(false);
  const [scanners, setScanners] = useState<Record<string, ScannerState>>({});
  const [signals, setSignals] = useState<SignalEvent[]>([]);
  const [summary, setSummary] = useState<{ totalSignals: number; durationMs: number } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<Record<string, boolean>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const esRef = useRef<EventSource | null>(null);

  function updateScanner(id: string, patch: Partial<ScannerState>) {
    setScanners(prev => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  function appendLog(id: string, message: string) {
    setScanners(prev => ({
      ...prev,
      [id]: { ...prev[id], logs: [...(prev[id]?.logs ?? []), message] },
    }));
    // Auto-expand running scanner
    setExpanded(prev => ({ ...prev, [id]: true }));
  }

  function startScan() {
    if (scanning) return;

    // Reset state
    setScanning(true);
    setSignals([]);
    setSummary(null);
    setAdded({});
    setScanners({});
    setExpanded({});

    esRef.current?.close();
    const es = new EventSource("/api/scan");
    esRef.current = es;

    es.onmessage = (e) => {
      const event: ScanEvent = JSON.parse(e.data);

      if (event.type === "scanner_start") {
        setScanners(prev => ({
          ...prev,
          [event.id]: { id: event.id, name: event.name, description: event.description, status: "running", logs: [], found: 0 },
        }));
        setExpanded(prev => ({ ...prev, [event.id]: true }));
      } else if (event.type === "log") {
        appendLog(event.id, event.message);
      } else if (event.type === "scanner_done") {
        updateScanner(event.id, { status: "done", found: event.found, durationMs: event.durationMs });
      } else if (event.type === "scanner_error") {
        updateScanner(event.id, { status: "error" });
        appendLog(event.id, `Error: ${event.error}`);
      } else if (event.type === "signal") {
        setSignals(prev => [...prev, event as SignalEvent]);
      } else if (event.type === "scan_complete") {
        setSummary({ totalSignals: event.totalSignals, durationMs: event.durationMs });
        setScanning(false);
        es.close();
      }
    };

    es.onerror = () => {
      setScanning(false);
      es.close();
    };
  }

  async function addToWatchlist(symbol: string) {
    setAdding(prev => ({ ...prev, [symbol]: true }));
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      setAdded(prev => ({ ...prev, [symbol]: true }));
    } finally {
      setAdding(prev => ({ ...prev, [symbol]: false }));
    }
  }

  const scannerList = SCANNER_IDS.map(id => scanners[id]).filter(Boolean);
  const signalsBySource: Record<string, SignalEvent[]> = {};
  for (const s of signals) {
    (signalsBySource[s.source] ??= []).push(s);
  }

  return (
    <div style={{ minHeight: "100vh", fontFamily: "var(--font-outfit), system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border-subtle)", padding: "0 32px", display: "flex", alignItems: "center", height: 56, gap: 16, flexShrink: 0 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", boxShadow: "0 0 8px var(--gold)" }} />
          <span style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 22, fontWeight: 300, color: "var(--text)", letterSpacing: "-0.01em" }}>Seer</span>
        </a>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/</span>
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Signal Scanner</span>
        <div style={{ flex: 1 }} />
        <a href="/" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", letterSpacing: "0.04em" }}>← Watchlist</a>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 32px 80px" }}>
        {/* Title + run button */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 36, fontWeight: 300, color: "var(--text)", margin: "0 0 6px", letterSpacing: "-0.02em" }}>Signal Scanner</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              Aggregates insider filings, volume breakouts, and community mentions into a ranked opportunity list.
            </p>
          </div>
          <button
            onClick={startScan}
            disabled={scanning}
            style={{ background: scanning ? "transparent" : "var(--gold)", border: scanning ? "1px solid var(--border)" : "none", color: scanning ? "var(--text-muted)" : "#060910", borderRadius: 7, padding: "12px 28px", fontSize: 14, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: scanning ? "not-allowed" : "pointer", transition: "all 0.2s", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {scanning ? "Scanning…" : signals.length > 0 ? "↺ Re-run" : "▶ Run Scan"}
          </button>
        </div>

        {/* Scanner steps */}
        {scannerList.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>Scanners</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {scannerList.map(scanner => (
                <ScannerCard
                  key={scanner.id}
                  scanner={scanner}
                  expanded={expanded[scanner.id] ?? false}
                  onToggle={() => setExpanded(prev => ({ ...prev, [scanner.id]: !prev[scanner.id] }))}
                />
              ))}
            </div>
          </div>
        )}

        {/* Idle state */}
        {!scanning && signals.length === 0 && scannerList.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
            <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 20, fontStyle: "italic", fontWeight: 300, color: "var(--text-secondary)", marginBottom: 10 }}>
              No scan run yet
            </div>
            <div style={{ fontSize: 13 }}>Hit Run Scan to start aggregating signals.</div>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 6, maxWidth: 380, margin: "24px auto 0", textAlign: "left" }}>
              {[
                { label: "SEC EDGAR — Form 4", desc: "Insider cluster buys (3+ insiders, same company, 7 days)" },
                { label: "Volume & Breakout", desc: "Unusual volume + 52-week highs across ~120 liquid tickers" },
                { label: "Reddit", desc: "Engagement-weighted ticker mentions from curated subreddits" },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", gap: 10, padding: "10px 14px", background: "var(--surface)", borderRadius: 7, border: "1px solid var(--border-subtle)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--border)", marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text)" }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {signals.length > 0 && (
          <div>
            {summary && (
              <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {summary.totalSignals} signals · {fmtMs(summary.durationMs)}
                </div>
                <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
              </div>
            )}

            {/* Group by source */}
            {["edgar", "volume", "reddit"].map(src => {
              const group = signalsBySource[src];
              if (!group?.length) return null;
              return (
                <div key={src} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
                    {src === "edgar" ? "SEC EDGAR — Insider Cluster Buys" : src === "volume" ? "Volume & Breakout" : "Reddit — Community Signals"}
                    <span style={{ marginLeft: 8, color: "var(--text-muted)", fontFamily: "var(--font-space-mono)" }}>{group.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {group
                      .sort((a, b) => b.score - a.score)
                      .map(sig => (
                        <SignalRow
                          key={`${sig.symbol}-${sig.source}`}
                          signal={sig}
                          onAdd={() => addToWatchlist(sig.symbol)}
                          adding={adding[sig.symbol] ?? false}
                          added={added[sig.symbol] ?? false}
                        />
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
