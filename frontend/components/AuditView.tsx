"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { IconArrowUpRight, IconCheck, IconClipboard, IconPin, IconPulse, IconSearch, IconShield, IconSwarm, IconX } from "@/components/icons";

export type AuditData = {
  cluster: {
    id: string;
    lat: number;
    lon: number;
    radiusM: number;
    reportCount: number;
    totalFinancialTarget: number;
    tier: number | null;
    status: string;
    quorumHash: string | null;
    sources: string[];
    createdAt: string;
  };
  votes: Array<{
    agentType: string;
    vote: string;
    score: number;
    reasoning: string;
    signature: string;
    toolProofs: Record<string, unknown>;
    createdAt: string;
  }>;
  disbursements: Array<{
    id: string;
    amountUSD: number;
    recipientWallet: string;
    recipientOrg: string | null;
    quorumHash: string;
    txSignature: string;
    explorerUrl: string | null;
    tier: number | null;
    status: string;
    createdAt: string;
  }>;
  alerts: Array<{
    id: string;
    rawText: string;
    source: string;
    urgencyScore: number;
    financialTargetUSD: number;
    financialRaisedUSD: number;
    sourceCredibilityScore: number;
    verifiedStatus: boolean;
    timestamp: string;
  }>;
  quorum: {
    yesCount: number;
    quorumReached: boolean;
    quorumHash: string | null;
    status: string;
  };
  generatedAt: string;
};

const AGENT_LABELS: Record<string, { label: string; icon: ReactNode }> = {
  triangulator: { label: "Triangulator", icon: <IconPin /> },
  fact_checker: { label: "Fact-Checker", icon: <IconSearch /> },
  triage_evaluator: { label: "Triage Evaluator", icon: <IconPulse /> },
  risk_governor: { label: "Risk Governor", icon: <IconShield /> },
};

const FALLBACK_AGENT = { label: "Agent", icon: <IconSwarm /> };

const VOTE_STYLES: Record<string, string> = {
  yes: "text-green-400 bg-green-500/10",
  no: "text-red-400 bg-red-500/10",
  abstain: "text-signal-bright bg-signal-bright/10",
};

type Props = {
  clusterId: string;
  onClose: () => void;
};

