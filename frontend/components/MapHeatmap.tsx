"use client";

import { useEffect, useMemo, useRef } from "react";
import type { FeatureCollection, Point } from "geojson";
import type { Map as MapboxMap } from "mapbox-gl";

type HeatmapPoint = {
  id: string;
  lat: number;
  lon: number;
  urgencyScore: number;
};

type MapHeatmapProps = {
  points: HeatmapPoint[];
};

const MAP_SOURCE_ID = "alerts";

function toGeoJson(points: HeatmapPoint[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      properties: {
        id: point.id,
        urgencyScore: point.urgencyScore,
      },
      geometry: {
        type: "Point",
        coordinates: [point.lon, point.lat],
      },
    })),
  };
}

export function MapHeatmap({ points }: MapHeatmapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);
  const geoJson = useMemo(() => toGeoJson(points), [points]);

  useEffect(() => {
    if (!hasToken || !containerRef.current || mapRef.current) {
      return;
    }

    let mounted = true;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [30.0, 0.0],
        zoom: 2.2,
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
        });

        map.addLayer({
          id: "alerts-heat",
          type: "heatmap",
          source: MAP_SOURCE_ID,
          paint: {
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "urgencyScore"],
              1,
              0.2,
              5,
              1,
            ],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 10, 1.5],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(255, 255, 255, 0)",
              0.2,
              "rgb(94, 234, 212)",
              0.4,
              "rgb(45, 212, 191)",
              0.6,
              "rgb(251, 191, 36)",
              0.8,
              "rgb(249, 115, 22)",
              1,
              "rgb(239, 68, 68)",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 8, 10, 24],
            "heatmap-opacity": 0.92,
          },
        });

        map.addLayer({
          id: "alerts-point",
          type: "circle",
          source: MAP_SOURCE_ID,
          minzoom: 7,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["get", "urgencyScore"], 1, 4, 5, 9],
            "circle-color": "#f97316",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.2,
            "circle-opacity": 0.95,
          },
        });
      });
    })();

    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [hasToken, geoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource(MAP_SOURCE_ID);
    if (source && "setData" in source) {
      source.setData(geoJson);
    }
  }, [geoJson]);

  if (!hasToken) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-border bg-card p-6 text-center">
        <p className="max-w-md text-sm text-foreground">
          Mapbox token is missing. Set <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in{" "}
          <code>frontend/.env.local</code> to render the live heatmap.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div
        ref={containerRef}
        className="min-h-[420px] w-full"
        aria-label="Live disaster heatmap"
        role="img"
      />
    </div>
  );
}
