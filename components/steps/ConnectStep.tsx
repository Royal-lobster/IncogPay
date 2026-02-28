"use client";

import { Wallet } from "@phosphor-icons/react";
import { useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

export function ConnectStep({
  onConnected,
  onCancel,
}: {
  onConnected: () => void;
  onCancel: () => void;
}) {
  const { isConnected, address } = useAccount();
  const { connect, isPending } = useConnect();

  // Auto-advance if wallet connects
  useEffect(() => {
    if (isConnected) onConnected();
  }, [isConnected, onConnected]);

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight mb-1">Connect your wallet</h2>
      <p className="text-sm text-zinc-400 mb-6">
        Nothing is sent yet — just need to identify your wallet before proceeding.
      </p>

      <div className="space-y-2 mb-6">
        <button
          onClick={() => connect({ connector: injected() })}
          disabled={isPending}
          className="w-full flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 hover:border-zinc-600 transition-colors text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/20">
            <Wallet size={18} weight="duotone" className="text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-200">Browser wallet</p>
            <p className="text-xs text-zinc-500">MetaMask, Rabby, Coinbase…</p>
          </div>
        </button>

        <button
          onClick={() =>
            connect({
              connector: walletConnect({
                projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "incogpay",
              }),
            })
          }
          disabled={isPending}
          className="w-full flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 hover:border-zinc-600 transition-colors text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
            <Wallet size={18} weight="duotone" className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-200">WalletConnect</p>
            <p className="text-xs text-zinc-500">Rainbow, Trust, Ledger Live…</p>
          </div>
        </button>
      </div>

      <button
        onClick={onCancel}
        className="w-full py-3 rounded-full border border-zinc-800 text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
