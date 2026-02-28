"use client";

import { Clock, Ghost, PaperPlaneTilt, ShieldCheck } from "@phosphor-icons/react";

const HOW_IT_WORKS = [
  { icon: ShieldCheck, text: "Approve and shield your funds into RAILGUN's private pool." },
  { icon: Clock, text: "Funds mix for ~1 hour while RAILGUN runs its on-chain privacy check." },
  {
    icon: PaperPlaneTilt,
    text: "Enter recipient, generate a ZK proof, and send via relayer. No ETH needed.",
  },
];

export function SendForm({ onSend }: { onSend: () => void }) {
  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="flex flex-col items-center mb-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/10 ring-1 ring-pink-500/20 mb-4">
          <Ghost size={28} weight="duotone" className="text-pink-400" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Send Privately</h1>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
          The recipient only sees the RAILGUN relayer — not your wallet address or balance.
        </p>
      </div>

      {/* How it works */}
      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-3">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/40 to-transparent" />
        <ul className="space-y-3">
          {HOW_IT_WORKS.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <item.icon size={14} weight="duotone" className="text-pink-400 mt-0.5 shrink-0" />
              <span className="text-xs text-zinc-400">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <button
        onClick={onSend}
        className="w-full py-3.5 rounded-full text-sm font-semibold bg-white text-black hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
      >
        <Ghost size={15} weight="duotone" />
        Start Sending
      </button>
    </div>
  );
}
