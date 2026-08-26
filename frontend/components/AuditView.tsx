"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

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

const AGENT_LABELS: Record<string, { label: string; icon: string }> = {
  triangulator: { label: "Triangulator", icon: "📍" },
  fact_checker: { label: "Fact-Checker", icon: "🔍" },
  triage_evaluator: { label: "Triage Evaluator", icon: "📊" },
  risk_governor: { label: "Risk Governor", icon: "🛡️" },
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
        <div className="text-center text-muted-foreground">Loading audit trail…</div>
      </motion.div>
    );
  }

  if (error || !audit) {
    return (
      <motion.div className="flex flex-1 items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="text-center text-red-400">Failed to load audit: {error || "No data"}</div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Verifiable Audit Trail</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Cluster Summary */}
        <motion.div className="rounded-lg border border-border bg-card/50 p-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{audit.cluster.status === "disbursed" ? "✅" : audit.cluster.status === "verified" ? "✓" : "⚠️"}</span>
            <span className="font-medium">Cluster: <span className="font-mono text-xs ml-1">{audit.cluster.id.slice(0, 12)}…</span></span>
            <span className="ml-auto text-xs text-muted-foreground">Generated: {new Date(audit.generatedAt).toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Status:</span> <span className="ml-1 font-mono capitalize">{audit.cluster.status}</span></div>
            <div><span className="text-muted-foreground">Tier:</span> <span className="ml-1 font-mono">{audit.cluster.tier ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Reports:</span> <span className="ml-1 font-mono">{audit.cluster.reportCount}</span></div>
            <div><span className="text-muted-foreground">Radius:</span> <span className="ml-1 font-mono">{Math.round(audit.cluster.radiusM)}m</span></div>
            <div><span className="text-muted-foreground">Target:</span> <span className="ml-1 font-mono tabular-nums">${audit.cluster.totalFinancialTarget.toLocaleString()}</span></div>
            <div><span className="text-muted-foreground">Quorum:</span> <span className="ml-1 font-mono">{audit.quorum.yesCount}/4 {audit.quorum.quorumReached ? "✓" : "✗"}</span></div>
            <div className="col-span-2"><span className="text-muted-foreground">Sources:</span> <span className="ml-1 font-mono text-[10px]">{audit.cluster.sources.join(", ")}</span></div>
            <div className="col-span-2"><span className="text-muted-foreground">Quorum Hash:</span> <span className="ml-1 font-mono text-[10px] break-all">{audit.cluster.quorumHash ?? "—"}</span></div>
          </div>
        </motion.div>

        {/* Agent Votes */}
        <motion.div className="space-y-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Agent Votes (Cryptographic Signatures)</h4>
          {audit.votes.map((v) => {
            const agent = AGENT_LABELS[v.agentType] || { label: v.agentType, icon: "🤖" };
            const voteStyles = v.vote === "yes"
              ? "text-green-400 bg-green-500/10"
              : v.vote === "no"
              ? "text-red-400 bg-red-500/10"
              : "text-signal-bright bg-signal-bright/10";
            return (
              <div key={`${v.agentType}-${v.createdAt}`} className="rounded-lg border border-border bg-card/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{agent.icon}</span>
                  <span className="font-medium">{agent.label}</span>
                  <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-semibold ${voteStyles}`}>
                    {v.vote.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground mb-2">
                  <div>Confidence: <span className="font-mono tabular-nums text-foreground">{(v.score * 100).toFixed(1)}%</span></div>
                  <div>Signature: <span className="font-mono text-[10px] ml-1">{v.signature.slice(0, 16)}…</span></div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{v.reasoning}</p>
                <details className="group">
                  <summary className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1">
                    Tool Proofs <span className="transition-transform group-open:rotate-90">▶</span>
                  </summary>
                  <pre className="mt-1 p-2 bg-background rounded text-[9px] overflow-x-auto font-mono text-muted-foreground">{JSON.stringify(v.toolProofs, null, 2)}</pre>
                </details>
              </div>
            );
          })}
        </motion.div>

        {/* Disbursements */}
        {audit.disbursements.length > 0 && (
          <motion.div className="space-y-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">On-Chain Disbursements</h4>
            {audit.disbursements.map((d, i) => (
              <div key={d.id} className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-400 font-medium text-xs">DISBURSEMENT #{i + 1}</span>
                  <a href={d.explorerUrl || "#"} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">Explorer →</a>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><span className="text-muted-foreground">Amount:</span> <span className="ml-1 font-mono tabular-nums text-signal-bright">${d.amountUSD.toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Tier:</span> <span className="ml-1 font-mono">{d.tier ?? "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Recipient:</span> <span className="ml-1 font-mono text-[10px] break-all">{d.recipientWallet}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Org:</span> <span className="ml-1">{d.recipientOrg ?? "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Tx Hash:</span> <span className="ml-1 font-mono text-[10px] break-all">{d.txSignature}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Quorum Hash:</span> <span className="ml-1 font-mono text-[10px] break-all">{d.quorumHash}</span></div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Raw Alerts */}
        <motion.div className="space-y-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raw Alerts in Cluster</h4>
          {audit.alerts.map((a: AuditData["alerts"][0]) => (
            <div key={a.id} className="rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-mono text-[10px] text-muted-foreground">{a.id.slice(0, 12)}…</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] ${a.verifiedStatus ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {a.verifiedStatus ? "Verified" : "Pending"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-1">{a.rawText}</p>
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <span>Source: <span className="font-mono">{a.source}</span></span>
                <span>Urgency: <span className="font-mono tabular-nums">{a.urgencyScore}</span></span>
                <span>Cred: <span className="font-mono tabular-nums">{(a.sourceCredibilityScore * 100).toFixed(0)}%</span></span>
                <span>Target: <span className="font-mono tabular-nums">${a.financialTargetUSD.toLocaleString()}</span></span>
                <span>{new Date(a.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}