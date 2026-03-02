import { ArrowSquareOut, CircleNotch, Clock, Wallet } from "@phosphor-icons/react";
import type { SupportedChain } from "@/lib/wagmi";

interface MixingStepProps {
  needsResign: boolean;
  poiStatus: string;
  txHash: string | null;
  formChain: SupportedChain;
}

const EXPLORER_BY_CHAIN: Record<number, string> = {
  42161: "https://arbiscan.io/tx",
  1: "https://etherscan.io/tx",
  137: "https://polygonscan.com/tx",
  56: "https://bscscan.com/tx",
};

export function MixingStep({ needsResign, poiStatus, txHash, formChain }: MixingStepProps) {
  const explorerBase = EXPLORER_BY_CHAIN[formChain.id] ?? "https://arbiscan.io/tx";

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 ring-1 ring-pink-500/20">
          <Clock size={17} weight="duotone" className="text-pink-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Mixing in Pool</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            ZK privacy check is running on-chain. Your funds are safe.
          </p>
        </div>
      </div>

      {needsResign ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-3">
            <Wallet size={16} weight="duotone" className="text-pink-400 shrink-0" />
            <div>
              <p className="text-sm text-zinc-300">Session restored</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                Sign to unlock your private wallet and resume mixing.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-3">
            <CircleNotch size={16} className="animate-spin text-pink-400 shrink-0" />
            <div>
              <p className="text-sm text-zinc-300">{poiStatus}</p>
              <p className="text-xs text-zinc-600 mt-0.5">This typically takes a few minutes</p>
            </div>
          </div>
        </div>
      )}

      {txHash && (
        <a
          href={`${explorerBase}/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-pink-400 transition-colors"
        >
          <ArrowSquareOut size={12} weight="bold" />
          View deposit on explorer
        </a>
      )}

      <div className="rounded-xl border border-zinc-800 px-3 py-2.5">
        <p className="text-xs text-zinc-500">
          You can close this tab and come back — progress is saved locally.
        </p>
      </div>
    </>
  );
}
