"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { MapHeatmap } from "@/components/MapHeatmap";
import { PrioritySidebar } from "@/components/PrioritySidebar";
import { SwarmPanel } from "@/components/SwarmPanel";
import { AuditView } from "@/components/AuditView";
// VaultStateDisplay available via /api/vault/state — shown in SwarmPanel

export type HeatmapPoint = {
  id: string;
  lat: number;
  lon: number;
  urgencyScore: number;
  incidentType?: string;
  fundingDeficit?: number;
  sector?: string;
  timestamp?: string;
  clusterId?: string;
};

export type PriorityAlert = {
  id: string;
  rawText: string;
  source: string;
  incidentType?: string;
  urgencyScore: number;
  financialTargetUSD?: number;
  financialRaisedUSD?: number;
  fundingDeficit?: number;
  sector: string;
  timestamp: string;
  verified?: boolean;
  simulated?: boolean;
  clusterId?: string;
};

type HeatmapResponse = { points: HeatmapPoint[] };
type PriorityResponse = { alerts: PriorityAlert[] };
type SectorsResponse = { sectors: string[] };
type IngestResponse = { decision: string; clusterId: string; alertId: string; isNewCluster: boolean };

type FilterKey = "All" | "Terrorism" | "Natural Disasters" | "High Deficit";

const quickFilters: FilterKey[] = ["All", "Terrorism", "Natural Disasters", "High Deficit"];
const fallbackSectors = ["All", "Medical", "Shelter", "Food", "Water", "Rescue", "Logistics"];

function inferIncidentType(alert: Pick<PriorityAlert, "incidentType" | "rawText" | "sector">): string {
  const text = `${alert.incidentType ?? ""} ${alert.rawText} ${alert.sector}`.toLowerCase();
  if (/(terror|attack|armed|explosion|bomb|gun|militant|kidnap)/.test(text)) return "Terrorism";
  if (/(flood|earthquake|fire|storm|landslide|disaster|drought)/.test(text)) return "Natural Disaster";
  if (/(medical|hospital|clinic|evac)/.test(text)) return "Medical";
  return alert.incidentType ?? alert.sector ?? "General";
}

function fundingTarget(alert: PriorityAlert): number {
  return Math.max(alert.financialTargetUSD ?? 100000, 1);
}

function fundingRaised(alert: PriorityAlert): number {
  const fallback = Math.max(fundingTarget(alert) - (alert.fundingDeficit ?? 68000), 0);
  return Math.min(alert.financialRaisedUSD ?? fallback, fundingTarget(alert));
}

function priorityValue(alert: PriorityAlert): number {
  return alert.urgencyScore * (fundingTarget(alert) - fundingRaised(alert));
}

function matchesQuickFilter(alert: PriorityAlert, filter: FilterKey): boolean {
  const incidentType = inferIncidentType(alert);
  if (filter === "All") return true;
  if (filter === "Terrorism") return incidentType === "Terrorism";
  if (filter === "Natural Disasters") return incidentType === "Natural Disaster";
  return fundingTarget(alert) - fundingRaised(alert) >= 50000;
}

function timeAgo(timestamp: string): string {
  const elapsed = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(elapsed)) return "Live";
  const minutes = Math.max(Math.floor(elapsed / 60000), 0);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function createResilienceAlerts(): PriorityAlert[] {
  const now = Date.now();
  return [
    {
      id: "cache-maiduguri-medical",
      rawText: "Medical evacuation requested near Maiduguri Market after armed attack. North access road blocked, two clinics reporting supply shortages.",
      source: "Resilience Cache",
      incidentType: "Terrorism",
      urgencyScore: 5,
      financialTargetUSD: 180000,
      financialRaisedUSD: 22000,
      fundingDeficit: 158000,
      sector: "Rescue",
      timestamp: new Date(now - 120000).toISOString(),
    },
    {
      id: "cache-benue-flood",
      rawText: "Flooding across low-lying Benue communities. School shelter opened but water purification and transport funding remain below target.",
      source: "Resilience Cache",
      incidentType: "Natural Disaster",
      urgencyScore: 4,
      financialTargetUSD: 95000,
      financialRaisedUSD: 31000,
      fundingDeficit: 64000,
      sector: "Water",
      timestamp: new Date(now - 540000).toISOString(),
    },
    {
      id: "cache-kano-clinic",
      rawText: "Clinic network in Kano requests emergency medicine restock and logistics support for displaced families arriving overnight.",
      source: "Resilience Cache",
      incidentType: "Medical",
      urgencyScore: 3,
      financialTargetUSD: 70000,
      financialRaisedUSD: 46000,
      fundingDeficit: 24000,
      sector: "Medical",
      timestamp: new Date(now - 960000).toISOString(),
    },
  ];
}

