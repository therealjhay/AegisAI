"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

import { IconCheck, IconPin, IconPulse, IconRefresh, IconSearch, IconShield, IconSwarm, IconX, IconZap } from "@/components/icons";

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

const AGENT_LABELS: Record<string, { label: string; icon: ReactNode; color: string }> = {
  triangulator: { label: "Triangulator", icon: <IconPin />, color: "text-sky-400" },
  fact_checker: { label: "Fact-Checker", icon: <IconSearch />, color: "text-green-400" },
  triage_evaluator: { label: "Triage Evaluator", icon: <IconPulse />, color: "text-signal-bright" },
  risk_governor: { label: "Risk Governor", icon: <IconShield />, color: "text-purple-400" },
};

const FALLBACK_AGENT = { label: "Agent", icon: <IconSwarm />, color: "text-muted-foreground" };

const VOTE_COLOR: Record<string, string> = {
  yes: "text-green-400 bg-green-500/10 border-green-500/30",
  no: "text-red-400 bg-red-500/10 border-red-500/30",
  abstain: "text-signal-bright bg-signal-bright/10 border-signal-bright/30",
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
        <div>
          <p className="mono-label text-[9px] text-muted-foreground">Swarm Quorum</p>
          <h3 className="mt-1 text-sm font-semibold tracking-tight">Verification vote</h3>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close swarm panel"
        >
          <IconX width={14} height={14} />
        </button>
      </div>

      {error && (
        <motion.div className="mx-4 mt-3 border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {error}
        </motion.div>
      )}

      {!quorum && !loading && (
        <motion.div className="flex flex-1 items-center justify-center p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No swarm run yet for this cluster.</p>
            <button
              onClick={runSwarm}
              disabled={loading}
              className="mono-label mt-4 bg-signal-bright px-5 py-2.5 text-[10px] font-semibold text-navy-deep transition-colors hover:bg-signal disabled:opacity-50"
            >
              Run 4-Agent Swarm
            </button>
          </div>
        </motion.div>
      )}

      {loading && quorum && (
        <motion.div className="mx-4 mt-3 border border-signal-bright/30 bg-signal-bright/10 p-3 font-mono text-[11px] text-signal-bright" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          Refreshing quorum…
        </motion.div>
      )}

      {quorum && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Quorum Header */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border p-4 ${
              quorum.status === "verified"
                ? "border-green-500/30 bg-green-500/5"
                : quorum.status === "audit_required"
                ? "border-signal-bright/30 bg-signal-bright/5"
                : "border-red-500/30 bg-red-500/5"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`mono-label px-1.5 py-0.5 text-[9px] font-semibold ${
                quorum.status === "verified"
                  ? "bg-green-500/20 text-green-400"
                  : quorum.status === "audit_required"
                  ? "bg-signal-bright/20 text-signal-bright"
                  : "bg-red-500/20 text-red-400"
              }`}>
                {quorum.status.toUpperCase()}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{quorum.yesCount}/4 YES — {quorum.quorumReached ? "QUORUM REACHED" : "QUORUM NOT MET"}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] tabular-nums text-muted-foreground">
              <span>TIER <span className="text-foreground">{quorum.tier}</span></span>
              <span>CAPPED <span className="text-signal-bright">${quorum.cappedAmountUSD.toLocaleString()}</span></span>
              <span className="truncate">HASH {quorum.quorumHash?.slice(0, 16)}…</span>
            </div>
          </motion.div>

          {/* Agent Votes */}
          <div className="space-y-2">
            {quorum.votes.map((v, i) => {
              const agent = AGENT_LABELS[v.agentType] || FALLBACK_AGENT;
              return (
                <motion.div
                  key={v.agentType}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: 0.08 * i } }}
                  className="border border-border bg-card/50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className={agent.color}>{agent.icon}</span>
                    <span className={`text-xs font-medium ${agent.color}`}>{agent.label}</span>
                    <span className={`mono-label ml-auto border px-1.5 py-0.5 text-[8px] font-semibold ${VOTE_COLOR[v.vote]}`}>
                      {VOTE_LABEL[v.vote]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                    <span>CONF <span className="tabular-nums text-foreground">{(v.score * 100).toFixed(1)}%</span></span>
                    <span className="truncate">SIG {v.signature.slice(0, 12)}…</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{v.reasoning}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
                      Tool proofs
                    </summary>
                    <pre className="mt-1.5 overflow-x-auto bg-background p-2 font-mono text-[9px] text-muted-foreground">{JSON.stringify(v.toolProofs, null, 2)}</pre>
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
              className="space-y-3 border-t border-border pt-3"
            >
              <div className="border border-signal-bright/30 bg-signal-bright/5 p-3">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="mono-label text-[9px] text-signal-bright">Ready for disbursement</span>
                  <span className="tabular-nums text-signal-bright">${quorum.cappedAmountUSD.toLocaleString()} USDC</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">3-of-4 signatures verified. Parametric cap applied by Risk Governor. Execute to transfer on-chain.</p>
              </div>
              <button
                onClick={handleDisburse}
                disabled={disbursing}
                className="mono-label flex h-10 w-full items-center justify-center gap-2 bg-signal-bright px-4 text-[10px] font-semibold text-navy-deep transition-colors hover:bg-signal disabled:opacity-50"
              >
                <IconZap width={13} height={13} />
                {disbursing ? "Executing…" : "Execute Disbursement"}
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
                className="space-y-2 border border-green-500/30 bg-green-500/5 p-3"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-green-400">
                  <IconCheck width={14} height={14} />
                  Disbursement confirmed
                </div>
                <div className="break-all font-mono text-[10px] text-muted-foreground">TX {disburseResult.txSig}</div>
                <a href={disburseResult.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">
                  View on Explorer →
                </a>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Manual Refresh */}
          <button
            onClick={runSwarm}
            disabled={loading}
            className="mono-label flex w-full items-center justify-center gap-1.5 border-t border-border pt-3 pb-1 text-[9px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <IconRefresh width={11} height={11} />
            Re-run swarm
          </button>
        </div>
      )}
    </motion.div>
  );
}
