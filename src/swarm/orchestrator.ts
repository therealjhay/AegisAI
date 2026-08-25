import type { AgentVoteInput, QuorumResult } from "./types.js";
import { triangulatorAgent } from "./agents/triangulator.js";
import { factCheckerAgent } from "./agents/factChecker.js";
import { triageEvaluatorAgent } from "./agents/triageEvaluator.js";
import { riskGovernorAgent, type VaultSnapshot } from "./agents/riskGovernor.js";
import { quorumHash } from "./crypto.js";

/**
 * Pillar 2: Multi-Agent Verification Quorum — 3-of-4 cryptographic signatures.
 */
export async function runSwarmQuorum(
  input: AgentVoteInput & { vault?: VaultSnapshot }
): Promise<QuorumResult> {
  // Run triage first to get tier/amount for governor
  const triage = await triageEvaluatorAgent(input);
  const tier = (triage.toolProofs as any).tier as number;
  const rawAmount = (triage.toolProofs as any).amount as number;

  // Run triangulator + fact-checker + governor in parallel (triage already done)
  const [triangulator, factChecker, governor] = await Promise.all([
    triangulatorAgent(input),
    factCheckerAgent(input),
    riskGovernorAgent({ ...(input as any), tier, requestedAmount: rawAmount, vault: input.vault }),
  ]);

  const votes = [triangulator, factChecker, triage, governor];
  const yesCount = votes.filter((v) => v.vote === "yes").length;
  const quorumReached = yesCount >= 3;

  // Governor effective amount is authoritative capped amount
  const cappedAmountUSD = (governor.toolProofs as any).effective as number;

  let status: QuorumResult["status"];
  if (quorumReached && cappedAmountUSD > 0) status = "verified";
  else if (votes.filter((v) => v.vote === "no").length >= 2) status = "quarantined";
  else status = "audit_required";

  const hash = quorumHash(votes.map((v) => ({ agentType: v.agentType, vote: v.vote, signature: v.signature })));

  return {
    clusterId: input.clusterId,
    votes,
    yesCount,
    quorumReached,
    status,
    tier,
    cappedAmountUSD,
    quorumHash: hash,
  };
}

export type SwarmExecTrace = {
  quorum: QuorumResult;
  trace: Array<{ agentType: string; phase: string; at: string; detail: string }>;
};
