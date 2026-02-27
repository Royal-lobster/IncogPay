"use client";

import { useState } from "react";
import { CaretDown, Ghost, Timer, Wallet, Warning } from "@phosphor-icons/react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { SUPPORTED_CHAINS, TOKENS_BY_CHAIN, type SupportedChain } from "@/lib/wagmi";
import { ChainIcon } from "./ChainIcon";
import type { SendIntent } from "@/app/page";

export function SendForm({ onSend }: { onSend: (i: SendIntent) => void }) {
  const [amount, setAmount] = useState("");
  const [chain, setChain] = useState<SupportedChain>(SUPPORTED_CHAINS[0]);
  const [chainOpen, setChainOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);

  const tokens = TOKENS_BY_CHAIN[chain.id];
  const [token, setToken] = useState(tokens[0]);

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const numeric = parseFloat(amount) || 0;
  const fee = numeric * 0.0025;
  const receive = numeric - fee;
  const isLarge = numeric >= 10000;
  const valid = numeric > 0;

  const handleChainChange = (c: SupportedChain) => {
    setChain(c);
    setToken(TOKENS_BY_CHAIN[c.id][0]);
    setChainOpen(false);
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo / heading */}
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/10 ring-1 ring-pink-500/20 mb-4">
          <Ghost size={28} weight="duotone" className="text-pink-400" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">IncogPay</h1>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
          Send crypto privately. The recipient won't know your wallet address or balance.
        </p>
      </div>

      {/* Wallet row */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Wallet size={14} weight="duotone" className="text-zinc-500 shrink-0" />
          <span className="text-xs text-zinc-500 truncate">
            {isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "No wallet connected"}
          </span>
        </div>
        {isConnected ? (
          <button onClick={() => disconnect()} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 ml-2">
            Disconnect
          </button>
        ) : (
          <button onClick={() => connect({ connector: injected() })} className="text-xs font-medium rounded-full bg-white text-black px-3 py-1 hover:bg-zinc-200 transition-colors shrink-0 ml-2">
            Connect
          </button>
        )}
      </div>

      {/* Main card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-3">

        {/* Chain selector */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Network</span>
          <div className="relative">
            <button
              onClick={() => { setChainOpen(!chainOpen); setTokenOpen(false); }}
              className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-zinc-500 transition-colors"
            >
              <ChainIcon chainId={chain.id} size={16} />
              {chain.label}
              <CaretDown size={12} weight="bold" className="text-zinc-500" />
            </button>
            {chainOpen && (
              <div className="absolute right-0 top-full mt-2 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-20 overflow-hidden w-44">
                {SUPPORTED_CHAINS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleChainChange(c)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 transition-colors flex items-center gap-3 ${c.id === chain.id ? "text-pink-400" : "text-zinc-300"}`}
                  >
                    <ChainIcon chainId={c.id} size={18} />
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Amount + token */}
        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">Amount</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="min-w-0 flex-1 text-3xl font-semibold bg-transparent text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
            min="0"
          />
          <div className="relative shrink-0">
            <button
              onClick={() => { setTokenOpen(!tokenOpen); setChainOpen(false); }}
              className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-500 transition-colors whitespace-nowrap"
            >
              {token.symbol}
              <CaretDown size={12} weight="bold" className="text-zinc-500" />
            </button>
            {tokenOpen && (
              <div className="absolute right-0 top-full mt-2 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-20 overflow-hidden w-28">
                {tokens.map((t) => (
                  <button
                    key={t.symbol}
                    onClick={() => { setToken(t); setTokenOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 transition-colors ${t.symbol === token.symbol ? "text-pink-400" : "text-zinc-300"}`}
                  >
                    {t.symbol}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fee breakdown */}
        {numeric > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Protocol fee (0.25%)</span>
              <span>−{fee.toFixed(2)} {token.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Recipient receives</span>
              <span className="text-zinc-100 font-medium">{receive.toFixed(2)} {token.symbol}</span>
            </div>
          </div>
        )}
      </div>

      {/* Large amount warning */}
      {isLarge && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 mb-3 flex gap-3">
          <Warning size={14} weight="fill" className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-400">
            At this amount the fee is <strong>${fee.toFixed(0)}</strong>. Consider whether the privacy tradeoff is worth it.
          </p>
        </div>
      )}

      {/* Wait notice */}
      <div className="rounded-xl border border-zinc-800 px-4 py-3 mb-6 flex gap-3">
        <Timer size={13} weight="duotone" className="text-zinc-600 mt-0.5 shrink-0" />
        <p className="text-xs text-zinc-500">
          Requires ~1 hour mixing wait before funds reach recipient. You can cancel anytime and get funds back.
        </p>
      </div>

      <button
        onClick={() => valid && onSend({ amount, token: token.symbol })}
        disabled={!valid}
        className={`w-full py-3.5 rounded-full text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${valid ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
      >
        <Ghost size={15} weight="duotone" />
        Send Privately
      </button>
    </div>
  );
}
