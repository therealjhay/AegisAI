import type { PrismaClient } from "@prisma/client";
import type { IncomingAlert } from "./schema.js";

/**
 * Pillar 1: Real-Time OSINT Ingestion Engine — Geographic Clustering
 * Groups overlapping reports (1km / 1h) into Incident_Clusters.
 * Uses ST_DWithin on the fly via geography calc on lat/lon floats.
 */

export type ClusterResult = {
  clusterId: string;
  isNew: boolean;
  status: string;
};

// Haversine distance in meters
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function findOrCreateCluster(
  prisma: PrismaClient,
  input: IncomingAlert
): Promise<ClusterResult> {
  // Find nearby cluster in last 60 minutes (1km radius)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Fetch recent clusters — we filter in JS with haversine to avoid PostGIS dep on Incident_Clusters geometry
  const recent = await prisma.incidentCluster.findMany({
    where: {
      createdAt: { gte: oneHourAgo },
      status: { not: "quarantined" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const nearby = recent.find((c) => haversineMeters(c.lat, c.lon, input.coordinates.lat, input.coordinates.lon) <= 1000);

  if (nearby) {
    const sources = Array.isArray(nearby.sources) ? (nearby.sources as string[]) : [];
    const nextSources = sources.includes(input.source) ? sources : [...sources, input.source];
    const nextCount = nearby.reportCount + 1;
    // Moving centroid
    const nextLat = (nearby.lat * nearby.reportCount + input.coordinates.lat) / nextCount;
    const nextLon = (nearby.lon * nearby.reportCount + input.coordinates.lon) / nextCount;
    // Approx radius
    const nextRadius = Math.max(nearby.radiusM, haversineMeters(nearby.lat, nearby.lon, input.coordinates.lat, input.coordinates.lon));

    await prisma.incidentCluster.update({
      where: { id: nearby.id },
      data: {
        lat: nextLat,
        lon: nextLon,
        radiusM: nextRadius,
        reportCount: nextCount,
        sources: nextSources as any,
        totalFinancialTarget: { increment: input.financial_target_usd ?? 0 },
        updatedAt: new Date(),
      },
    });

    return { clusterId: nearby.id, isNew: false, status: nearby.status };
  }

  // Create new cluster
  const created = await prisma.incidentCluster.create({
    data: {
      lat: input.coordinates.lat,
      lon: input.coordinates.lon,
      radiusM: 50,
      reportCount: 1,
      sources: [input.source] as any,
      status: "pending",
      totalFinancialTarget: input.financial_target_usd ?? 0,
      region: `${input.coordinates.lat.toFixed(3)}, ${input.coordinates.lon.toFixed(3)}`,
    },
  });

  return { clusterId: created.id, isNew: true, status: created.status };
}

export async function getClusterWithVotes(prisma: PrismaClient, clusterId: string) {
  return prisma.incidentCluster.findUnique({
    where: { id: clusterId },
    include: { votes: true, disbursements: true, alerts: true },
  });
}
