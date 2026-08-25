import type { AgentVoteInput, AgentVoteResult } from "../types.js";
import { signVote } from "../crypto.js";

/**
 * Triage & Loss Evaluator: Tier 1-4 severity + parametric financial estimate.
 */

function estimateTier(urgencyScores: number[], text: string): number {
  const maxUrgency = Math.max(...urgencyScores, 1);
  const t = text.toLowerCase();
  // Tier 4 = catastrophic (casualties, trapped, infrastructure destroyed)
  if (maxUrgency >= 5 && /(trapped|casualt|dead|fatal|swept away|destroyed|collapse)/.test(t)) return 4;
  if (maxUrgency >= 5 || /(hundreds|many|widespread|evacuate now|rapidly rising)/.test(t)) return 3;
  if (maxUrgency >= 4 || /(injured|major damage|spreading fast|homes on fire)/.test(t)) return 2;
  if (maxUrgency >= 3) return 2;
  return 1;
}

function parametricAmount(tier: number, urgency: number, reportCount: number, text: string): number {
  const tierFloor: Record<number, number> = { 1: 0, 2: 5000, 3: 15000, 4: 40000 };
  let amount = tierFloor[tier] ?? 0;
  amount += urgency * 2500; // per urgency
  amount += reportCount * 1500; // per corroborating report
  const t = text.toLowerCase();
  if (/hundreds|many/.test(t)) amount += 20000;
  if (/infrastructure|destroyed|bridge|road closed/.test(t)) amount += 30000;
  if (/casualt|death|dead|fatal/.test(t)) amount += 25000;
  if (/hospital|clinic|medical/.test(t)) amount += 15000;
  // Cap per tier
  const tierCap: Record<number, number> = { 1: 2000, 2: 15000, 3: 40000, 4: 80000 };
  return Math.min(amount, tierCap[tier] ?? amount);
}

export async function triageEvaluatorAgent(input: AgentVoteInput): Promise<AgentVoteResult> {
  const { clusterId, urgencyScores, rawTexts, reportCount } = input;
  const combined = rawTexts.join(" ");
  const maxUrgency = Math.max(...urgencyScores, 1);
  const tier = estimateTier(urgencyScores, combined);
  const amount = parametricAmount(tier, maxUrgency, reportCount, combined);

  // Triage always votes yes if tier >=2 (needs funding), abstain tier 1
  let vote: "yes" | "no" | "abstain";
  let score: number;
  let reasoning: string;

  if (tier === 1) {
    vote = "abstain";
    score = 0.35;
    reasoning = `Tier 1 — low immediate threat (urgency ${maxUrgency}). Monitor, no parametric payout. Suggested $0.`;
  } else if (tier === 2) {
    vote = "yes";
    score = 0.68;
    reasoning = `Tier 2 — moderate severity (urgency ${maxUrgency}, tier ${tier}). Parametric estimate $${amount.toLocaleString()} (displaced/medical/logistics).`;
  } else if (tier === 3) {
    vote = "yes";
    score = 0.84;
    reasoning = `Tier 3 — high severity (urgency ${maxUrgency}, tier ${tier}). Parametric estimate $${amount.toLocaleString()} — major logistics/shelter need.`;
  } else {
    vote = "yes";
    score = 0.92;
    reasoning = `Tier 4 — catastrophic (urgency ${maxUrgency}, tier ${tier}). Parametric estimate $${amount.toLocaleString()} — immediate medical/evac/infrastructure.`;
  }

  return {
    agentType: "triage_evaluator",
    vote,
    score,
    reasoning,
    signature: signVote("triage_evaluator", clusterId, vote, score),
    toolProofs: { tier, maxUrgency, amount, reportCount, heuristic: "urgency+tier+keywords" },
  };
}

export function tierToCappedAmount(tier: number, rawAmount: number): number {
  const caps: Record<number, number> = { 1: 2000, 2: 15000, 3: 40000, 4: 80000 };
  return Math.min(rawAmount, caps[tier] ?? rawAmount);
}
