"use client";

import { Clock, Wallet, Send, RotateCcw } from "lucide-react";
import type { SendIntent } from "@/app/page";

const steps = [
  {
    icon: Wallet,
    role: "Step 1",
    title: "Deposit into private pool",
    desc: "Approve + shield your funds on Arbitrum. You'll need a tiny ETH for gas (~$0.10).",
    time: "~2 min",
  },
  {
    icon: Clock,
    role: "Step 2",
    title: "Funds mix in pool",
    desc: "RAILGUN runs an on-chain privacy check. Funds are safe — cancel anytime.",
    time: "~1 hour",
  },
  {
    icon: Send,
    role: "Step 3",
    title: "Enter recipient & send",
    desc: "Enter the destination address and confirm. No ETH needed — relayer handles gas.",
    time: "~1 min",
  },
];

export function PreflightStep({
  intent,
  onStart,
  onCancel,
}: {
  intent: SendIntent;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight mb-1">How it works</h2>
      <p className="text-sm text-zinc-400 mb-6">
        Sending{" "}
        <span className="text-zinc-100 font-medium">
          {intent.amount} {intent.token}
        </span>{" "}
        privately takes 3 steps.
      </p>

      <div className="space-y-3 mb-5">
        {steps.map((s, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
                <s.icon size={14} className="text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                    {s.role}
                  </span>
                  <span className="text-[10px] text-zinc-600">{s.time}</span>
                </div>
                <p className="text-sm font-medium text-zinc-200 mb-0.5">{s.title}</p>
                <p className="text-xs text-zinc-500">{s.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cancel note */}
      <div className="rounded-xl border border-zinc-800 px-4 py-3 mb-6 flex gap-3">
        <RotateCcw size={13} className="text-zinc-600 mt-0.5 shrink-0" />
        <p className="text-xs text-zinc-500">
          Cancel at any step. Funds return to your wallet minus gas (~$0.10–$3 depending on when).
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-full border border-zinc-700 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onStart}
          className="flex-1 py-3 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors"
        >
          Start →
        </button>
      </div>
    </div>
  );
}
