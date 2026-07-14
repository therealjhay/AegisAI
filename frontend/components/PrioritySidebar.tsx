"use client";

import { useRef, useState } from "react";

import type { PriorityAlert } from "@/components/CommandCenter";

type PrioritySidebarProps = {
  alerts: PriorityAlert[];
  loading: boolean;
  error: string | null;
  selectedAlertId: string | null;
  onRetry: () => void;
  onSelect: (alertId: string) => void;
  timeAgo: (timestamp: string) => string;
};

function incidentLabel(alert: PriorityAlert): string {
  const text = `${alert.incidentType ?? ""} ${alert.rawText} ${alert.sector}`.toLowerCase();
  if (/(terror|attack|armed|explosion|bomb|gun|militant|kidnap)/.test(text)) return "Terrorism";
  if (/(flood|earthquake|fire|storm|landslide|disaster|drought)/.test(text)) return "Flood";
  return alert.sector || "General";
}

function badgeClass(alert: PriorityAlert): string {
  const label = incidentLabel(alert);
  if (alert.urgencyScore >= 5 || label === "Terrorism") return "border-red-500 bg-red-600 text-white";
  if (label === "Flood") return "border-amber-500 bg-amber-600 text-black";
  return "border-emerald-500 bg-emerald-600 text-white";
}

function headline(alert: PriorityAlert): string {
  const text = alert.rawText.replace(/\s+/g, " ").trim();
  if (text.length <= 46) return text;
  const location = text.match(/near ([^.]+)/i)?.[1] ?? text.split(/[,.]/)[0];
  if (/medical|evac/i.test(text)) return `Medical Evac: ${location.slice(0, 32)}`;
  if (/attack|armed|terror/i.test(text)) return `Security Incident: ${location.slice(0, 30)}`;
  if (/flood|water/i.test(text)) return `Flood Response: ${location.slice(0, 32)}`;
  return `${text.slice(0, 43)}...`;
}

function target(alert: PriorityAlert): number {
  return Math.max(alert.financialTargetUSD ?? 100000, 1);
}

function raised(alert: PriorityAlert): number {
  const fallback = Math.max(target(alert) - (alert.fundingDeficit ?? 68000), 0);
  return Math.min(alert.financialRaisedUSD ?? fallback, target(alert));
}

function progress(alert: PriorityAlert): number {
  return Math.round((raised(alert) / target(alert)) * 100);
}

export function PrioritySidebar({ alerts, loading, error, selectedAlertId, onRetry, onSelect, timeAgo }: PrioritySidebarProps) {
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const dragStartY = useRef<number | null>(null);

  const finishDrag = (clientY: number) => {
    if (dragStartY.current === null) return;
    const delta = clientY - dragStartY.current;
    if (Math.abs(delta) > 24) setSheetExpanded(delta < 0);
    dragStartY.current = null;
  };

  return (
    <aside
      className={`triage-sheet fixed inset-x-0 bottom-0 z-20 overflow-hidden rounded-t-lg border-t border-border bg-card shadow-2xl lg:relative lg:inset-auto lg:z-auto lg:max-h-none lg:rounded-none lg:border-r lg:border-t-0 lg:shadow-none ${
        sheetExpanded ? "max-h-[82vh]" : "max-h-[58vh]"
      }`}
      aria-labelledby="priority-title"
    >
      <button
        type="button"
        className="sheet-handle flex h-11 w-full items-center justify-center lg:hidden"
        aria-label={sheetExpanded ? "Collapse alert sheet" : "Expand alert sheet"}
        onClick={() => setSheetExpanded((value) => !value)}
        onPointerDown={(event) => { dragStartY.current = event.clientY; }}
        onPointerUp={(event) => finishDrag(event.clientY)}
        onPointerCancel={() => { dragStartY.current = null; }}
      >
        <span className="h-1.5 w-12 rounded-full bg-muted" aria-hidden="true" />
      </button>
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Command Feed</p>
          <h2 id="priority-title" className="text-base font-semibold text-foreground">Priority Triage</h2>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="tactical-button h-11 min-w-11 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Refresh
        </button>
      </div>

      <div
        className={`overflow-y-auto p-3 lg:h-[calc(100vh-143px)] lg:max-h-none ${
          sheetExpanded ? "max-h-[calc(82vh-110px)]" : "max-h-[calc(58vh-110px)]"
        }`}
      >
        {loading && (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-background p-3">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-5 w-full animate-pulse rounded bg-muted" />
                <div className="mt-4 h-2 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mb-3 rounded-lg border border-amber-500/60 bg-amber-500/10 p-3">
            <p className="text-sm font-medium text-amber-100">Live stream degraded.</p>
            <p className="mt-1 text-xs text-amber-100/90">{error}</p>
            {alerts.length === 0 && (
              <button
                type="button"
                onClick={onRetry}
                className="tactical-button mt-3 h-11 rounded-md border border-amber-300 px-3 text-sm font-medium text-amber-100 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {!loading && alerts.length === 0 && (
          <div className="rounded-lg border border-border bg-background p-4 text-center">
            <p className="text-sm font-medium text-foreground">No matching alerts</p>
            <p className="mt-1 text-xs text-muted-foreground">Clear filters or enable simulation mode.</p>
          </div>
        )}

        {!loading && alerts.length > 0 && (
          <ol className="space-y-3">
            {alerts.map((alert, index) => (
              <li key={alert.id} className="feed-entry" style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}>
                <button
                  type="button"
                  onClick={() => onSelect(alert.id)}
                  className={`alert-card w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    selectedAlertId === alert.id ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex min-h-8 items-center rounded-md border px-2 text-xs font-bold ${badgeClass(alert)}`}>
                      {incidentLabel(alert)}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{timeAgo(alert.timestamp)}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-5 text-foreground">{headline(alert)}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{alert.rawText}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>U{alert.urgencyScore} priority</span>
                    <span>${raised(alert).toLocaleString()} / ${target(alert).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-label={`Funding ${progress(alert)} percent complete`}>
                    <div className="funding-fill h-full rounded-full bg-emerald-500" style={{ width: `${progress(alert)}%` }} />
                  </div>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
