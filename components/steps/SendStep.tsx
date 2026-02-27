"use client";

import { useState } from "react";
import { CircleNotch, ShieldCheck } from "@phosphor-icons/react";
import type { SendIntent } from "@/lib/types";

type Status = "idle" | "proving" | "broadcasting" | "done" | "error";

export function SendStep({ intent, onSuccess, onCancel }: { intent: SendIntent; onSuccess: () => void; onCancel: () => void }) {
  const [recipient, setRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState(intent.amount);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const fee = parseFloat(intent.amount) * 0.0025;
  const available = parseFloat(intent.amount) - fee;
  const busy = ["proving", "broadcasting"].includes(status);
  const isValid = recipient.startsWith("0x") && recipient.length === 42 && parseFloat(sendAmount) > 0 && parseFloat(sendAmount) <= available;

  const handleSend = async () => {
    try {
      setStatus("proving");
      await new Promise((r) => setTimeout(r, 3000));
      setStatus("broadcasting");
      await new Promise((r) => setTimeout(r, 1500));
      setStatus("done");
      setTimeout(onSuccess, 600);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Send failed");
      setStatus("error");
    }
  };

  const label: Record<Status, string> = { idle: "Confirm Send", proving: "Generating ZK proof...", broadcasting: "Broadcasting...", done: "Sent", error: "Try again" };

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight mb-1">Send privately</h2>
      <p className="text-sm text-zinc-400 mb-4">Enter the recipient's address. A ZK proof will be generated — takes ~30 seconds.</p>

      <div className="flex justify-between text-xs px-1 mb-2">
        <span className="text-zinc-600">Available</span>
        <span className="text-zinc-400">{available.toFixed(2)} {intent.token}</span>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden mb-3">
        <div className="px-4 pt-4 pb-2 border-b border-zinc-800/60">
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">Recipient address</label>
          <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x..." className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none font-mono" />
        </div>
        <div className="px-4 pt-3 pb-4">
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">Amount</label>
          <div className="flex items-center gap-2">
            <input type="number" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} max={available} min={0} className="flex-1 bg-transparent text-xl font-semibold text-zinc-100 focus:outline-none" />
            <span className="text-sm text-zinc-500">{intent.token}</span>
            <button onClick={() => setSendAmount(available.toFixed(2))} className="text-[10px] font-medium text-pink-400 border border-pink-500/30 rounded-full px-2.5 py-1 hover:bg-pink-500/10 transition-colors uppercase tracking-widest">Max</button>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 mb-4 flex gap-3">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
        <ShieldCheck size={13} weight="duotone" className="text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-xs text-zinc-500">Recipient sees funds from the RAILGUN relayer — not your wallet address.</p>
      </div>

      {error && <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 mb-4"><p className="text-xs text-red-400">{error}</p></div>}

      <button onClick={handleSend} disabled={!isValid || busy} className={`w-full py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${!isValid || busy ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-white text-black hover:bg-zinc-200"}`}>
        {busy && <CircleNotch size={14} className="animate-spin" />}
        {label[status]}
      </button>

      {status === "proving" && <p className="text-center text-[11px] text-zinc-600 mt-2">ZK proof generation takes ~30 seconds</p>}
    </div>
  );
}
