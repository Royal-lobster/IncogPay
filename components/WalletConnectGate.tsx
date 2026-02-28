"use client";

import { CaretDown, Wallet } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { WalletSwitcherModal } from "./WalletSwitcherModal";

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type Accent = "pink" | "violet";

const ACCENT: Record<Accent, { wrap: string; icon: string; dot: string }> = {
  pink: {
    wrap: "bg-pink-500/10 ring-1 ring-pink-500/20",
    icon: "text-pink-400",
    dot: "bg-pink-400",
  },
  violet: {
    wrap: "bg-violet-500/10 ring-1 ring-violet-500/20",
    icon: "text-violet-400",
    dot: "bg-violet-400",
  },
};

interface WalletConnectGateProps {
  children: ReactNode;
  accentColor?: Accent;
}

export function WalletConnectGate({ children, accentColor = "pink" }: WalletConnectGateProps) {
  const { isConnected, address } = useAccount();
  const { connect, isPending } = useConnect();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const ac = ACCENT[accentColor];

  /* ── Not connected: show connect UI ── */
  if (!isConnected) {
    return (
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${ac.wrap} mb-4`}>
            <Wallet size={28} weight="duotone" className={ac.icon} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Connect Wallet</h1>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
            Connect your wallet to continue. Nothing is sent at this step.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => connect({ connector: injected() })}
            disabled={isPending}
            className="w-full flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 hover:border-zinc-600 transition-colors text-left disabled:opacity-50"
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
            className="w-full flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 hover:border-zinc-600 transition-colors text-left disabled:opacity-50"
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
      </div>
    );
  }

  /* ── Connected: address chip + children ── */
  return (
    <>
      <div className="w-full max-w-md mx-auto flex justify-end mb-5">
        <button
          onClick={() => setSwitcherOpen(true)}
          className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="font-mono">{formatAddress(address!)}</span>
          <CaretDown size={10} weight="bold" className="text-zinc-500" />
        </button>
      </div>

      {children}

      {switcherOpen && <WalletSwitcherModal onClose={() => setSwitcherOpen(false)} />}
    </>
  );
}
