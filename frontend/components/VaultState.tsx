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
      className="rounded-lg border border-border bg-card/50 p-3 space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Relief Vault</span>
        <span className="text-[10px] text-muted-foreground">Mock USDC Reserve</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Reserve:</span>
          <span className="ml-1 font-mono tabular-nums text-foreground">${vault.reserveUSD.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Daily Limit:</span>
          <span className="ml-1 font-mono tabular-nums text-amber-300">${vault.dailyLimitUSD.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Used Today:</span>
          <span className="ml-1 font-mono tabular-nums text-red-300">${vault.disbursedTodayUSD.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Remaining:</span>
          <span className="ml-1 font-mono tabular-nums text-green-300">${vault.remainingDaily.toLocaleString()}</span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-amber-500 rounded-full"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: Math.min(vault.pctUsed / 100, 1) }}
          transition={{ type: "spring", damping: 20, stiffness: 120 }}
          style={{ transformOrigin: "left" }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground text-right">{vault.pctUsed}% of daily limit used</p>

      <div className="border-t border-border pt-2 flex gap-2">
        <input
          type="number"
          placeholder="Deposit USD"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          className="flex-1 px-2 py-1 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button onClick={handleDeposit} disabled={depositing} className="px-3 py-1 text-xs rounded border border-border bg-card hover:bg-muted disabled:opacity-50">
          {depositing ? "…" : "Deposit"}
        </button>
      </div>
    </motion.div>
  );
}