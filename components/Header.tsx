"use client";

import { Ghost } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
      <div className="flex items-center gap-2">
        <Ghost size={16} className="text-violet-400" />
        <span className="font-semibold tracking-tight">IncogPay</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500 border border-zinc-800 rounded-full px-2.5 py-1">
          Arbitrum
        </span>
        {isConnected && address ? (
          <button
            onClick={() => disconnect()}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-800 rounded-full px-3 py-1 hover:border-zinc-600"
          >
            {address.slice(0, 6)}...{address.slice(-4)}
          </button>
        ) : (
          <button
            onClick={() => connect({ connector: injected() })}
            className="text-xs font-medium rounded-full bg-white text-black px-4 py-1.5 hover:bg-zinc-200 transition-colors"
          >
            Connect
          </button>
        )}
      </div>
    </header>
  );
}
