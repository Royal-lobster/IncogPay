"use client";

import { Clock, PaperPlaneTilt, ArrowCounterClockwise, Wallet } from "@phosphor-icons/react";
import type { SendIntent } from "@/lib/types";

const steps = [
  { icon: Wallet,          role: "Step 1", title: "Deposit into private pool",  desc: "Approve + shield your funds. You'll need a tiny amount of gas (~$0.10).", time: "~2 min" },
  { icon: Clock,           role: "Step 2", title: "Funds mix in pool",          desc: "RAILGUN runs an on-chain privacy check. Funds are safe — cancel anytime.", time: "~1 hour" },
  { icon: PaperPlaneTilt,  role: "Step 3", title: "Enter recipient & send",     desc: "Confirm the destination. No native token needed — relayer handles gas.",   time: "~1 min"  },
];

export function PreflightStep({ intent, onStart, onCancel }: { intent: SendIntent; onStart: () => void; onCancel: () => void }) {
  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight mb-1">How it works</h2>
      <p className="text-sm text-zinc-400 mb-4">
        Sending <span className="text-zinc-100 font-medium">{intent.amount} {intent.token}</span> privately takes 3 steps.
      </p>

      <div className="space-y-2 mb-4">
        {steps.map((s, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/40 to-transparent" />
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 ring-1 ring-pink-500/20">
                <s.icon size={13} weight="duotone" className="text-pink-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">{s.role}</span>
                  <span className="text-[10px] text-zinc-600">{s.time}</span>
                </div>
                <p className="text-sm font-medium text-zinc-200 mb-0.5">{s.title}</p>
                <p className="text-xs text-zinc-500">{s.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 px-3 py-2.5 mb-4 flex gap-2.5">
        <ArrowCounterClockwise size={12} weight="bold" className="text-zinc-600 mt-0.5 shrink-0" />
        <p className="text-xs text-zinc-500">Cancel at any step. Funds return to your wallet minus gas (~$0.10–$3 depending on when).</p>
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors">Cancel</button>
        <button onClick={onStart} className="flex-1 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors">Start →</button>
      </div>
    </div>
  );
}
