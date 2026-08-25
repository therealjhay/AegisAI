import { createHmac, createHash } from "crypto";

/**
 * Mock ed25519-like signing: HMAC-SHA256 with per-agent secret.
 * Deterministic, verifiable, demo-suitable. Swap with real Solana ed25519 via @noble/ed25519 when on-chain.
 */
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
  const expected = signVote(agentType, clusterId, vote, score);
  return expected === signature;
}

export function quorumHash(votes: Array<{ agentType: string; vote: string; signature: string }>): string {
  const sorted = [...votes].sort((a, b) => a.agentType.localeCompare(b.agentType));
  const payload = sorted.map((v) => `${v.agentType}:${v.vote}:${v.signature.slice(0, 16)}`).join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export function mockTxSignature(clusterId: string, quorumHashStr: string, amountUSD: number): string {
  return createHash("sha256").update(`${clusterId}:${quorumHashStr}:${amountUSD}:${Date.now()}`).digest("hex");
}
