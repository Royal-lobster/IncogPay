"use client";

import { Wallet, X } from "@phosphor-icons/react";
import { useConnect } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
}

export function WalletConnectModal({ open, onClose }: WalletConnectModalProps) {
  const { connect, isPending } = useConnect();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-800/60">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Choose wallet</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Select how you want to connect</p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X size={15} weight="bold" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <button
            onClick={() => {
              connect({ connector: injected() });
              onClose();
            }}
            disabled={isPending}
            className="w-full flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 hover:border-zinc-600 transition-colors text-left disabled:opacity-50"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/20">
              <Wallet size={14} weight="duotone" className="text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Browser wallet</p>
              <p className="text-xs text-zinc-500">MetaMask, Rabby, Coinbase…</p>
            </div>
          </button>
          <button
            onClick={() => {
              connect({
                connector: walletConnect({
                  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "incogpay",
                }),
              });
              onClose();
            }}
            disabled={isPending}
            className="w-full flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 hover:border-zinc-600 transition-colors text-left disabled:opacity-50"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
              <Wallet size={14} weight="duotone" className="text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">WalletConnect</p>
              <p className="text-xs text-zinc-500">Rainbow, Trust, Ledger Live…</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
