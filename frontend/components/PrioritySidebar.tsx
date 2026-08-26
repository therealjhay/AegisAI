"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { PriorityAlert } from "@/components/CommandCenter";
import { IconRefresh } from "@/components/icons";

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
  if (alert.urgencyScore >= 5 || label === "Terrorism") return "border-red-500/40 text-red-400";
  if (label === "Flood") return "border-sky-500/40 text-sky-400";
  return "border-signal-bright/40 text-signal-bright";
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

function urgencyTone(score: number): string {
  if (score >= 5) return "text-red-400";
  if (score >= 4) return "text-signal-bright";
  return "text-muted-foreground";
}

function fundingTone(pct: number): string {
  if (pct >= 80) return "bg-green-400";
  if (pct >= 40) return "bg-signal-bright";
  return "bg-signal-deep";
}

const variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i * 0.04, 0.32), duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function Skeleton({ delay }: { delay: number }) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      custom={delay}
      className="border-b border-border px-4 py-4"
    >
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 bg-muted/60 animate-pulse" />
        <div className="h-3 w-10 bg-muted/40 animate-pulse" />
      </div>
      <div className="mt-3 h-4 w-4/5 bg-muted/50 animate-pulse" />
      <div className="mt-3 h-1 w-full bg-muted/40 animate-pulse" />
    </motion.div>
  );
}

export function PrioritySidebar({ alerts, loading, error, selectedAlertId, onRetry, onSelect, timeAgo }: PrioritySidebarProps) {
  return (
    <motion.aside
      layout
      className="relative z-20 flex flex-col overflow-hidden border-b border-border bg-card lg:static lg:z-auto lg:max-h-none lg:border-b-0 lg:border-r"
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
              className="m-4 border border-signal-bright/30 bg-signal-bright/5 p-3"
            >
              <p className="mono-label text-[9px] text-signal-bright">Stream degraded</p>
              <p className="mt-1.5 text-xs text-signal-bright/80">{error}</p>
              {alerts.length === 0 && (
                <motion.button
                  type="button"
                  onClick={onRetry}
                  whileTap={{ scale: 0.97 }}
                  className="mono-label mt-3 border border-signal-bright/40 px-3 py-2 text-[10px] text-signal-bright transition-colors hover:bg-signal-bright/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Retry connection
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!loading && !error && alerts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="m-4 border border-border bg-background p-4 text-center"
          >
            <p className="mono-label text-[9px] text-muted-foreground">Feed clear</p>
            <p className="mt-2 text-sm font-medium text-foreground">No matching alerts</p>
            <p className="mt-1 text-xs text-muted-foreground">Clear filters or enable simulation mode.</p>
          </motion.div>
        )}

        {!loading && !error && alerts.length > 0 && (
          <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-3.5">
            <div>
              <p className="mono-label text-[9px] text-muted-foreground">Alert Feed</p>
              <h2 id="priority-title" className="mt-1 text-sm font-semibold tracking-tight text-foreground">
                Active incidents <span className="font-mono text-xs font-normal text-muted-foreground">· {alerts.length}</span>
              </h2>
            </div>
            <motion.button
              type="button"
              onClick={onRetry}
              whileTap={{ scale: 0.96 }}
              className="mono-label flex h-8 items-center gap-1.5 border border-border px-2.5 text-[10px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <IconRefresh width={12} height={12} />
              Refresh
            </motion.button>
          </div>
        )}

        {!loading && !error && alerts.length > 0 && (
          <motion.ol
            className="flex-1 divide-y divide-border overflow-y-auto overscroll-contain lg:max-h-[calc(100vh-200px)]"
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
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  custom={index}
                >
                  <motion.button
                    type="button"
                    onClick={() => onSelect(alert.id)}
                    whileTap={{ scale: 0.995 }}
                    className={`w-full border-l-2 px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                      selectedAlertId === alert.id
                        ? "border-l-signal-bright bg-primary/5"
                        : "border-l-transparent hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`mono-label border px-1.5 py-0.5 text-[8px] font-semibold ${badgeColor(alert)}`}
                      >
                        {incidentLabel(alert)}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{timeAgo(alert.timestamp)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-snug tracking-tight text-foreground">{headline(alert)}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{alert.rawText}</p>
                    <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
                      <span>
                        U<span className={`font-semibold ${urgencyTone(alert.urgencyScore)}`}>{alert.urgencyScore}</span>
                      </span>
                      <span>
                        <span className="text-foreground">${raised(alert).toLocaleString()}</span> / ${target(alert).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden bg-muted" aria-label={`Funding ${progress(alert)}%`}>
                      <motion.div
                        className={`h-full ${fundingTone(progress(alert))}`}
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