function createResiliencePoints(alerts: PriorityAlert[]): HeatmapPoint[] {
  const coordinates = [
    [13.18, 11.84],
    [8.75, 7.33],
    [8.52, 12.0],
  ];
  return alerts.map((alert, index) => {
    const [lon, lat] = coordinates[index] ?? coordinates[0];
    return {
      id: alert.id,
      lat,
      lon,
      urgencyScore: alert.urgencyScore,
      incidentType: inferIncidentType(alert),
      fundingDeficit: fundingTarget(alert) - fundingRaised(alert),
      sector: alert.sector,
      timestamp: alert.timestamp,
    };
  });
}

function createSimulationAlert(index: number): PriorityAlert {
  const targets = [
    { text: "Flash flood waters rapidly rising near Old Bridge, families trapped, road access blocked.", type: "Natural Disaster", urgency: 5 },
    { text: "Wildfire spreading fast toward residential area, evacuation underway, multiple structures threatened.", type: "Natural Disaster", urgency: 4 },
    { text: "Armed attack reported near Maiduguri Market. Medical evacuation requested, casualties unconfirmed.", type: "Terrorism", urgency: 5 },
    { text: "Earthquake 5.2 magnitude felt in Lagos. Building damage reported, search and rescue mobilizing.", type: "Natural Disaster", urgency: 4 },
  ];
  const t = targets[index % targets.length];
  const target = 40000 + index * 12000;
  return {
    id: `simulation-${Date.now()}-${index}`,
    rawText: t.text,
    source: "Simulation Mode",
    incidentType: t.type,
    urgencyScore: t.urgency,
    financialTargetUSD: target,
    financialRaisedUSD: 0,
    fundingDeficit: target,
    sector: "Rescue",
    timestamp: new Date().toISOString(),
    simulated: true,
  };
}

function alertToPoint(alert: PriorityAlert, index: number): HeatmapPoint {
  const offsets = [
    [13.18, 11.84],
    [13.2, 11.82],
    [13.16, 11.86],
    [13.19, 11.83],
  ];
  const [lon, lat] = offsets[index % offsets.length];
  return {
    id: alert.id,
    lat,
    lon,
    urgencyScore: alert.urgencyScore,
    incidentType: inferIncidentType(alert),
    fundingDeficit: fundingTarget(alert) - fundingRaised(alert),
    sector: alert.sector,
    timestamp: alert.timestamp,
  };
}

const panelVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring" as const, damping: 28, stiffness: 260 } },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.18, ease: "easeIn" as const } },
};

