"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function VaultStateDisplay() {
  const [vault, setVault] = useState<{
    reserveUSD: number;
    dailyLimitUSD: number;
    disbursedTodayUSD: number;
    remainingDaily: number;
    pctUsed: number;
  } | null>(null);
  const [depositing, setDepositing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");

  const fetchVault = async () => {
    try {
      const res = await fetch("/api/vault/state", { cache: "no-store" });
      const data = await res.json();
      if (data.vault) setVault(data.vault);
    } catch {}
  };

  const handleDeposit = async () => {
    const amt = Number(depositAmount);
    if (!amt || amt <= 0) return;
    setDepositing(true);
    try {
      await fetch("/api/vault/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amt }) });
      setDepositAmount("");
      fetchVault();
    } catch {}
    finally { setDepositing(false); }
  };

  useEffect(() => {
    fetchVault();
    const intv = setInterval(fetchVault, 30000);
    return () => clearInterval(intv);
  }, []);

  if (!vault) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2.5 border border-border bg-card/50 p-3"
    >
      <div className="flex items-center justify-between">
        <span className="mono-label text-[9px] text-muted-foreground">Relief Vault</span>
        <span className="font-mono text-[9px] text-muted-foreground">Mock USDC reserve</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[10px]">
        <div><span className="text-muted-foreground">RESERVE</span> <span className="ml-1 tabular-nums text-foreground">${vault.reserveUSD.toLocaleString()}</span></div>
        <div><span className="text-muted-foreground">DAILY CAP</span> <span className="ml-1 tabular-nums text-signal-bright">${vault.dailyLimitUSD.toLocaleString()}</span></div>
        <div><span className="text-muted-foreground">USED TODAY</span> <span className="ml-1 tabular-nums text-red-300">${vault.disbursedTodayUSD.toLocaleString()}</span></div>
        <div><span className="text-muted-foreground">REMAINING</span> <span className="ml-1 tabular-nums text-green-300">${vault.remainingDaily.toLocaleString()}</span></div>
      </div>
      <div className="h-1 overflow-hidden bg-muted">
        <motion.div
          className="h-full bg-signal-bright"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: Math.min(vault.pctUsed / 100, 1) }}
          transition={{ type: "spring", damping: 20, stiffness: 120 }}
          style={{ transformOrigin: "left" }}
        />
      </div>
      <p className="text-right font-mono text-[9px] tabular-nums text-muted-foreground">{vault.pctUsed}% of daily limit used</p>

      <div className="flex gap-2 border-t border-border pt-2.5">
        <input
          type="number"
          placeholder="Deposit USD"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          className="flex-1 border border-input bg-background px-2 py-1 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleDeposit}
          disabled={depositing}
          className="mono-label border border-border bg-transparent px-3 py-1 text-[9px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
        >
          {depositing ? "…" : "Deposit"}
        </button>
      </div>
    </motion.div>
  );
}
