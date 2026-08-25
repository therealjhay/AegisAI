import type { AgentVoteInput, AgentVoteResult } from "../types.js";
import { signVote } from "../crypto.js";

/**
 * Disbursement / Risk Governor: audits allocation against treasury, sets caps, signs payload.
 * Vault balance checked via injected getter (DB or mock).
 */
export type VaultSnapshot = {
  reserveUSD: number;
  dailyLimitUSD: number;
  disbursedTodayUSD: number;
};

const TIER_HARD_CAPS: Record<number, number> = { 1: 0, 2: 5000, 3: 15000, 4: 25000 };
const DEFAULT_VAULT: VaultSnapshot = { reserveUSD: 1_000_000, dailyLimitUSD: 100_000, disbursedTodayUSD: 12_500 };

export async function riskGovernorAgent(
  input: AgentVoteInput & { vault?: VaultSnapshot; requestedAmount?: number }
): Promise<AgentVoteResult> {
  const { clusterId, sources } = input;
  const vault = input.vault ?? DEFAULT_VAULT;
  const tierHint = (input as any).tier as number | undefined;
  const requested = input.requestedAmount ?? input.totalFinancialTarget ?? 0;

  // Derive tier if not injected (use urgency proxy)
  const tier = tierHint ?? (Math.max(...input.urgencyScores, 1) >= 5 ? 4 : Math.max(...input.urgencyScores, 1) >= 4 ? 3 : 2);

  const hardCap = TIER_HARD_CAPS[tier] ?? 5000;
  const remainingDaily = vault.dailyLimitUSD - vault.disbursedTodayUSD;
  const remainingReserve = vault.reserveUSD;

  const capped = Math.min(requested, hardCap, remainingDaily, remainingReserve * 0.1);
  const effective = Math.max(0, Math.round(capped / 100) * 100); // round to 100

  let vote: "yes" | "no" | "abstain";
  let score: number;
  let reasoning: string;

  if (effective <= 0) {
    vote = "no";
    score = 0.15;
    reasoning = `Gov veto: no funds available — daily remaining $${remainingDaily.toLocaleString()}, reserve $${remainingReserve.toLocaleString()}, hard cap $${hardCap.toLocaleString()} for tier ${tier}. Requested $${requested.toLocaleString()} → $0.`;
  } else if (remainingDaily < hardCap * 0.2) {
    vote = "abstain";
    score = 0.45;
    reasoning = `Risk flag: daily limit stressed (${Math.round((vault.disbursedTodayUSD / vault.dailyLimitUSD) * 100)}% used). Capped request $${requested.toLocaleString()} → $${effective.toLocaleString()} for tier ${tier}. Requires throttling.`;
  } else if (sources.includes("anonymous_tip") && tier >= 3) {
    vote = "abstain";
    score = 0.4;
    reasoning = `Anonymous_tip with tier ${tier} escalates risk — capped to $${effective.toLocaleString()} and requires additional fact-check quorum.`;
  } else {
    vote = "yes";
    score = 0.88;
    reasoning = `Approved: tier ${tier} hard cap $${hardCap.toLocaleString()}, daily remaining $${remainingDaily.toLocaleString()}, reserve $${remainingReserve.toLocaleString()}. Requested $${requested.toLocaleString()} → approved $${effective.toLocaleString()}.`;
  }

  return {
    agentType: "risk_governor",
    vote,
    score,
    reasoning,
    signature: signVote("risk_governor", clusterId, vote, score),
    toolProofs: {
      tier,
      hardCap,
      requested,
      effective,
      vault: { reserveUSD: vault.reserveUSD, dailyLimitUSD: vault.dailyLimitUSD, disbursedTodayUSD: vault.disbursedTodayUSD },
    },
  };
}