const headerVariants = {
  hidden: { y: -16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring" as const, damping: 24, stiffness: 220 } },
};

const statBarVariants = {
  hidden: { y: 12, opacity: 0 },
  visible: (i: number) => ({ y: 0, opacity: 1, transition: { delay: 0.12 + i * 0.06, type: "spring" as const, damping: 22, stiffness: 200 } }),
};

export function CommandCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSector = searchParams.get("sector") ?? "All";
  const prevAlertCount = useRef(0);

  const [quickFilter, setQuickFilter] = useState<FilterKey>("All");
  const [sectors, setSectors] = useState<string[]>(fallbackSectors);
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [alerts, setAlerts] = useState<PriorityAlert[]>([]);
  const [simulatedAlerts, setSimulatedAlerts] = useState<PriorityAlert[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean>(true);
  const [lowBandwidth, setLowBandwidth] = useState<boolean>(false);
  const [simulationMode, setSimulationMode] = useState<boolean>(false);

  // Swarm / Audit / Disbursement state
  const [activeRightPanel, setActiveRightPanel] = useState<"swarm" | "audit" | null>(null);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [injecting, setInjecting] = useState(false);
  const [injectText, setInjectText] = useState("");
  const [disburseResult, setDisburseResult] = useState<{ txSignature: string; explorerUrl: string; amountUSD: number } | null>(null);

  const fetchData = useCallback(async () => {
    const sectorParam = selectedSector && selectedSector !== "All" ? `?sector=${encodeURIComponent(selectedSector)}` : "";
    setError(null);

    try {
      const [sectorsRes, heatmapRes, priorityRes] = await Promise.all([
        fetch("/api/sectors", { cache: "no-store" }),
        fetch(`/api/alerts/heatmap${sectorParam}`, { cache: "no-store" }),
        fetch(`/api/alerts/priority${sectorParam}`, { cache: "no-store" }),
      ]);

      if (!sectorsRes.ok || !heatmapRes.ok || !priorityRes.ok) {
        throw new Error("Data fetch failed.");
      }

      const sectorsBody = (await sectorsRes.json()) as SectorsResponse;
      const heatmapBody = (await heatmapRes.json()) as HeatmapResponse;
      const priorityBody = (await priorityRes.json()) as PriorityResponse;

      setSectors(sectorsBody.sectors.length > 0 ? sectorsBody.sectors : fallbackSectors);
      setPoints(heatmapBody.points);
      setAlerts(priorityBody.alerts);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Network issue detected.";
      const fallbackAlerts = createResilienceAlerts();
      setSectors(fallbackSectors);
      setAlerts(fallbackAlerts);
      setPoints(createResiliencePoints(fallbackAlerts));
      setError(`${message} Showing resilience cache.`);
    } finally {
      setLoading(false);
    }
  }, [selectedSector]);

  useEffect(() => {
    setLoading(true);
    void fetchData();
    const interval = setInterval(() => void fetchData(), 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const updateOnlineState = () => setOnline(navigator.onLine);
    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!simulationMode) return;
    setSimulatedAlerts((current) => [createSimulationAlert(current.length), ...current].slice(0, 8));
    const interval = setInterval(() => {
      setSimulatedAlerts((current) => [createSimulationAlert(current.length), ...current].slice(0, 8));
    }, 25_000);
    return () => clearInterval(interval);
  }, [simulationMode]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (activeRightPanel) { setActiveRightPanel(null); return; }
        setSelectedAlertId(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeRightPanel]);

  const mergedAlerts = useMemo(() => {
    const result = [...simulatedAlerts, ...alerts]
      .filter((alert) => (selectedSector === "All" ? true : alert.sector === selectedSector))
      .filter((alert) => matchesQuickFilter(alert, quickFilter))
      .sort((a, b) => priorityValue(b) - priorityValue(a));
    prevAlertCount.current = result.length;
    return result;
  }, [alerts, quickFilter, selectedSector, simulatedAlerts]);

  const mergedPoints = useMemo(() => {
    const simulatedPoints = simulatedAlerts.map(alertToPoint);
    const activeAlertIds = new Set(mergedAlerts.map((alert) => alert.id));
    return [...simulatedPoints, ...points].filter((point) => activeAlertIds.has(point.id) || quickFilter === "All");
  }, [mergedAlerts, points, quickFilter, simulatedAlerts]);

  const selectedAlert = mergedAlerts.find((alert) => alert.id === selectedAlertId) ?? null;
  const criticalCount = mergedAlerts.filter((alert) => alert.urgencyScore >= 5).length;
  const totalDeficit = mergedAlerts.reduce((sum, alert) => sum + fundingTarget(alert) - fundingRaised(alert), 0);

  const updateSector = (sector: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!sector || sector === "All") params.delete("sector");
    else params.set("sector", sector);
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  const injectIncident = async () => {
    const text = injectText.trim();
    if (!text) return;
    setInjecting(true);
    setDisburseResult(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: text,
          source: "simulation_inject",
          coordinates: { lat: 11.84 + (Math.random() - 0.5) * 0.05, lon: 13.15 + (Math.random() - 0.5) * 0.05 },
          urgency_score: /trapped|swept away|fatal|dead/i.test(text) ? 5 : /injured|rapidly rising/i.test(text) ? 4 : 3,
          financial_target_usd: /hundreds|many/i.test(text) ? 80000 : 25000,
        }),
      });
      const data: IngestResponse = await res.json();
      if (data.clusterId) {
        setActiveClusterId(data.clusterId);
        setActiveRightPanel("swarm");
      }
      setInjectText("");
      fetchData();
    } catch {
      setError("Failed to inject incident");
    } finally {
      setInjecting(false);
    }
  };

  const openSwarmForAlert = (alert: PriorityAlert) => {
    const cid = alert.clusterId ?? alert.id;
    setActiveClusterId(cid);
    setActiveRightPanel("swarm");
    setDisburseResult(null);
  };

  const openAuditForAlert = (alert: PriorityAlert) => {
    const cid = alert.clusterId ?? alert.id;
    setActiveClusterId(cid);
    setActiveRightPanel("audit");
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDisburse = async (clusterId: string, _cappedAmount: number) => {
    const res = await fetch("/api/vault/disburse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clusterId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Disbursement failed");
    setDisburseResult({ txSignature: data.txSignature, explorerUrl: data.explorerUrl, amountUSD: data.amountUSD });
    fetchData();
    return data;
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <motion.header
        variants={headerVariants}
        initial="hidden"
        animate="visible"
        className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl"
      >
        <div className="flex min-h-14 items-center gap-3 px-4 py-2 lg:grid lg:grid-cols-[280px_minmax(0,1fr)_280px] lg:px-6">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-foreground">AegisAI</h1>
              <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Autonomous Dispatcher</p>
            </div>
            <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-green-500/25 bg-green-500/8 px-2.5 text-[11px] font-medium text-green-300">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden="true" />
              Swarm Active
            </span>
          </div>

          <nav className="hidden min-w-0 gap-1 lg:flex" aria-label="Quick filters">
            {quickFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setQuickFilter(filter)}
                className={`h-8 shrink-0 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                  quickFilter === filter
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter}
              </button>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-2">
            <label className="hidden items-center gap-1.5 sm:flex">
              <span className="text-[11px] font-medium text-muted-foreground">Sector</span>
              <select
                value={selectedSector}
                onChange={(event) => updateSector(event.target.value)}
                className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setLowBandwidth((v) => !v)}
              className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                lowBandwidth ? "border-amber-400 bg-amber-400/20 text-amber-300" : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {lowBandwidth ? "BW: Off" : "BW: On"}
            </button>
            <button
              type="button"
              onClick={() => setSimulationMode((v) => !v)}
              className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                simulationMode ? "border-green-400 bg-green-500/20 text-green-300" : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {simulationMode ? "Sim: On" : "Sim: Off"}
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-1.5 lg:hidden" aria-label="Quick filters">
          {quickFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setQuickFilter(filter)}
              className={`h-7 shrink-0 rounded-md border px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                quickFilter === filter
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {filter}
            </button>
          ))}
        </nav>
      </motion.header>

      <section className="flex h-[calc(100vh-3.5rem)] overflow-hidden lg:h-[calc(100vh-3.5rem)]">
        <PrioritySidebar
          alerts={mergedAlerts}
          loading={loading}
          error={error}
          selectedAlertId={selectedAlertId}
          onRetry={fetchData}
          onSelect={setSelectedAlertId}
          timeAgo={timeAgo}
        />

        <div className="relative flex min-h-0 flex-1 flex-col bg-black">
          <MapHeatmap
            points={mergedPoints}
            alerts={mergedAlerts}
            lowBandwidth={lowBandwidth}
            selectedAlertId={selectedAlertId}
            onSelectAlert={setSelectedAlertId}
          />

          {/* Inject + Stats Bar */}
          <motion.div
            custom={0}
            variants={statBarVariants}
            initial="hidden"
            animate="visible"
            className="pointer-events-auto absolute bottom-4 left-4 right-4 z-10"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 inline-flex items-center gap-3 rounded-lg border border-border bg-card/90 px-3.5 py-1.5 text-xs backdrop-blur-sm">
                <span className="tabular-nums font-semibold">{mergedAlerts.length} <span className="font-normal text-muted-foreground">alerts</span></span>
                <span aria-hidden="true" className="h-3 w-px bg-border" />
                <span className="tabular-nums font-semibold text-red-300">{criticalCount} <span className="font-normal text-red-200/70">critical</span></span>
                <span aria-hidden="true" className="h-3 w-px bg-border" />
                <span className="tabular-nums font-semibold text-amber-300">${Math.round(totalDeficit / 1000)}k <span className="font-normal text-amber-200/70">deficit</span></span>
              </div>

              {/* Quick Inject */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-card/90 px-2 py-1 backdrop-blur-sm">
                <input
                  value={injectText}
                  onChange={(e) => setInjectText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && injectIncident()}
                  placeholder="Inject disaster report…"
                  className="w-40 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none sm:w-56"
                />
                <button
                  onClick={injectIncident}
                  disabled={injecting || !injectText.trim()}
                  className="shrink-0 rounded bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary disabled:opacity-40"
                >
                  {injecting ? "…" : "Inject"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Side Panel — Swarm / Audit */}
        <AnimatePresence>
          {activeRightPanel && activeClusterId && (
            <motion.aside
              key={`right-panel-${activeRightPanel}`}
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-y-0 right-0 z-40 w-full max-w-sm flex flex-col border-l border-border bg-card shadow-2xl sm:top-0 sm:h-full"
            >
              {activeRightPanel === "swarm" && (
                <SwarmPanel
                  clusterId={activeClusterId}
                  onDisburse={handleDisburse}
                  onClose={() => { setActiveRightPanel(null); fetchData(); }}
                />
              )}
              {activeRightPanel === "audit" && (
                <AuditView
                  clusterId={activeClusterId}
                  onClose={() => setActiveRightPanel(null)}
                />
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </section>

      {/* Left Detail Panel for selected alert */}
      <AnimatePresence>
        {selectedAlert && !activeRightPanel && (
          <motion.aside
            key="detail-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-border bg-card shadow-2xl sm:top-0 sm:h-full"
            aria-labelledby="detail-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border p-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Incident</p>
                <h2 id="detail-title" className="mt-0.5 truncate text-base font-semibold">{inferIncidentType(selectedAlert)}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlertId(null)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                aria-label="Close detail panel"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.08 } }}
                className="rounded-lg border border-border bg-background p-3"
              >
                <p className="text-xs font-semibold text-foreground">Summary</p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  {selectedAlert.rawText}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Urgency {selectedAlert.urgencyScore} · ${Math.round((fundingTarget(selectedAlert) - fundingRaised(selectedAlert)) / 1000)}k deficit
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.14 } }}
                className="rounded-lg border border-border bg-background p-3"
              >
                <p className="text-xs font-semibold text-foreground">Landmarks</p>
                <ul className="mt-1.5 space-y-1">
                  {["Maiduguri Market perimeter", "State Specialist Hospital", "Central Primary School shelter"].map((lm) => (
                    <li key={lm} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="h-1 w-1 rounded-full bg-border" />
                      {lm}
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
                className="rounded-lg border border-border bg-background p-3"
              >
                <p className="text-xs font-semibold text-foreground">Funding</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-amber-500"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: fundingRaised(selectedAlert) / fundingTarget(selectedAlert) }}
                    transition={{ type: "spring", damping: 20, stiffness: 120 }}
                    style={{ transformOrigin: "left" }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  ${fundingRaised(selectedAlert).toLocaleString()} of ${fundingTarget(selectedAlert).toLocaleString()}
                </p>
              </motion.div>

              {/* Swarm + Audit buttons */}
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: 0.24 } }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => openSwarmForAlert(selectedAlert)}
                  className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300 hover:bg-green-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  🐝 Run Swarm
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: 0.28 } }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => openAuditForAlert(selectedAlert)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  📋 Audit Trail
                </motion.button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Disbursement Toast */}
      <AnimatePresence>
        {disburseResult && (
          <motion.div
            key="disburse-toast"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-green-500/50 bg-green-500/10 backdrop-blur-xl p-3"
          >
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-green-400 text-lg">✓</span>
                <div>
                  <p className="text-xs font-semibold text-green-300">Disbursement Confirmed</p>
                  <p className="text-[10px] text-muted-foreground">
                    ${disburseResult.amountUSD.toLocaleString()} USDC · Tx: <span className="font-mono">{disburseResult.txSignature.slice(0, 16)}…</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {disburseResult.explorerUrl && (
                  <a
                    href={disburseResult.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-green-500/20 px-3 py-1.5 text-[11px] font-medium text-green-300 hover:bg-green-500/30"
                  >
                    Explorer →
                  </a>
                )}
                <button
                  onClick={() => setDisburseResult(null)}
                  className="rounded-md border border-border px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!online && (
          <motion.div
            key="offline-banner"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-amber-400/50 bg-amber-500 px-4 py-2.5 text-center text-xs font-semibold text-black"
          >
            Offline mode — cached tiles and queued actions
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}