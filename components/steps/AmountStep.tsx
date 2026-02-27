"use client";

import { useState } from "react";
import { CaretDown, Warning } from "@phosphor-icons/react";
import { SUPPORTED_CHAINS, TOKENS_BY_CHAIN, type SupportedChain } from "@/lib/wagmi";
import { ChainIcon } from "@/components/ChainIcon";
import { TokenIcon } from "@/components/TokenIcon";
import type { SendIntent } from "@/lib/types";

export function AmountStep({
  onNext,
  onCancel,
}: {
  onNext: (intent: SendIntent) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [chain, setChain] = useState<SupportedChain>(SUPPORTED_CHAINS[0]);
  const [chainOpen, setChainOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const tokens = TOKENS_BY_CHAIN[chain.id];
  const [token, setToken] = useState(tokens[0]);

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
    <div>
      <h2 className="text-lg font-semibold tracking-tight mb-1">How much to send?</h2>
      <p className="text-sm text-zinc-400 mb-5">Choose your network, token, and amount.</p>

      {/* Main card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-3">

        {/* Chain */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Network</span>
          <div className="relative">
            <button
              onClick={() => { setChainOpen(!chainOpen); setTokenOpen(false); }}
              className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-zinc-500 transition-colors"
            >
              <ChainIcon chainId={chain.id} size={20} />
              {chain.label}
              <CaretDown size={12} weight="bold" className="text-zinc-500" />
            </button>
            {chainOpen && (
              <div className="absolute right-0 top-full mt-2 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-30 overflow-hidden w-48">
                {SUPPORTED_CHAINS.map((c) => (
                  <button key={c.id} onClick={() => handleChainChange(c)}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 transition-colors flex items-center gap-3 ${c.id === chain.id ? "text-pink-400" : "text-zinc-300"}`}>
                    <ChainIcon chainId={c.id} size={22} />
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
              className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-500 transition-colors whitespace-nowrap"
            >
              <TokenIcon symbol={token.symbol} size={20} />
              {token.symbol}
              <CaretDown size={12} weight="bold" className="text-zinc-500" />
            </button>
            {tokenOpen && (
              <div className="absolute right-0 top-full mt-2 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-30 overflow-hidden w-36">
                {tokens.map((t) => (
                  <button key={t.symbol} onClick={() => { setToken(t); setTokenOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 transition-colors flex items-center gap-3 ${t.symbol === token.symbol ? "text-pink-400" : "text-zinc-300"}`}>
                    <TokenIcon symbol={t.symbol} size={20} />
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

      <div className="flex gap-3 mt-2">
        <button onClick={onCancel} className="flex-1 py-3 rounded-full border border-zinc-700 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors">
          Cancel
        </button>
        <button
          onClick={() => valid && onNext({ amount, token: token.symbol })}
          disabled={!valid}
          className={`flex-1 py-3 rounded-full text-sm font-semibold transition-colors ${valid ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
