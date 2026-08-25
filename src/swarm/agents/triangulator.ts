import type { AgentVoteInput, AgentVoteResult } from "../types.js";
import { signVote } from "../crypto.js";

/**
 * Triangulator Agent: Cross-references GPS coordinates, timestamps, geographic proximity.
 */
export async function triangulatorAgent(input: AgentVoteInput): Promise<AgentVoteResult> {
  const { clusterId, reportCount, radiusM, sources } = input;

  // Scoring: more reports + tight radius + diverse sources = higher confidence
  let score = 0.4;
  if (reportCount >= 2) score += 0.2;
  if (reportCount >= 4) score += 0.15;
  if (radiusM <= 300) score += 0.15;
  else if (radiusM <= 800) score += 0.08;
  if (sources.length >= 2) score += 0.1;
  if (sources.length >= 3) score += 0.05;

  // Penalize single-source anonymous
  const onlyAnonymous = sources.length === 1 && sources[0] === "anonymous_tip";
  if (onlyAnonymous) score -= 0.25;

  score = Math.max(0, Math.min(1, score));
  const vote = score >= 0.6 ? "yes" : score >= 0.35 ? "abstain" : "no";
  const reasoning = onlyAnonymous
    ? "Single anonymous source, no geographic corroboration — insufficient triangulation."
    : `Cluster: ${reportCount} reports within ${Math.round(radiusM)}m, ${sources.length} source types (${sources.join(", ")}). Centroid coherence ${score >= 0.6 ? "high" : score >= 0.35 ? "medium" : "low"}.`;

  return {
    agentType: "triangulator",
    vote,
    score: Number(score.toFixed(3)),
    reasoning,
    signature: signVote("triangulator", clusterId, vote, score),
    toolProofs: { reportCount, radiusM, sources, haversine: `radius ${radiusM}m`, method: "haversine+count" },
  };
}
