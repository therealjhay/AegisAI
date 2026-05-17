"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { MapHeatmap } from "@/components/MapHeatmap";
import { PrioritySidebar } from "@/components/PrioritySidebar";

type HeatmapPoint = {
  id: string;
  lat: number;
  lon: number;
  urgencyScore: number;
};

type PriorityAlert = {
  id: string;
  rawText: string;
  source: string;
  urgencyScore: number;
  sector: string;
  timestamp: string;
};

type HeatmapResponse = {
  points: HeatmapPoint[];
};

type PriorityResponse = {
  alerts: PriorityAlert[];
};

type SectorsResponse = {
  sectors: string[];
};

export function CommandCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSector = searchParams.get("sector") ?? "All";

  const [sectors, setSectors] = useState<string[]>(["All"]);
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [alerts, setAlerts] = useState<PriorityAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

      setSectors(sectorsBody.sectors.length > 0 ? sectorsBody.sectors : ["All"]);
      setPoints(heatmapBody.points);
      setAlerts(priorityBody.alerts);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Network issue detected. Check connection and retry.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedSector]);

  useEffect(() => {
    setLoading(true);
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchData();
    }, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalVisible = useMemo(() => points.length, [points.length]);

  const updateSector = (sector: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!sector || sector === "All") {
      params.delete("sector");
    } else {
      params.set("sector", sector);
    }
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <header className="mb-6 rounded-lg border border-border bg-card p-4">
          <h1 className="text-2xl font-semibold tracking-tight">AegisAI Command Center</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Real-time, verified alert intelligence for rapid NGO field response.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex min-w-[220px] flex-col gap-2">
              <label htmlFor="sector-filter" className="text-sm font-medium text-foreground">
                Filter by Sector
              </label>
              <select
                id="sector-filter"
                value={selectedSector}
                onChange={(event) => updateSector(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-md border border-border bg-background px-3 py-2 text-sm" aria-live="polite">
              Visible verified alerts: <span className="font-semibold tabular-nums">{totalVisible}</span>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/60 bg-red-500/10 p-4">
            <p className="text-sm font-medium text-red-100">Data stream interrupted.</p>
            <p className="mt-1 text-xs text-red-100/90">
              {error} Use refresh controls to retry once connectivity stabilizes.
            </p>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <MapHeatmap points={points} />
            {!loading && points.length === 0 && !error && (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                No verified alerts match the selected sector yet. Clear the filter or wait for new
                incoming reports.
              </div>
            )}
          </div>
          <PrioritySidebar alerts={alerts} loading={loading} error={error} onRetry={fetchData} />
        </section>
      </div>
    </main>
  );
}
