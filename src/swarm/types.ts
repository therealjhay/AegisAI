export type AgentType = "triangulator" | "fact_checker" | "triage_evaluator" | "risk_governor";

export type VoteValue = "yes" | "no" | "abstain";

export type AgentVoteInput = {
  clusterId: string;
  lat: number;
  lon: number;
  reportCount: number;
  radiusM: number;
  sources: string[];
  totalFinancialTarget: number;
  rawTexts: string[];
  urgencyScores: number[];
  incidentTypes: string[];
};

export type AgentVoteResult = {
  agentType: AgentType;
  vote: VoteValue;
  score: number; // 0..1
  reasoning: string;
  signature: string;
  toolProofs: Record<string, unknown>;
};

export type QuorumResult = {
  clusterId: string;
  votes: AgentVoteResult[];
  yesCount: number;
  quorumReached: boolean; // 3-of-4
  status: "verified" | "audit_required" | "quarantined";
  tier?: number;
  cappedAmountUSD?: number;
  quorumHash?: string;
};

export type SwarmTraceEvent = {
  agentType: AgentType;
  phase: "tool_call" | "reasoning" | "vote";
  detail: string;
  at: string;
};
