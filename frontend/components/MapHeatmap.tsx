"use client";

import { useEffect, useMemo, useRef } from "react";
import type { FeatureCollection, Point } from "geojson";
import type { Map as MapboxMap, MapMouseEvent } from "mapbox-gl";

import type { HeatmapPoint, PriorityAlert } from "@/components/CommandCenter";
import { MAP_COLORS } from "@/lib/theme";

type MapHeatmapProps = {
  points: HeatmapPoint[];
  alerts: PriorityAlert[];
  lowBandwidth: boolean;
  selectedAlertId: string | null;
  onSelectAlert: (alertId: string) => void;
};

const MAP_SOURCE_ID = "alerts";

function incidentTypeFor(point: HeatmapPoint): string {
  const text = `${point.incidentType ?? ""} ${point.sector ?? ""}`.toLowerCase();
  if (/(terror|attack|armed|explosion|bomb|gun|militant|kidnap)/.test(text)) return "terrorism";
  if (/(flood|earthquake|fire|storm|landslide|disaster|drought)/.test(text)) return "disaster";
  return "other";
}

function toGeoJson(points: HeatmapPoint[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      properties: {
        id: point.id,
        urgencyScore: point.urgencyScore,
        incidentType: incidentTypeFor(point),
      },
      geometry: {
        type: "Point",
        coordinates: [point.lon, point.lat],
      },
    })),
  };
}

function fallbackRows(alerts: PriorityAlert[]) {
  return alerts.slice(0, 8).map((alert) => (
    <button
      key={alert.id}
      type="button"
      className="alert-card flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span>
        <span className="block text-sm font-semibold text-foreground">{alert.incidentType ?? alert.sector}</span>
        <span className="block text-xs text-muted-foreground">{alert.source}</span>
      </span>
      <span className="rounded-md bg-red-500/15 px-2 py-1 text-xs font-bold text-red-100">U{alert.urgencyScore}</span>
    </button>
  ));
}

export function MapHeatmap({ points, alerts, lowBandwidth, selectedAlertId, onSelectAlert }: MapHeatmapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);
  const geoJson = useMemo(() => toGeoJson(points), [points]);

  useEffect(() => {
    if (!hasToken || lowBandwidth || !containerRef.current || mapRef.current) return;

    let mounted = true;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [13.18, 11.84],
        zoom: 5.4,
        attributionControl: true,
      });

      if (!mounted) {
        map.remove();
        return;
      }

      mapRef.current = map;

      map.on("load", () => {
        map.addSource(MAP_SOURCE_ID, {
          type: "geojson",
          data: geoJson,
          cluster: true,
          clusterRadius: 52,
          clusterMaxZoom: 10,
          clusterProperties: {
            maxUrgency: ["max", ["get", "urgencyScore"]],
          },
        });

        map.addLayer({
          id: "alert-clusters",
          type: "circle",
          source: MAP_SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": ["step", ["get", "maxUrgency"], MAP_COLORS.urgencySafe, 4, MAP_COLORS.urgencyWarning, 5, MAP_COLORS.urgencyCritical],
            "circle-radius": ["step", ["get", "point_count"], 22, 10, 30, 30, 40],
            "circle-opacity": 0.2,
            "circle-stroke-width": ["step", ["get", "maxUrgency"], 2, 5, 4],
            "circle-stroke-color": ["step", ["get", "maxUrgency"], MAP_COLORS.urgencySafe, 4, MAP_COLORS.urgencyWarning, 5, MAP_COLORS.urgencyCritical],
          },
        });

        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: MAP_SOURCE_ID,
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 13,
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          },
          paint: { "text-color": MAP_COLORS.textLight },
        });

        map.addLayer({
          id: "alert-points",
          type: "symbol",
          source: MAP_SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": ["case", ["==", ["get", "incidentType"], "terrorism"], "◎", ["==", ["get", "incidentType"], "disaster"], "△", "●"],
            "text-size": ["interpolate", ["linear"], ["get", "urgencyScore"], 1, 18, 5, 28],
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": ["case", [">=", ["get", "urgencyScore"], 5], MAP_COLORS.urgencyCritical, ["==", ["get", "incidentType"], "disaster"], MAP_COLORS.urgencyWarning, MAP_COLORS.urgencySafe],
            "text-halo-color": MAP_COLORS.backgroundDark,
            "text-halo-width": 2,
          },
        });

        map.on("click", "alert-points", (event: MapMouseEvent) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "string") onSelectAlert(id);
        });

        map.on("mouseenter", "alert-points", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "alert-points", () => { map.getCanvas().style.cursor = ""; });

        map.getCanvas().addEventListener("keydown", (event: KeyboardEvent) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const center = map.getCenter();
          const features = map.queryRenderedFeatures(undefined, {
            layers: ["alert-points"],
          });
          if (features.length === 0) return;
          const nearest = features.reduce((closest, feature) => {
            const [lon, lat] = (feature.geometry as { coordinates: number[] }).coordinates;
            const dist = Math.hypot(lon - center.lng, lat - center.lat);
            return dist < closest.dist ? { feature, dist } : closest;
          }, { feature: features[0], dist: Infinity });
          const id = nearest.feature.properties?.id;
          if (typeof id === "string") {
            event.preventDefault();
            onSelectAlert(id);
          }
        });
      });
    })();

    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [geoJson, hasToken, lowBandwidth, onSelectAlert]);

  useEffect(() => {
    if (lowBandwidth && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      return;
    }
    const source = mapRef.current?.getSource(MAP_SOURCE_ID);
    if (source && "setData" in source) source.setData(geoJson);
  }, [geoJson, lowBandwidth]);

  if (!hasToken || lowBandwidth) {
    return (
      <div className="radar-stage h-full min-h-[calc(100vh-65px)] bg-background p-4 pt-20 lg:p-6 lg:pt-20">
        <div className="relative mx-auto max-w-3xl rounded-lg border border-border bg-background/90 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {lowBandwidth ? "List-Only Mode" : "Mapbox Token Missing"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">Operational feed remains available</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {lowBandwidth
              ? "Map rendering is disabled to conserve data. Priority sorting, verification, and funding routes remain active."
              : "Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in frontend/.env.local to enable the live Mapbox canvas."}
          </p>
          <div className="mt-4 grid gap-2">{fallbackRows(alerts)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-stage h-full min-h-[calc(100vh-65px)] w-full">
      <div className="map-vignette" aria-hidden="true" />
      <div ref={containerRef} className="h-full min-h-[calc(100vh-65px)] w-full" aria-label="Live tactical alert map" role="application" aria-roledescription="interactive map" />
      {selectedAlertId && <span className="sr-only" aria-live="polite">Alert {selectedAlertId} selected.</span>}
    </div>
  );
}
