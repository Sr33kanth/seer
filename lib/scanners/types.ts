// SSE event types streamed from /api/scan

export interface ScannerStartEvent {
  type: "scanner_start";
  id: string;
  name: string;
  description: string;
}

export interface ScannerLogEvent {
  type: "log";
  id: string;
  message: string;
}

export interface ScannerDoneEvent {
  type: "scanner_done";
  id: string;
  found: number;
  durationMs: number;
}

export interface ScannerErrorEvent {
  type: "scanner_error";
  id: string;
  error: string;
}

export interface SignalEvent {
  type: "signal";
  scanId: string;
  symbol: string;
  source: string;
  tags: string[];
  score: number;
  detail: string;
  url?: string;
}

export interface ScanCompleteEvent {
  type: "scan_complete";
  scanId: string;
  totalSignals: number;
  durationMs: number;
}

export type ScanEvent =
  | ScannerStartEvent
  | ScannerLogEvent
  | ScannerDoneEvent
  | ScannerErrorEvent
  | SignalEvent
  | ScanCompleteEvent;

// Helper passed into each scanner so it can emit events
export type Emit = (event: ScanEvent) => void;

export interface Signal {
  symbol: string;
  source: string;
  tags: string[];
  score: number;
  detail: string;
  url?: string;
}
