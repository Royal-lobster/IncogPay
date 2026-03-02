import { ShieldCheck } from "@phosphor-icons/react";
import { friendlyError } from "./utils";

interface ShieldStepProps {
  intent: { amount: string; token: string };
  error?: unknown;
}

export function ShieldStep({ intent, error }: ShieldStepProps) {
  const depositAmount = parseFloat(intent.amount);
  const fee = depositAmount * 0.0025;
  const privateBalance = depositAmount * 0.9975;

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 ring-1 ring-pink-500/20">
          <ShieldCheck size={17} weight="duotone" className="text-pink-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Shield Funds</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Approve and deposit into RAILGUN&apos;s private pool.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">You deposit</span>
          <span className="text-zinc-100 font-medium">
            {intent.amount} {intent.token}
          </span>
        </div>
        <div className="flex justify-between text-xs text-zinc-600">
          <span>Protocol fee (0.25%)</span>
          <span>
            −{fee.toFixed(2)} {intent.token}
          </span>
        </div>
        <div className="h-px bg-zinc-800" />
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Private balance</span>
          <span className="text-emerald-400 font-medium">
            +{privateBalance.toFixed(2)} {intent.token}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 px-3 py-2.5">
        <p className="text-xs text-zinc-500">
          You&apos;ll also need a small amount of native token for gas (~$0.10).
        </p>
      </div>

      {error !== undefined && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-3 py-2.5">
          <p className="text-xs text-red-400">{friendlyError(error)}</p>
        </div>
      )}
    </>
  );
}
