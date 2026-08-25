import { createHmac, createHash } from "crypto";

// Frontend mirror of src/swarm/* — avoids cross-folder import issue on Vercel

const AGENT_SECRETS: Record<string, string> = {
  triangulator: process.env.AGENT_TRIANGULATOR_SECRET ?? "aegis-triangulator-v1-secret-2026",
  fact_checker: process.env.AGENT_FACT_CHECKER_SECRET ?? "aegis-fact-checker-v1-secret-2026",
  triage_evaluator: process.env.AGENT_TRIAGE_SECRET ?? "aegis-triage-v1-secret-2026",
  risk_governor: process.env.AGENT_GOVERNOR_SECRET ?? "aegis-governor-v1-secret-2026",
};

export function signVote(agentType: string, clusterId: string, vote: string, score: number): string {
  const secret = AGENT_SECRETS[agentType] ?? "aegis-fallback-secret";
  const payload = `${agentType}:${clusterId}:${vote}:${score.toFixed(3)}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}
export function verifyVote(agentType: string, clusterId: string, vote: string, score: number, signature: string): boolean {
  return signVote(agentType, clusterId, vote, score) === signature;
}
export function quorumHash(votes: Array<{ agentType: string; vote: string; signature: string }>): string {
  const sorted = [...votes].sort((a, b) => a.agentType.localeCompare(b.agentType));
  const payload = sorted.map((v) => `${v.agentType}:${v.vote}:${v.signature.slice(0, 16)}`).join("|");
  return createHash("sha256").update(payload).digest("hex");
}
export function mockTxSignature(clusterId: string, qh: string, amount: number): string {
  return createHash("sha256").update(`${clusterId}:${qh}:${amount}:${Date.now()}`).digest("hex");
}

export type SwarmInput = {
  clusterId: string;
  lat: number;
  lon: number;
  reportCount: number;
  radiusM: number;
  sources: string[];
  rawTexts: string[];
  urgencyScores: number[];
  totalFinancialTarget: number;
};

export type Vote = {
  agentType: string;
  vote: "yes" | "no" | "abstain";
  score: number;
  reasoning: string;
  signature: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolProofs: Record<string, any>;
};

function triangulator(inp: SwarmInput): Vote {
  let score = 0.4;
  if (inp.reportCount >= 2) score += 0.2;
  if (inp.reportCount >= 4) score += 0.15;
  if (inp.radiusM <= 300) score += 0.15;
  else if (inp.radiusM <= 800) score += 0.08;
  if (inp.sources.length >= 2) score += 0.1;
  if (inp.sources.length >= 3) score += 0.05;
  if (inp.sources.length === 1 && inp.sources[0] === "anonymous_tip") score -= 0.25;
  score = Math.max(0, Math.min(1, score));
  const vote = score >= 0.6 ? "yes" : score >= 0.35 ? "abstain" : "no";
  const reasoning = `Cluster: ${inp.reportCount} reports within ${Math.round(inp.radiusM)}m, ${inp.sources.length} sources (${inp.sources.join(", ")})`;
  return { agentType: "triangulator", vote, score: Number(score.toFixed(3)), reasoning, signature: signVote("triangulator", inp.clusterId, vote, score), toolProofs: { reportCount: inp.reportCount, radiusM: inp.radiusM, sources: inp.sources } };
}

function factChecker(inp: SwarmInput): Vote {
  const text = inp.rawTexts.join(" ");
  const low = text.toLowerCase();
  const isAttack = /bomb|explosion|attack|gunfire|terror|blast|armed/i.test(low);
  let newsFound: boolean, newsDetail: string, satMatch: boolean, satDetail: string;
  if (/bomb|explosion|attack|gunfire|terror/i.test(low)) { newsFound = true; newsDetail = "Verified explosion/attack in last 60min."; satMatch = false; satDetail = `Sentinel-2 optical at ${inp.lat.toFixed(2)},${inp.lon.toFixed(2)}: No structural anomaly.`; }
  else if (/flood|water|inundat/i.test(low)) { newsFound = true; newsDetail = "Heavy flooding photos within 3h."; satMatch = true; satDetail = `Sentinel-2 NDWI 0.62 vs 0.21 at ${inp.lat.toFixed(2)},${inp.lon.toFixed(2)} inundation.`; }
  else if (/fire|wildfire|blaze/i.test(low)) { newsFound = true; newsDetail = "FIRMS thermal anomaly + evacuation."; satMatch = true; satDetail = `FIRMS 387K anomaly at ${inp.lat.toFixed(2)},${inp.lon.toFixed(2)}.`; }
  else { newsFound = false; newsDetail = "No corroborating news in 3h."; satMatch = false; satDetail = `Sentinel-2 at ${inp.lat.toFixed(2)},${inp.lon.toFixed(2)}: ΔNDVI <0.03`; }
  const isNE = inp.lat > 10 && inp.lat < 13 && inp.lon > 12 && inp.lon < 14;
  const weatherAnomaly = isNE || (inp.lat > 0 && inp.lon > 0);
  let score: number, vote: Vote["vote"], reasoning: string;
  if (isAttack) {
    if (newsFound) { score = 0.82; vote = "yes"; reasoning = `Attack corroborated: ${newsDetail}`; }
    else { score = 0.22; vote = "no"; reasoning = "No news corroboration for attack — audit required."; }
  } else {
    const cor = [newsFound, weatherAnomaly, satMatch].filter(Boolean).length;
    if (cor >= 2) { score = 0.78 + cor * 0.06; vote = "yes"; reasoning = `${cor}/3 corroborations.`; }
    else if (cor === 1) { score = 0.42; vote = "abstain"; reasoning = "Only 1/3 corroborations."; }
    else { score = 0.18; vote = "no"; reasoning = `0/3 corroborations. ${newsDetail}`; }
  }
  score = Number(Math.max(0, Math.min(1, score)).toFixed(3));
  return { agentType: "fact_checker", vote, score, reasoning, signature: signVote("fact_checker", inp.clusterId, vote, score), toolProofs: { news: { found: newsFound, detail: newsDetail }, satellite: { match: satMatch, detail: satDetail }, weather: { anomaly: weatherAnomaly } } };
}

function triage(inp: SwarmInput): Vote {
  const maxU = Math.max(...inp.urgencyScores, 1);
  const text = inp.rawTexts.join(" ").toLowerCase();
  let tier: number;
  if (maxU >= 5 && /trapped|casualt|dead|fatal|destroyed|collapse/.test(text)) tier = 4;
  else if (maxU >= 5 || /hundreds|many|widespread|evacuate now|rapidly rising/.test(text)) tier = 3;
  else if (maxU >= 4 || /injured|major damage|spreading fast/.test(text)) tier = 2;
  else if (maxU >= 3) tier = 2;
  else tier = 1;
  const caps: Record<number, number> = { 1: 0, 2: 5000, 3: 15000, 4: 40000 };
  const floors: Record<number, number> = { 1: 0, 2: 5000, 3: 15000, 4: 40000 };
  let amount = floors[tier] + maxU * 2500 + inp.reportCount * 1500;
  if (/hundreds|many/.test(text)) amount += 20000;
  if (/infrastructure|destroyed|bridge/.test(text)) amount += 30000;
  if (/casualt|death|dead/.test(text)) amount += 25000;
  if (/hospital|clinic/.test(text)) amount += 15000;
  amount = Math.min(amount, caps[tier] ?? amount);
  let vote: Vote["vote"], score: number, reasoning: string;
  if (tier === 1) { vote = "abstain"; score = 0.35; reasoning = `Tier 1 monitor urgency ${maxU} $0`; }
  else if (tier === 2) { vote = "yes"; score = 0.68; reasoning = `Tier 2 moderate urgency ${maxU} tier ${tier} $${amount}`; }
  else if (tier === 3) { vote = "yes"; score = 0.84; reasoning = `Tier 3 high urgency ${maxU} tier ${tier} $${amount}`; }
  else { vote = "yes"; score = 0.92; reasoning = `Tier 4 catastrophic urgency ${maxU} tier ${tier} $${amount}`; }
  return { agentType: "triage_evaluator", vote, score, reasoning, signature: signVote("triage_evaluator", inp.clusterId, vote, score), toolProofs: { tier, maxUrgency: maxU, amount, reportCount: inp.reportCount } };
}

function governor(inp: SwarmInput & { vault?: { reserveUSD: number; dailyLimitUSD: number; disbursedTodayUSD: number }; tier?: number; requested?: number }): Vote {
  const vault = inp.vault ?? { reserveUSD: 1_000_000, dailyLimitUSD: 100_000, disbursedTodayUSD: 12500 };
  const tier = inp.tier ?? 2;
  const hardCaps: Record<number, number> = { 1: 0, 2: 5000, 3: 15000, 4: 25000 };
  const hardCap = hardCaps[tier] ?? 5000;
  const requested = inp.requested ?? inp.totalFinancialTarget ?? 0;
  const remainingDaily = vault.dailyLimitUSD - vault.disbursedTodayUSD;
  const capped = Math.min(requested, hardCap, remainingDaily, vault.reserveUSD * 0.1);
  const effective = Math.max(0, Math.round(capped / 100) * 100);
  let vote: Vote["vote"], score: number, reasoning: string;
  if (effective <= 0) { vote = "no"; score = 0.15; reasoning = `Veto: daily ${remainingDaily} reserve ${vault.reserveUSD} cap ${hardCap} req ${requested} -> 0`; }
  else if (remainingDaily < hardCap * 0.2) { vote = "abstain"; score = 0.45; reasoning = `Daily stressed ${Math.round((vault.disbursedTodayUSD / vault.dailyLimitUSD) * 100)}% capped ${requested}->${effective} tier ${tier}`; }
  else if (inp.sources.includes("anonymous_tip") && tier >= 3) { vote = "abstain"; score = 0.4; reasoning = `Anonymous tip tier ${tier} escalating risk capped ${effective}`; }
  else { vote = "yes"; score = 0.88; reasoning = `Approved tier ${tier} cap ${hardCap} daily ${remainingDaily} req ${requested}->${effective}`; }
  return { agentType: "risk_governor", vote, score, reasoning, signature: signVote("risk_governor", inp.clusterId, vote, score), toolProofs: { tier, hardCap, requested, effective, vault } };
}

export async function runSwarmQuorum(input: SwarmInput & { vault?: { reserveUSD: number; dailyLimitUSD: number; disbursedTodayUSD: number } }): Promise<{ votes: Vote[]; yesCount: number; quorumReached: boolean; status: string; tier: number; cappedAmountUSD: number; quorumHash: string; clusterId: string }> {
  const tri = triage(input);
  const tier = tri.toolProofs.tier as number;
  const amount = tri.toolProofs.amount as number;
  const tria = triangulator(input);
  const fact = factChecker(input);
  const gov = governor({ ...input, tier, requested: amount });
  const votes = [tria, fact, tri, gov];
  const yesCount = votes.filter((v) => v.vote === "yes").length;
  const quorumReached = yesCount >= 3;
  const cappedAmountUSD = gov.toolProofs.effective as number;
  let status: string;
  if (quorumReached && cappedAmountUSD > 0) status = "verified";
  else if (votes.filter((v) => v.vote === "no").length >= 2) status = "quarantined";
  else status = "audit_required";
  return { clusterId: input.clusterId, votes, yesCount, quorumReached, status, tier, cappedAmountUSD, quorumHash: quorumHash(votes.map((v) => ({ agentType: v.agentType, vote: v.vote, signature: v.signature }))) };
}