export function AuditView({ clusterId, onClose }: Props) {
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = async () => {
    try {
      const res = await fetch(`/api/audit/${encodeURIComponent(clusterId)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setAudit(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, [clusterId]);

  if (loading) {
    return (
      <motion.div className="flex flex-1 items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="font-mono text-xs text-muted-foreground">Loading audit trail…</div>
      </motion.div>
    );
  }

  if (error || !audit) {
    return (
      <motion.div className="flex flex-1 items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="text-center text-xs text-red-400">Failed to load audit: {error || "No data"}</div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="mono-label text-[9px] text-muted-foreground">Audit Trail</p>
          <h3 className="mt-1 text-sm font-semibold tracking-tight">Verifiable record</h3>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close audit panel"
        >
          <IconX width={14} height={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Cluster Summary */}
        <motion.div className="border border-border bg-card/50 p-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2">
            <span className="text-green-400">
              {audit.cluster.status === "disbursed" || audit.cluster.status === "verified" ? <IconCheck width={15} height={15} /> : <IconClipboard width={15} height={15} />}
            </span>
            <span className="text-xs font-medium">Cluster <span className="ml-1 font-mono text-[10px] text-muted-foreground">{audit.cluster.id.slice(0, 12)}…</span></span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[10px]">
            <div><span className="text-muted-foreground">STATUS</span> <span className="ml-1 capitalize text-foreground">{audit.cluster.status}</span></div>
            <div><span className="text-muted-foreground">TIER</span> <span className="ml-1 text-foreground">{audit.cluster.tier ?? "—"}</span></div>
            <div><span className="text-muted-foreground">REPORTS</span> <span className="ml-1 tabular-nums text-foreground">{audit.cluster.reportCount}</span></div>
            <div><span className="text-muted-foreground">RADIUS</span> <span className="ml-1 tabular-nums text-foreground">{Math.round(audit.cluster.radiusM)}m</span></div>
            <div><span className="text-muted-foreground">TARGET</span> <span className="ml-1 tabular-nums text-foreground">${audit.cluster.totalFinancialTarget.toLocaleString()}</span></div>
            <div><span className="text-muted-foreground">QUORUM</span> <span className="ml-1 text-foreground">{audit.quorum.yesCount}/4 {audit.quorum.quorumReached ? "✓" : "✗"}</span></div>
            <div className="col-span-2"><span className="text-muted-foreground">SOURCES</span> <span className="ml-1 text-foreground">{audit.cluster.sources.join(", ")}</span></div>
            <div className="col-span-2 break-all"><span className="text-muted-foreground">Q-HASH</span> <span className="ml-1 text-signal-bright">{audit.cluster.quorumHash ?? "—"}</span></div>
          </div>
          <p className="mt-3 border-t border-border pt-2 font-mono text-[9px] text-muted-foreground">
            Generated {new Date(audit.generatedAt).toLocaleString()}
          </p>
        </motion.div>

        {/* Agent Votes */}
        <motion.div className="space-y-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}>
          <h4 className="mono-label text-[9px] text-muted-foreground">Agent votes · signed</h4>
          {audit.votes.map((v) => {
            const agent = AGENT_LABELS[v.agentType] || FALLBACK_AGENT;
            return (
              <div key={`${v.agentType}-${v.createdAt}`} className="border border-border bg-card/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{agent.icon}</span>
                  <span className="text-xs font-medium">{agent.label}</span>
                  <span className={`mono-label ml-auto px-1.5 py-0.5 text-[8px] font-semibold ${VOTE_STYLES[v.vote] ?? "text-muted-foreground bg-muted"}`}>
                    {v.vote.toUpperCase()}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                  <span>CONF <span className="tabular-nums text-foreground">{(v.score * 100).toFixed(1)}%</span></span>
                  <span className="truncate">SIG {v.signature.slice(0, 16)}…</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{v.reasoning}</p>
                <details className="group">
                  <summary className="mt-2 flex cursor-pointer items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
                    Tool proofs <span className="transition-transform group-open:rotate-90">›</span>
                  </summary>
                  <pre className="mt-1.5 overflow-x-auto bg-background p-2 font-mono text-[9px] text-muted-foreground">{JSON.stringify(v.toolProofs, null, 2)}</pre>
                </details>
              </div>
            );
          })}
        </motion.div>

        {/* Disbursements */}
        {audit.disbursements.length > 0 && (
          <motion.div className="space-y-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}>
            <h4 className="mono-label text-[9px] text-muted-foreground">On-chain disbursements</h4>
            {audit.disbursements.map((d, i) => (
              <div key={d.id} className="border border-green-500/30 bg-green-500/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="mono-label text-[9px] text-green-400">Disbursement #{i + 1}</span>
                  <a href={d.explorerUrl || "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                    Explorer <IconArrowUpRight width={11} height={11} />
                  </a>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[10px]">
                  <div><span className="text-muted-foreground">AMOUNT</span> <span className="ml-1 tabular-nums text-signal-bright">${d.amountUSD.toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">TIER</span> <span className="ml-1 text-foreground">{d.tier ?? "—"}</span></div>
                  <div className="col-span-2 break-all"><span className="text-muted-foreground">RECIPIENT</span> <span className="ml-1 text-foreground">{d.recipientWallet}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">ORG</span> <span className="ml-1 text-foreground">{d.recipientOrg ?? "—"}</span></div>
                  <div className="col-span-2 break-all"><span className="text-muted-foreground">TX</span> <span className="ml-1 text-foreground">{d.txSignature}</span></div>
                  <div className="col-span-2 break-all"><span className="text-muted-foreground">Q-HASH</span> <span className="ml-1 text-signal-bright">{d.quorumHash}</span></div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Raw Alerts */}
        <motion.div className="space-y-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}>
          <h4 className="mono-label text-[9px] text-muted-foreground">Raw alerts in cluster</h4>
          {audit.alerts.map((a: AuditData["alerts"][0]) => (
            <div key={a.id} className="border border-border bg-card/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">{a.id.slice(0, 12)}…</span>
                <span className={`mono-label px-1.5 py-0.5 text-[8px] ${a.verifiedStatus ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {a.verifiedStatus ? "Verified" : "Pending"}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{a.rawText}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] tabular-nums text-muted-foreground">
                <span>SRC {a.source}</span>
                <span>URG {a.urgencyScore}</span>
                <span>CRED {(a.sourceCredibilityScore * 100).toFixed(0)}%</span>
                <span>TGT ${a.financialTargetUSD.toLocaleString()}</span>
                <span>{new Date(a.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
