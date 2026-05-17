"use client";

type PriorityAlert = {
  id: string;
  rawText: string;
  source: string;
  urgencyScore: number;
  sector: string;
  timestamp: string;
};

type PrioritySidebarProps = {
  alerts: PriorityAlert[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

function urgencyBadgeClass(score: number): string {
  if (score >= 5) return "bg-red-700 text-white";
  if (score >= 4) return "bg-orange-600 text-white";
  if (score >= 3) return "bg-amber-500 text-black";
  return "bg-zinc-300 text-black";
}

export function PrioritySidebar({ alerts, loading, error, onRetry }: PrioritySidebarProps) {
  return (
    <aside className="h-full rounded-lg border border-border bg-card p-4" aria-labelledby="priority-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="priority-title" className="text-base font-semibold text-foreground">
          Priority Sidebar
        </h2>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="space-y-3" aria-live="polite" aria-busy="true">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-500/60 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-100">Couldn&apos;t load priority alerts.</p>
          <p className="mt-1 text-xs text-red-100/90">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-red-300 px-3 text-sm font-medium text-red-100 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && alerts.length === 0 && (
        <div className="rounded-lg border border-border bg-background p-4 text-center">
          <p className="text-sm font-medium text-foreground">All caught up</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No verified high-priority alerts match this sector right now.
          </p>
        </div>
      )}

      {!loading && !error && alerts.length > 0 && (
        <ol className="space-y-3">
          {alerts.map((alert) => (
            <li key={alert.id} className="rounded-lg border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-bold ${urgencyBadgeClass(
                    alert.urgencyScore,
                  )}`}
                  aria-label={`Urgency score ${alert.urgencyScore}`}
                >
                  U{alert.urgencyScore}
                </span>
                <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                  {alert.sector}
                </span>
              </div>
              <p className="line-clamp-3 text-sm text-foreground">{alert.rawText}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Source: <span className="font-medium text-foreground">{alert.source}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(alert.timestamp).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
