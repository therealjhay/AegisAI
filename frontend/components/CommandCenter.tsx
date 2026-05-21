"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { MapHeatmap } from "@/components/MapHeatmap";
import { PrioritySidebar } from "@/components/PrioritySidebar";

export type HeatmapPoint = {
  id: string;
  lat: number;
  lon: number;
  urgencyScore: number;
  incidentType?: string;
  fundingDeficit?: number;
  sector?: string;
  timestamp?: string;
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
};

type HeatmapResponse = { points: HeatmapPoint[] };
type PriorityResponse = { alerts: PriorityAlert[] };
type SectorsResponse = { sectors: string[] };

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
  const target = 125000 + index * 15000;
  const raised = 8000 + index * 2500;
  return {
    id: `simulation-${Date.now()}-${index}`,
    rawText: "Armed attack reported near Maiduguri Market. Medical evacuation requested, north access road blocked, civilian casualties unconfirmed.",
    source: "Simulation Mode",
    incidentType: "Terrorism",
    urgencyScore: 5,
    financialTargetUSD: target,
    financialRaisedUSD: raised,
    fundingDeficit: target - raised,
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

export function CommandCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSector = searchParams.get("sector") ?? "All";

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
  const [fundingOpen, setFundingOpen] = useState<boolean>(false);

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
  }, [fetchData]);

  useEffect(() => {
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
    setSimulatedAlerts((current) => [createSimulationAlert(current.length), ...current].slice(0, 6));
    const interval = setInterval(() => {
      setSimulatedAlerts((current) => [createSimulationAlert(current.length), ...current].slice(0, 6));
    }, 30_000);
    return () => clearInterval(interval);
  }, [simulationMode]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedAlertId(null);
        setFundingOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const mergedAlerts = useMemo(() => {
    return [...simulatedAlerts, ...alerts]
      .filter((alert) => (selectedSector === "All" ? true : alert.sector === selectedSector))
      .filter((alert) => matchesQuickFilter(alert, quickFilter))
      .sort((a, b) => priorityValue(b) - priorityValue(a));
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

  const verifySelectedAlert = () => {
    if (!selectedAlert) return;
    const apply = (alert: PriorityAlert) => (alert.id === selectedAlert.id ? { ...alert, verified: true } : alert);
    setAlerts((current) => current.map(apply));
    setSimulatedAlerts((current) => current.map(apply));
  };

  return (
    <main className="app-shell min-h-screen bg-background text-foreground">
      <header className="command-header sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="grid min-h-16 gap-3 px-4 py-3 lg:grid-cols-[320px_minmax(0,1fr)_320px] lg:items-center lg:px-6">
          <div className="flex items-center justify-between gap-3 lg:justify-start">
            <div>
              <p className="brand-lockup text-lg font-semibold tracking-tight">AegisAI</p>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tactical Dashboard</p>
            </div>
            <span className="inline-flex h-11 items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-300">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 tactical-pulse" aria-hidden="true" />
              Live API
            </span>
          </div>

          <nav className="flex min-w-0 gap-2 overflow-x-auto" aria-label="Quick filters">
            {quickFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setQuickFilter(filter)}
                className={`tactical-button h-11 shrink-0 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  quickFilter === filter
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter}
              </button>
            ))}
          </nav>

          <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
            <select
              aria-label="Filter by NGO sector"
              value={selectedSector}
              onChange={(event) => updateSector(event.target.value)}
              className="tactical-control h-11 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {sectors.map((sector) => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
            <button
              type="button"
              className="tactical-button h-11 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              NGO Ops
            </button>
            <button
              type="button"
              className="tactical-button h-11 rounded-md bg-foreground px-3 text-sm font-semibold text-background transition-colors hover:bg-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Add Manual Report
            </button>
          </div>
        </div>
      </header>

      <section className="grid h-[calc(100vh-65px)] grid-cols-1 overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)]">
        <PrioritySidebar
          alerts={mergedAlerts}
          loading={loading}
          error={error}
          selectedAlertId={selectedAlertId}
          onRetry={fetchData}
          onSelect={setSelectedAlertId}
          timeAgo={timeAgo}
        />

        <div className="relative min-h-0 bg-black">
          <div className="hud-controls absolute left-4 top-4 z-10 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLowBandwidth((value) => !value)}
              className={`tactical-button h-11 rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                lowBandwidth ? "border-amber-400 bg-amber-400 text-black" : "border-border bg-card/95 text-foreground"
              }`}
            >
              Low-Bandwidth
            </button>
            <button
              type="button"
              onClick={() => setSimulationMode((value) => !value)}
              className={`tactical-button h-11 rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                simulationMode ? "border-red-400 bg-red-500 text-white" : "border-border bg-card/95 text-foreground"
              }`}
            >
              Simulation Mode
            </button>
          </div>

          <MapHeatmap
            points={mergedPoints}
            alerts={mergedAlerts}
            lowBandwidth={lowBandwidth}
            selectedAlertId={selectedAlertId}
            onSelectAlert={setSelectedAlertId}
          />

          <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 hidden grid-cols-3 gap-3 md:grid">
            <div className="hud-metric rounded-lg border border-border bg-card/95 p-3">
              <p className="text-xs text-muted-foreground">Active Alerts</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{mergedAlerts.length}</p>
            </div>
            <div className="hud-metric rounded-lg border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-xs text-red-200">Critical U5</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-red-100">{criticalCount}</p>
            </div>
            <div className="hud-metric rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-xs text-emerald-200">Open Deficit</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-100">
                ${Math.round(totalDeficit / 1000)}k
              </p>
            </div>
          </div>
        </div>
      </section>

      {selectedAlert && (
        <aside className="detail-panel fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl sm:top-16 sm:h-[calc(100vh-4rem)]" aria-labelledby="detail-title">
          <div className="flex items-start justify-between gap-4 border-b border-border p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Action Layer</p>
              <h2 id="detail-title" className="mt-1 text-xl font-semibold">{inferIncidentType(selectedAlert)} Response</h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAlertId(null)}
              className="h-11 min-w-11 rounded-md border border-border text-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Close detail panel"
            >
              x
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="detail-card rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-semibold">AI Summary</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>• {selectedAlert.rawText}</li>
                <li>• Urgency {selectedAlert.urgencyScore} is elevated by a ${Math.round((fundingTarget(selectedAlert) - fundingRaised(selectedAlert)) / 1000)}k response deficit and field access risk.</li>
              </ul>
            </div>

            <div className="detail-card mt-4 rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-semibold">Landmark Verification</p>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <span>Maiduguri Market perimeter</span>
                <span>State Specialist Hospital route</span>
                <span>Central Primary School shelter zone</span>
              </div>
            </div>

            <div className="detail-card mt-4 rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-semibold">Funding Status</p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                <div className="funding-fill h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((fundingRaised(selectedAlert) / fundingTarget(selectedAlert)) * 100)}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                ${fundingRaised(selectedAlert).toLocaleString()} raised of ${fundingTarget(selectedAlert).toLocaleString()}
              </p>
            </div>

            <button
              type="button"
              onClick={verifySelectedAlert}
              className="tactical-button mt-4 h-11 w-full rounded-md border border-border bg-background text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {selectedAlert.verified ? "Verified" : "Verify Ground Truth"}
            </button>
          </div>

          <div className="border-t border-border p-4">
            <button
              type="button"
              onClick={() => setFundingOpen(true)}
              className="fund-button h-12 w-full rounded-md bg-emerald-500 px-4 text-sm font-bold text-black transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              FUND EMERGENCY RESPONSE
            </button>
          </div>
        </aside>
      )}

      {fundingOpen && selectedAlert && (
        <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="fund-title">
          <div className="modal-panel w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="fund-title" className="text-lg font-semibold">Secure Payout Route</h2>
                <p className="mt-1 text-sm text-muted-foreground">NGO registered payout URL and QR handoff.</p>
              </div>
              <button
                type="button"
                onClick={() => setFundingOpen(false)}
                className="h-11 min-w-11 rounded-md border border-border text-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Close funding modal"
              >
                x
              </button>
            </div>
            <div className="qr-tile mx-auto mt-5 grid h-40 w-40 place-items-center rounded-md border border-foreground bg-white text-center text-xs font-bold text-black">
              QR<br />AegisAI<br />{selectedAlert.id.slice(0, 8)}
            </div>
            <a
              href={`https://payments.example.org/aegisai/${selectedAlert.id}`}
              className="tactical-button mt-5 flex h-11 items-center justify-center rounded-md bg-foreground px-3 text-sm font-semibold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Open Payout URL
            </a>
          </div>
        </div>
      )}

      {!online && (
        <div className="offline-banner fixed bottom-0 left-0 right-0 z-50 border-t border-amber-400/50 bg-amber-500 px-4 py-3 text-center text-sm font-semibold text-black">
          Offline mode active. Map is using cached tiles and queued operator actions.
        </div>
      )}
    </main>
  );
}
