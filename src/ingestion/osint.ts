/**
 * Pillar 1 OSINT helpers — deterministic mocked telemetry for demo.
 * Replace with real APIs (Tavily, OpenWeather, Copernicus) via env keys.
 */

export type OsintBundle = {
  news: string;
  weather: string;
  satellite: string;
};

export function mockNewsSearch(query: string, location: string): string {
  const q = query.toLowerCase();
  if (/(bomb|explosion|attack|gunfire|terror|blast)/.test(q)) {
    return `Recent news in ${location}: Verified reports of an explosion/attack in the last 60 minutes. Emergency services on scene. Source: Local news relay + ReliefWeb mirror.`;
  }
  if (/(flood|water|inundat|overflow|river)/.test(q)) {
    return `Recent news in ${location}: Heavy flooding and road closures reported. Photos of submerged streets within 3h.`;
  }
  if (/(fire|wildfire|blaze|smoke)/.test(q)) {
    return `Recent news in ${location}: Wildfire perimeter expanding, fire service evacuation order active.`;
  }
  if (/(earthquake|tremor|seismic)/.test(q)) {
    return `Recent news in ${location}: USGS 5.2 tremor 22km away, aftershock advisory issued.`;
  }
  return `No corroborating recent news found for '${query}' in ${location} over last 3 hours.`;
}

export function mockWeatherAnomaly(lat: number, lon: number): string {
  // Maiduguri corridor (11.8,13.1) is our demo disaster zone — always anomalous
  const isNigeriaNE = lat > 10 && lat < 13 && lon > 12 && lon < 14;
  if (isNigeriaNE) return `Weather Station at ${lat.toFixed(2)},${lon.toFixed(2)}: Extreme rainfall, thunderstorm warning active. CHIRPS anomaly +2.3σ.`;
  if (lat > 0 && lon > 0) return `Weather Station at ${lat.toFixed(2)},${lon.toFixed(2)}: Rainfall 12mm/6h above seasonal median — possible flood risk.`;
  return `Weather Station at ${lat.toFixed(2)},${lon.toFixed(2)}: Normal conditions. No convective anomaly.`;
}

export function mockSatelliteCheck(lat: number, lon: number, disasterType: string): string {
  const dt = disasterType.toLowerCase();
  if (dt.includes("flood") || dt.includes("water")) {
    return `Copernicus Sentinel-2 tile ${lat.toFixed(2)},${lon.toFixed(2)} (T-45min): NDWI 0.62 vs baseline 0.21 — inundation signature detected. SAR coherence drop confirmed.`;
  }
  if (dt.includes("fire")) {
    return `Sentinel-2 FIRMS: Thermal anomaly 387K at ${lat.toFixed(2)},${lon.toFixed(2)}, confidence h, FRP 42MW.`;
  }
  if (dt.includes("explosion") || dt.includes("attack")) {
    return `Sentinel-2 tile ${lat.toFixed(2)},${lon.toFixed(2)}: No fire/structural anomaly in optical — requires SAR/ground corroboration.`;
  }
  return `Sentinel-2 tile ${lat.toFixed(2)},${lon.toFixed(2)}: No significant change vs 7-day baseline (ΔNDVI <0.03).`;
}

export function osintBundleForAlert(rawText: string, lat: number, lon: number, locationMention: string): OsintBundle {
  const query = rawText.slice(0, 120);
  const loc = locationMention || `${lat.toFixed(2)},${lon.toFixed(2)}`;
  return {
    news: mockNewsSearch(query, loc),
    weather: mockWeatherAnomaly(lat, lon),
    satellite: mockSatelliteCheck(lat, lon, rawText),
  };
}
