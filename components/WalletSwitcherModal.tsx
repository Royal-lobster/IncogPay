"use client";

import { X, Wallet, SignOut } from "@phosphor-icons/react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletSwitcherModal({ onClose }: { onClose: () => void }) {
  const { address } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const handleDisconnect = () => {
    disconnect();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
          <span className="text-sm font-medium text-zinc-300">Connected wallet</span>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current address */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5">Address</p>
            <p className="text-xs font-mono text-zinc-200 break-all">{address}</p>
          </div>

          {/* Switch wallet */}
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Switch wallet</p>
            <div className="space-y-2">
              <button
                onClick={() => connect({ connector: injected() })}
                disabled={isPending}
                className="w-full flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-600 transition-colors text-left disabled:opacity-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/20">
                  <Wallet size={15} weight="duotone" className="text-orange-400" />
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
                className="w-full flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-600 transition-colors text-left disabled:opacity-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
                  <Wallet size={15} weight="duotone" className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">WalletConnect</p>
                  <p className="text-xs text-zinc-500">Rainbow, Trust, Ledger Live…</p>
                </div>
              </button>
            </div>
          </div>

          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full border border-red-900/40 text-sm text-red-400 hover:border-red-700/60 hover:text-red-300 transition-colors"
          >
            <SignOut size={14} weight="bold" />
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
