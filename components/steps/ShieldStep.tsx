"use client";

import { useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { Loader2 } from "lucide-react";
import type { SendIntent } from "@/app/page";

type ShieldStatus = "idle" | "connecting" | "approving" | "shielding" | "done" | "error";

export function ShieldStep({ intent, onSuccess, onCancel }: {
  intent: SendIntent;
  onSuccess: (txHash: string) => void;
  onCancel: () => void;
}) {
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const [status, setStatus] = useState<ShieldStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const fee = parseFloat(intent.amount) * 0.0025;
  const net = parseFloat(intent.amount) - fee;
  const busy = ["connecting", "approving", "shielding"].includes(status);

  const handleShield = async () => {
    try {
      if (!isConnected) {
        setStatus("connecting");
        connect({ connector: injected() });
        return;
      }
      setStatus("approving");
      // TODO: approve ERC-20 spend via wagmi writeContract
      await new Promise((r) => setTimeout(r, 1500));

      setStatus("shielding");
      // TODO: RAILGUN SDK shield call
      await new Promise((r) => setTimeout(r, 2000));

      onSuccess("0xmocktxhash");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Transaction failed");
      setStatus("error");
    }
  };

  const btnLabel: Record<ShieldStatus, string> = {
    idle: isConnected ? "Approve & Shield" : "Connect Wallet",
    connecting: "Connecting...",
    approving: "Approve in wallet...",
    shielding: "Shielding funds...",
    done: "Shielded",
    error: "Try again",
  };

  return (
    <div>
      <p className="text-sm text-zinc-400 mb-6">
        Deposit your funds into RAILGUN's private pool. This is the only public transaction — everything after is private.
      </p>

      {/* Summary */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 mb-3 space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">You deposit</span>
          <span className="text-zinc-100 font-medium">{intent.amount} {intent.token}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-600">Protocol fee (0.25%)</span>
          <span className="text-zinc-600">−{fee.toFixed(2)} {intent.token}</span>
        </div>
        <div className="h-px bg-zinc-800" />
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Private balance</span>
          <span className="text-emerald-400 font-medium">+{net.toFixed(2)} {intent.token}</span>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 px-4 py-3 mb-6">
        <p className="text-xs text-zinc-600">
          You'll also need ~$0.10 of ETH on Arbitrum for the deposit gas fee.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 mb-4">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <button
        onClick={handleShield}
        disabled={busy}
        className={`w-full py-3.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
          busy
            ? "bg-violet-950 text-violet-400 cursor-not-allowed"
            : "bg-white text-black hover:bg-zinc-200"
        }`}
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        {btnLabel[status]}
      </button>
    </div>
  );
}
