"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";

const MIXING_MS = 60 * 60 * 1000; // 1 hour

export function MixingStep({ txHash, onReady, onCancel }: {
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
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/20 mb-4">
        <ShieldCheck size={22} className="text-violet-400" />
      </div>

      <h3 className="font-semibold text-zinc-100 mb-1">Funds are mixing</h3>
      <p className="text-sm text-zinc-400 mb-6">
        RAILGUN is running its on-chain privacy check. Your funds are safe in the pool.
      </p>

      {/* Progress bar */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 mb-4">
        <div className="flex justify-between text-xs text-zinc-500 mb-2.5">
          <span>Mixing progress</span>
          <span className="text-zinc-400">{fmt(remaining)} remaining</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {txHash && (
        <a
          href={`https://arbiscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-violet-400 transition-colors mb-4"
        >
          <ExternalLink size={11} />
          View deposit on Arbiscan
        </a>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
        <p className="text-xs text-zinc-600">
          You can close this tab and come back later — progress is saved locally in your browser.
        </p>
      </div>
    </div>
  );
}
