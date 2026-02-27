"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

const MIXING_MS = 60 * 60 * 1000; // 1 hour

export function MixingStep({
  txHash,
  onReady,
  onCancel,
}: {
  txHash: string | null;
  onReady: () => void;
  onCancel: () => void;
}) {
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      const e = Date.now() - startedAt;
      setElapsed(e);
      if (e >= MIXING_MS) { clearInterval(id); onReady(); }
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, onReady]);

  const remaining = Math.max(0, MIXING_MS - elapsed);
  const pct = Math.min(100, (elapsed / MIXING_MS) * 100);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, "0")}s`;
  };

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight mb-1">Mixing in private pool</h2>
      <p className="text-sm text-zinc-400 mb-6">
        RAILGUN is running its on-chain privacy check. Your funds are safe.
      </p>

      {/* Progress card */}
      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-4">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/40 to-transparent" />

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Progress</span>
          <span className="text-sm font-medium text-zinc-300">{fmt(remaining)} remaining</span>
        </div>

        {/* Bar */}
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-pink-500 transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-zinc-700 mt-2">
          <span>0m</span>
          <span>60m</span>
        </div>
      </div>

      {txHash && (
        <a
          href={`https://arbiscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-pink-400 transition-colors mb-4"
        >
          <ExternalLink size={11} />
          View deposit on Arbiscan
        </a>
      )}

      <div className="rounded-xl border border-zinc-800 px-4 py-3">
        <p className="text-xs text-zinc-500">
          You can close this tab and come back — progress is saved locally. Cancel below to return funds to your wallet.
        </p>
      </div>
    </div>
  );
}
