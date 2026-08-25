"use client";

import { AnimatePresence, motion } from "framer-motion";

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

function badgeColor(alert: PriorityAlert): string {
  const label = incidentLabel(alert);
  if (alert.urgencyScore >= 5 || label === "Terrorism") return "bg-red-500/10 text-red-400 border-red-500/30";
  if (label === "Flood") return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  return "bg-primary/10 text-primary border-primary/30";
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

const variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: Math.min(i * 0.04, 0.32), type: "spring" as const, stiffness: 280, damping: 24 },
  }),
};

function Skeleton({ delay }: { delay: number }) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      custom={delay}
      className="rounded-lg border border-border bg-card p-3"
    >
      <div className="h-4 w-24 rounded bg-muted/60 animate-pulse" />
      <div className="mt-3 h-5 w-full rounded bg-muted/40 animate-pulse" />
      <div className="mt-4 h-2 w-full rounded bg-muted/40 animate-pulse" />
    </motion.div>
  );
}

export function PrioritySidebar({ alerts, loading, error, selectedAlertId, onRetry, onSelect, timeAgo }: PrioritySidebarProps) {
  return (
    <motion.aside
      layout
      className="relative z-20 flex flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl lg:static lg:z-auto lg:max-h-none lg:rounded-none lg:border-r lg:border-t-0 lg:shadow-none"
      aria-labelledby="priority-title"
      initial={false}
    >
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 p-3"
              aria-live="polite"
              aria-busy="true"
            >
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} delay={idx * 0.06} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!loading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="m-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"
            >
              <p className="text-sm font-medium text-amber-300">Live stream degraded.</p>
              <p className="mt-1 text-xs text-amber-300/70">{error}</p>
              {alerts.length === 0 && (
                <motion.button
                  type="button"
                  onClick={onRetry}
                  whileTap={{ scale: 0.96 }}
                  className="mt-3 rounded-md border border-amber-500/40 px-3 py-2 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Retry
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!loading && !error && alerts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="m-3 rounded-lg border border-border bg-background p-4 text-center"
          >
            <p className="text-sm font-medium text-foreground">No matching alerts</p>
            <p className="mt-1 text-xs text-muted-foreground">Clear filters or enable simulation mode.</p>
          </motion.div>
        )}

        {!loading && !error && alerts.length > 0 && (
          <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Alert Feed</p>
              <h2 id="priority-title" className="text-sm font-semibold text-foreground">
                Active Incidents <span className="text-muted-foreground">· {alerts.length}</span>
              </h2>
            </div>
            <motion.button
              type="button"
              onClick={onRetry}
              whileTap={{ scale: 0.94 }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Refresh
            </motion.button>
          </div>
        )}

        {!loading && !error && alerts.length > 0 && (
          <motion.ol
            className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 lg:max-h-[calc(100vh-200px)]"
            initial={false}
          >
            <AnimatePresence mode="popLayout">
              {alerts.map((alert, index) => (
                <motion.li
                  key={alert.id}
                  layout
                  variants={variants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                  custom={index}
                >
                  <motion.button
                    type="button"
                    onClick={() => onSelect(alert.id)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      selectedAlertId === alert.id
                        ? "border-primary bg-primary/8 shadow-sm shadow-primary/5"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeColor(alert)}`}
                      >
                        {incidentLabel(alert)}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">{timeAgo(alert.timestamp)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-5 text-foreground">{headline(alert)}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{alert.rawText}</p>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="tabular-nums">
                        U<span className="font-semibold text-foreground">{alert.urgencyScore}</span>
                      </span>
                      <span className="tabular-nums">
                        <span className="font-semibold text-foreground">${raised(alert).toLocaleString()}</span> / ${target(alert).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`Funding ${progress(alert)}%`}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background:
                            progress(alert) >= 80
                              ? "linear-gradient(90deg, oklch(0.65 0.15 140), oklch(0.55 0.18 140))"
                            : progress(alert) >= 40
                              ? "linear-gradient(90deg, oklch(0.70 0.12 35), oklch(0.62 0.14 35))"
                              : "linear-gradient(90deg, oklch(0.70 0.12 35), oklch(0.58 0.16 15))",
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress(alert)}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </motion.button>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ol>
        )}
      </div>
    </motion.aside>
  );
}
