"use client";

import { Clock, Wallet, Send, RotateCcw } from "lucide-react";
import type { SendIntent } from "@/app/page";

const steps = [
  { icon: Wallet, label: "Deposit into private pool", sub: "Approve + shield your funds. Needs a tiny ETH for gas (~$0.10).", time: "~2 min" },
  { icon: Clock, label: "Funds mix in pool", sub: "RAILGUN runs an on-chain privacy check. Cancel anytime to get funds back.", time: "~1 hour" },
  { icon: Send, label: "Enter recipient & confirm", sub: "Enter the address and send. Relayer handles gas — no ETH needed.", time: "~1 min" },
];

export function PreflightStep({ intent, onStart, onCancel }: {
  intent: SendIntent;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <p className="text-sm text-zinc-400 mb-6">
        Sending <span className="text-zinc-100 font-semibold">{intent.amount} {intent.token}</span> privately takes 3 steps and ~1 hour total.
      </p>

      <div className="space-y-3 mb-6">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
              <s.icon size={14} className="text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-medium text-zinc-200">{s.label}</span>
                <span className="text-xs text-zinc-600 shrink-0 ml-2">{s.time}</span>
              </div>
              <p className="text-xs text-zinc-500">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 mb-6">
        <RotateCcw size={13} className="text-zinc-600 mt-0.5 shrink-0" />
        <p className="text-xs text-zinc-500">
          You can cancel at any step. Funds return to your wallet minus gas (~$0.10–$3 depending on when).
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-3 rounded-full border border-zinc-700 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors">
          Cancel
        </button>
        <button onClick={onStart} className="flex-1 py-3 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors">
          Let's go →
        </button>
      </div>
    </div>
  );
}
