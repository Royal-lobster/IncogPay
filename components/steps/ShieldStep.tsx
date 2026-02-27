"use client";

import { useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { CircleNotch, ShieldCheck } from "@phosphor-icons/react";
import type { SendIntent } from "@/lib/types";

type Status = "idle" | "connecting" | "approving" | "shielding" | "done" | "error";

export function ShieldStep({ intent, onSuccess, onCancel }: { intent: SendIntent; onSuccess: (txHash: string) => void; onCancel: () => void }) {
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const fee = parseFloat(intent.amount) * 0.0025;
  const net = parseFloat(intent.amount) - fee;
  const busy = ["connecting", "approving", "shielding"].includes(status);

  const handleShield = async () => {
    try {
      if (!isConnected) { setStatus("connecting"); connect({ connector: injected() }); }
      setStatus("approving");
      await new Promise((r) => setTimeout(r, 1500));
      setStatus("shielding");
      await new Promise((r) => setTimeout(r, 2000));
      onSuccess("0xmocktxhash");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Transaction failed");
      setStatus("error");
    }
  };

  const label: Record<Status, string> = { idle: "Deposit into pool", connecting: "Connecting wallet...", approving: "Approve in wallet...", shielding: "Shielding funds...", done: "Shielded", error: "Try again" };

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight mb-1">Deposit into private pool</h2>
      <p className="text-sm text-zinc-400 mb-6">Approve and shield your funds. This is the only step that uses your public wallet.</p>

      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 mb-3">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/40 to-transparent" />
        <div className="space-y-2">
          <div className="flex justify-between text-sm"><span className="text-zinc-400">You deposit</span><span className="text-zinc-100 font-medium">{intent.amount} {intent.token}</span></div>
          <div className="flex justify-between text-xs"><span className="text-zinc-600">Protocol fee (0.25%)</span><span className="text-zinc-600">−{fee.toFixed(2)} {intent.token}</span></div>
          <div className="h-px bg-zinc-800 my-1" />
          <div className="flex justify-between text-sm"><span className="text-zinc-400">Private balance</span><span className="text-emerald-400 font-medium">+{net.toFixed(2)} {intent.token}</span></div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 px-4 py-3 mb-6">
        <p className="text-xs text-zinc-500">You'll also need a small amount of native token for gas (~$0.10).</p>
      </div>

      {error && <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 mb-4"><p className="text-xs text-red-400">{error}</p></div>}

      <button onClick={handleShield} disabled={busy} className={`w-full py-3.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${busy ? "bg-pink-950 text-pink-400 cursor-not-allowed" : "bg-white text-black hover:bg-zinc-200"}`}>
        {busy ? <CircleNotch size={14} className="animate-spin" /> : <ShieldCheck size={14} weight="duotone" />}
        {label[status]}
      </button>
    </div>
  );
}
