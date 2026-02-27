"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import type { SendIntent } from "@/app/page";

type SendStatus = "idle" | "proving" | "broadcasting" | "done" | "error";

export function SendStep({ intent, onSuccess, onCancel }: {
  intent: SendIntent;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState(intent.amount);
  const [status, setStatus] = useState<SendStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const fee = parseFloat(intent.amount) * 0.0025;
  const available = parseFloat(intent.amount) - fee;
  const busy = ["proving", "broadcasting"].includes(status);
  const isValid = recipient.startsWith("0x") && recipient.length === 42 && parseFloat(sendAmount) > 0 && parseFloat(sendAmount) <= available;

  const handleSend = async () => {
    try {
      setStatus("proving");
      // TODO: RAILGUN SDK — generate ZK proof
      await new Promise((r) => setTimeout(r, 3000));

      setStatus("broadcasting");
      // TODO: RAILGUN SDK — broadcast via relayer
      await new Promise((r) => setTimeout(r, 1500));

      setStatus("done");
      setTimeout(onSuccess, 600);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Send failed");
      setStatus("error");
    }
  };

  return (
    <div>
      <p className="text-sm text-zinc-400 mb-6">
        Your funds are ready. Enter the recipient's wallet address and confirm.
      </p>

      {/* Available */}
      <div className="flex justify-between text-xs text-zinc-600 px-1 mb-2">
        <span>Available</span>
        <span>{available.toFixed(2)} {intent.token}</span>
      </div>

      {/* Recipient */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 mb-2 overflow-hidden focus-within:border-zinc-600 transition-colors">
        <div className="px-4 pt-3 pb-1">
          <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium">
            Recipient address
          </label>
        </div>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          className="w-full px-4 pb-3 text-sm text-zinc-100 bg-transparent placeholder:text-zinc-700 focus:outline-none font-mono"
        />
      </div>

      {/* Amount */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 mb-6 overflow-hidden focus-within:border-zinc-600 transition-colors">
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium">
            Amount
          </label>
          <button
            onClick={() => setSendAmount(available.toFixed(2))}
            className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors font-medium"
          >
            Max
          </button>
        </div>
        <div className="flex items-center px-4 pb-3 gap-2">
          <input
            type="number"
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
            className="flex-1 text-lg font-semibold text-zinc-100 bg-transparent focus:outline-none"
            max={available}
            min={0}
          />
          <span className="text-sm text-zinc-600">{intent.token}</span>
        </div>
      </div>

      {/* Privacy badge */}
      <div className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 mb-4">
        <ShieldCheck size={13} className="text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-xs text-zinc-500">
          Recipient sees funds from the RAILGUN relayer — not your wallet address.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 mb-4">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={!isValid || busy}
        className={`w-full py-3.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
          !isValid || busy
            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            : "bg-white text-black hover:bg-zinc-200"
        }`}
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        {status === "proving" ? "Generating proof..." : status === "broadcasting" ? "Broadcasting..." : "Confirm Send"}
      </button>

      {status === "proving" && (
        <p className="text-center text-xs text-zinc-600 mt-2">ZK proof generation takes ~30 seconds</p>
      )}
    </div>
  );
}
