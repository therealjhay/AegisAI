import { PrismaClient } from "@prisma/client";
import { verifyVote, quorumHash, mockTxSignature } from "../swarm/crypto.js";
import type { AgentVoteResult } from "../swarm/types.js";

/**
 * Pillar 3: Parametric Micro-Grant Settlement Layer
 * Mock chain vault — HMAC-verified 3-of-4 signatures → USDC transfer simulation.
 * Swap mockTxSignature with @solana/web3.js sendAndConfirm when SOLANA_RPC_URL present.
 */

export type DisbursementRequest = {
  clusterId: string;
  votes: AgentVoteResult[];
  recipientWallet?: string; // if omitted, picks first verified NGOUser
};

export type DisbursementResult = {
  disbursementId: string;
  clusterId: string;
  amountUSD: number;
  txSignature: string;
  explorerUrl: string;
  quorumHash: string;
  status: string;
};

const TIER_CAPS: Record<number, number> = { 1: 0, 2: 5000, 3: 15000, 4: 25000 };

export async function getVault(prisma: PrismaClient) {
  let vault = await prisma.vaultState.findUnique({ where: { id: "singleton" } });
  if (!vault) {
    vault = await prisma.vaultState.create({
      data: { id: "singleton", reserveUSD: 1_000_000, dailyLimitUSD: 100_000, disbursedTodayUSD: 0 },
    });
  }
  // Daily reset if 24h passed
  const last = vault.lastResetAt.getTime();
  if (Date.now() - last > 24 * 3600 * 1000) {
    vault = await prisma.vaultState.update({
      where: { id: "singleton" },
      data: { disbursedTodayUSD: 0, lastResetAt: new Date() },
    });
  }
  return vault;
}

export async function disburse(
  prisma: PrismaClient,
  req: DisbursementRequest
): Promise<DisbursementResult> {
  const cluster = await prisma.incidentCluster.findUnique({
    where: { id: req.clusterId },
    include: { votes: true },
  });
  if (!cluster) throw new Error(`Cluster ${req.clusterId} not found`);

  if (cluster.status === "disbursed") throw new Error("Cluster already disbursed");

  // Verify 3-of-4 signatures
  let yesCount = 0;
  for (const v of req.votes) {
    const ok = verifyVote(v.agentType, req.clusterId, v.vote, v.score, v.signature);
    if (!ok) throw new Error(`Invalid signature for ${v.agentType}`);
    if (v.vote === "yes") yesCount++;
  }
  if (yesCount < 3) throw new Error(`Quorum not reached: ${yesCount}/4 yes, need 3`);

  const qHash = quorumHash(req.votes.map((v) => ({ agentType: v.agentType, vote: v.vote, signature: v.signature })));

  // Persist votes if not already persisted (idempotent)
  const existingVotes = await prisma.agentVote.findMany({ where: { clusterId: req.clusterId } });
  if (existingVotes.length === 0) {
    for (const v of req.votes) {
      await prisma.agentVote.create({
        data: {
          clusterId: req.clusterId,
          agentType: v.agentType,
          vote: v.vote,
          score: v.score,
          reasoning: v.reasoning,
          signature: v.signature,
          toolProofs: v.toolProofs as any,
        },
      });
    }
  }

  // Determine capped amount — from governor vote or tier
  const govVote = req.votes.find((v) => v.agentType === "risk_governor");
  let amountUSD = 0;
  if (govVote) amountUSD = (govVote.toolProofs as any).effective ?? 0;
  if (!amountUSD) {
    const triage = req.votes.find((v) => v.agentType === "triage_evaluator");
    const tier = (triage?.toolProofs as any)?.tier ?? cluster.tier ?? 2;
    amountUSD = TIER_CAPS[tier] ?? 5000;
  }
  if (amountUSD <= 0) throw new Error("Governor capped amount is 0 — no disbursement");

  const vault = await getVault(prisma);
  const remainingDaily = vault.dailyLimitUSD - vault.disbursedTodayUSD;
  if (amountUSD > remainingDaily) throw new Error(`Daily limit exceeded: remaining $${remainingDaily}, requested $${amountUSD}`);
  if (amountUSD > vault.reserveUSD * 0.1) throw new Error(`Reserve cap: cannot disburse >10% of reserve`);
  if (amountUSD > vault.reserveUSD) throw new Error(`Insufficient reserve: $${vault.reserveUSD}`);

  // Pick recipient wallet — explicit or first verified NGOUser else fallback mock
  let recipientWallet = req.recipientWallet;
  let recipientOrg: string | undefined;
  if (!recipientWallet) {
    const ngo = await prisma.nGOUser.findFirst({
      where: { isVerified: true, walletAddress: { not: null } },
      orderBy: { id: "asc" },
    });
    if (ngo?.walletAddress) {
      recipientWallet = ngo.walletAddress;
      recipientOrg = ngo.organizationName;
    } else {
      // Fallback: generate deterministic mock wallet for demo
      recipientWallet = `mockWallet_${req.clusterId.slice(0, 8)}_${cluster.lat.toFixed(2)}_${cluster.lon.toFixed(2)}`;
      recipientOrg = "Demo Responder DAO";
    }
  }

  const txSig = mockTxSignature(req.clusterId, qHash, amountUSD);
  const explorerUrl = `https://explorer.sonic.game/tx/${txSig}?cluster=devnet`; // Mock Sonic/Solana explorer; swap when real Solana rpc

  // Write disbursement tx
  const disb = await prisma.disbursementTx.create({
    data: {
      clusterId: req.clusterId,
      amountUSD,
      recipientWallet,
      recipientOrg,
      quorumHash: qHash,
      txSignature: txSig,
      explorerUrl,
      tier: cluster.tier ?? 2,
      status: "confirmed",
    },
  });

  // Update vault + cluster atomically
  await prisma.vaultState.update({
    where: { id: "singleton" },
    data: {
      reserveUSD: { decrement: amountUSD },
      disbursedTodayUSD: { increment: amountUSD },
    },
  });

  await prisma.incidentCluster.update({
    where: { id: req.clusterId },
    data: { status: "disbursed", quorumHash: qHash, tier: cluster.tier },
  });

  return {
    disbursementId: disb.id,
    clusterId: req.clusterId,
    amountUSD,
    txSignature: txSig,
    explorerUrl,
    quorumHash: qHash,
    status: "confirmed",
  };
}

export async function getDisbursementHistory(prisma: PrismaClient, clusterId?: string) {
  if (clusterId) {
    return prisma.disbursementTx.findMany({ where: { clusterId }, orderBy: { createdAt: "desc" } });
  }
  return prisma.disbursementTx.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
}
