"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type Vote = {
  agentType: string;
  vote: "yes" | "no" | "abstain";
  score: number;
  reasoning: string;
  signature: string;
  toolProofs: Record<string, unknown>;
};

export type QuorumResult = {
  clusterId: string;
  votes: Vote[];
  yesCount: number;
  quorumReached: boolean;
  status: string;
  tier: number;
  cappedAmountUSD: number;
  quorumHash: string;
};

const AGENT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  triangulator: { label: "Triangulator", icon: "📍", color: "text-blue-400" },
  fact_checker: { label: "Fact-Checker", icon: "🔍", color: "text-green-400" },
  triage_evaluator: { label: "Triage Evaluator", icon: "📊", color: "text-signal-bright" },
  risk_governor: { label: "Risk Governor", icon: "🛡️", color: "text-purple-400" },
};

const VOTE_COLOR: Record<string, string> = {
  yes: "text-green-400 bg-green-500/10 border-green-500/20",
  no: "text-red-400 bg-red-500/10 border-red-500/20",
  abstain: "text-signal-bright bg-signal-bright/10 border-signal-bright/20",
};

const VOTE_LABEL: Record<string, string> = { yes: "APPROVE", no: "REJECT", abstain: "ABSTAIN" };

type Props = {
  clusterId?: string;
  onDisburse?: (clusterId: string, cappedAmount: number) => Promise<void>;
  onClose: () => void;
};

export function SwarmPanel({ clusterId, onDisburse, onClose }: Props) {
  const [quorum, setQuorum] = useState<QuorumResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disbursing, setDisbursing] = useState(false);
  const [disburseResult, setDisburseResult] = useState<{ txSig: string; explorerUrl: string } | null>(null);

  const fetchQuorum = async () => {
    if (!clusterId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/swarm/verify?clusterId=${encodeURIComponent(clusterId)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setQuorum(data.quorum || data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const runSwarm = async () => {
    if (!clusterId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/swarm/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clusterId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Swarm failed");
      setQuorum(data.quorum);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Swarm error");
    } finally {
      setLoading(false);
    }
  };

  const handleDisburse = async () => {
    if (!quorum || !clusterId || !onDisburse) return;
    setDisbursing(true);
    try {
      await onDisburse(clusterId, quorum.cappedAmountUSD);
      setDisburseResult({ txSig: "pending...", explorerUrl: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disburse failed");
    } finally {
      setDisbursing(false);
    }
  };

  useEffect(() => {
    if (clusterId) fetchQuorum();
  }, [clusterId]);

  if (!clusterId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 text-center text-muted-foreground"
      >
        Select an incident to run swarm verification.
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Swarm Verification Quorum</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
      </div>

      {error && (
        <motion.div className="mx-4 mt-3 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-xs" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {error}
        </motion.div>
      )}

      {!quorum && !loading && (
        <motion.div className="flex flex-1 items-center justify-center p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="text-center">
            <p className="text-muted-foreground mb-4">No swarm run yet for this cluster.</p>
            <button onClick={runSwarm} disabled={loading} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {loading ? "Running..." : "Run 4-Agent Swarm"}
            </button>
          </div>
        </motion.div>
      )}

      {loading && quorum && (
        <motion.div className="mx-4 mt-3 p-3 rounded-md bg-signal-bright/10 border border-signal-bright/20 text-signal-bright text-xs" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          Refreshing quorum...
        </motion.div>
      )}

      {quorum && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Quorum Header */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-lg border p-4 ${
              quorum.status === "verified"
                ? "border-green-500/30 bg-green-500/5"
                : quorum.status === "audit_required"
                ? "border-signal-bright/30 bg-signal-bright/5"
                : "border-red-500/30 bg-red-500/5"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                quorum.status === "verified"
                  ? "bg-green-500/20 text-green-400"
                  : quorum.status === "audit_required"
                  ? "bg-signal-bright/20 text-signal-bright"
                  : "bg-red-500/20 text-red-400"
              }`}>
                {quorum.status.toUpperCase()}
              </span>
              <span className="text-xs text-muted-foreground">{quorum.yesCount}/4 YES — {quorum.quorumReached ? "QUORUM REACHED" : "QUORUM NOT MET"}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Tier: <span className="font-mono tabular-nums text-foreground">{quorum.tier}</span></span>
              <span>Capped: <span className="font-mono tabular-nums text-signal-bright">${quorum.cappedAmountUSD.toLocaleString()}</span></span>
              <span>Hash: <span className="font-mono text-[10px]">{quorum.quorumHash?.slice(0, 16)}…</span></span>
            </div>
          </motion.div>

          {/* Agent Votes */}
          <div className="space-y-2">
            {quorum.votes.map((v, i) => {
              const agent = AGENT_LABELS[v.agentType] || { label: v.agentType, icon: "🤖", color: "" };
              return (
                <motion.div
                  key={v.agentType}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: 0.08 * i } }}
                  className="rounded-lg border border-border bg-card/50 p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{agent.icon}</span>
                    <span className={`font-medium ${agent.color}`}>{agent.label}</span>
                    <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-semibold border ${VOTE_COLOR[v.vote]}`}>
                      {VOTE_LABEL[v.vote]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
                    <span>Confidence: <span className="font-mono tabular-nums text-foreground">{(v.score * 100).toFixed(1)}%</span></span>
                    <span>Sig: <span className="font-mono text-[10px]">{v.signature.slice(0, 12)}…</span></span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{v.reasoning}</p>
                  <details className="mt-2">
                    <summary className="text-[10px] text-muted-foreground cursor-pointer">Tool Proofs</summary>
                    <pre className="mt-1 p-2 bg-background rounded text-[9px] overflow-x-auto font-mono text-muted-foreground">{JSON.stringify(v.toolProofs, null, 2)}</pre>
                  </details>
                </motion.div>
              );
            })}
          </div>

          {/* Disburse Action */}
          {quorum.status === "verified" && quorum.cappedAmountUSD > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t border-border pt-3 space-y-3"
            >
              <div className="rounded-lg border border-signal-bright/30 bg-signal-bright/5 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-signal-bright font-medium">READY FOR DISBURSEMENT</span>
                  <span className="font-mono tabular-nums text-signal-bright">${quorum.cappedAmountUSD.toLocaleString()} USDC</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">3-of-4 signatures verified. Parametric cap applied by Risk Governor. Click to execute on-chain transfer.</p>
              </div>
              <button
                onClick={handleDisburse}
                disabled={disbursing}
                className="w-full h-10 rounded-md bg-signal-bright px-4 text-xs font-bold text-navy-deep transition-colors hover:bg-signal disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {disbursing ? "⏳ Executing…" : "⚡ Execute Disbursement"}
              </button>
            </motion.div>
          )}

          {/* Disbursement Result */}
          {disburseResult && (
            <AnimatePresence>
              <motion.div
                key="disburse-result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2"
              >
                <div className="flex items-center gap-2 text-green-400 text-xs font-medium">✓ DISBURSEMENT CONFIRMED</div>
                <div className="text-[10px] font-mono text-muted-foreground break-all">Tx: {disburseResult.txSig}</div>
                <a href={disburseResult.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">View on Explorer →</a>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Manual Refresh */}
          <button onClick={runSwarm} disabled={loading} className="w-full py-2 text-xs text-muted-foreground hover:text-foreground border-t border-border pt-2">
            ⟳ Re-run Swarm
          </button>
        </div>
      )}
    </motion.div>
  );
}