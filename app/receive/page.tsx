"use client";

import { useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, CaretDown, Copy, Check, QrCode,
  Wallet, CircleNotch, ShieldCheck, Timer,
} from "@phosphor-icons/react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { injected } from "wagmi/connectors";
import { SUPPORTED_CHAINS, TOKENS_BY_CHAIN, type SupportedChain } from "@/lib/wagmi";
import { ChainIcon } from "@/components/ChainIcon";
import { TokenIcon } from "@/components/TokenIcon";

function deriveShieldedAddress(sig: string): string {
  // TODO: replace with RAILGUN SDK getRailgunAddress()
  const hash = sig.slice(2, 42);
  return `0zk1qy${hash.slice(0, 8)}...${hash.slice(-8)}demo`;
}

type Step = "idle" | "signing" | "ready";

export default function ReceivePage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const [step, setStep] = useState<Step>("idle");
  const [shieldedAddr, setShieldedAddr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [chain, setChain] = useState<SupportedChain>(SUPPORTED_CHAINS[0]);
  const [chainOpen, setChainOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const tokens = TOKENS_BY_CHAIN[chain.id];
  const [token, setToken] = useState(tokens[0]);
  const [amount, setAmount] = useState("");

  const handleChainChange = (c: SupportedChain) => {
    setChain(c);
    setToken(TOKENS_BY_CHAIN[c.id][0]);
    setChainOpen(false);
  };

  const handleGenerate = async () => {
    try {
      if (!isConnected) { connect({ connector: injected() }); return; }
      setStep("signing");
      const sig = await signMessageAsync({
        message: "Generate my IncogPay shielded receive address",
      });
      setShieldedAddr(deriveShieldedAddress(sig));
      setStep("ready");
    } catch {
      setStep("idle");
    }
  };

  const shareUrl = (() => {
    if (!shieldedAddr || typeof window === "undefined") return "";
    const p = new URLSearchParams({ to: shieldedAddr, chain: String(chain.id), token: token.symbol });
    if (amount) p.set("amount", amount);
    return `${window.location.origin}/send?${p}`;
  })();

  const copy = (text: string, which: "addr" | "link") => {
    navigator.clipboard.writeText(text);
    if (which === "addr") { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
  };

  const busy = step === "signing";

  return (
    <main className="h-[100dvh] overflow-y-auto flex flex-col bg-[#0a0a0a]">
      <div className="my-auto px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-8">
          <ArrowLeft size={12} weight="bold" />
          Back
        </Link>

        <div className="w-full max-w-md mx-auto">

          {/* Header — matches SendForm */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/10 ring-1 ring-pink-500/20 mb-4">
              <QrCode size={28} weight="duotone" className="text-pink-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Receive Privately</h1>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
              Generate a shielded address. Senders can't trace it back to your wallet.
            </p>
          </div>

          {/* Wallet row — identical to SendForm */}
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

          {step !== "ready" ? (
            <>
              {/* Main card — same structure as SendForm's card */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-3">

                {/* Network row */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Network</span>
                  <div className="relative">
                    <button
                      onClick={() => { setChainOpen(!chainOpen); setTokenOpen(false); }}
                      className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-zinc-500 transition-colors"
                    >
                      <ChainIcon chainId={chain.id} size={22} />
                      {chain.label}
                      <CaretDown size={12} weight="bold" className="text-zinc-500" />
                    </button>
                    {chainOpen && (
                      <div className="absolute right-0 top-full mt-2 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-20 overflow-hidden w-48">
                        {SUPPORTED_CHAINS.map((c) => (
                          <button key={c.id} onClick={() => handleChainChange(c)}
                            className={`w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 transition-colors flex items-center gap-3 ${c.id === chain.id ? "text-pink-400" : "text-zinc-300"}`}>
                            <ChainIcon chainId={c.id} size={24} />
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount requested (optional) + token — same layout as amount row */}
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">
                  Amount requested <span className="normal-case text-zinc-700">(optional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="any"
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
                      <div className="absolute right-0 top-full mt-2 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-20 overflow-hidden w-36">
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
              </div>

              {/* Notice — same style as wait notice in SendForm */}
              <div className="rounded-xl border border-zinc-800 px-4 py-3 mb-5 flex gap-3">
                <Timer size={13} weight="duotone" className="text-zinc-600 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-500">
                  We'll sign a message from your wallet to derive your private 0zk address — no funds leave your wallet.
                </p>
              </div>

              {/* CTA — same as SendForm */}
              <button
                onClick={handleGenerate}
                disabled={busy}
                className={`w-full py-3.5 rounded-full text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${busy ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-white text-black hover:bg-zinc-200"}`}
              >
                {busy
                  ? <><CircleNotch size={14} className="animate-spin" />Signing in wallet…</>
                  : <><QrCode size={15} weight="duotone" />{isConnected ? "Generate Receive Address" : "Connect & Generate"}</>
                }
              </button>
            </>
          ) : (
            <>
              {/* QR + address card */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-3">
                <div className="flex flex-col items-center gap-4">
                  <div className="rounded-xl bg-white p-3">
                    <QRCodeSVG value={shieldedAddr!} size={156} />
                  </div>
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Your 0zk address</span>
                      <button onClick={() => copy(shieldedAddr!, "addr")} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                        {copied ? <Check size={12} weight="bold" className="text-emerald-400" /> : <Copy size={12} />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="text-xs text-zinc-300 font-mono break-all bg-zinc-800 rounded-lg px-3 py-2 leading-relaxed">{shieldedAddr}</p>
                  </div>
                </div>
              </div>

              {/* Share link card — same card style */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-3">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Share link</span>
                  <button onClick={() => copy(shareUrl, "link")} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                    {copiedLink ? <Check size={12} weight="bold" className="text-emerald-400" /> : <Copy size={12} />}
                    {copiedLink ? "Copied" : "Copy link"}
                  </button>
                </div>

                {/* Network */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-zinc-500">Network</span>
                  <div className="relative">
                    <button onClick={() => { setChainOpen(!chainOpen); setTokenOpen(false); }}
                      className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-zinc-500 transition-colors">
                      <ChainIcon chainId={chain.id} size={18} />
                      {chain.label}
                      <CaretDown size={12} weight="bold" className="text-zinc-500" />
                    </button>
                    {chainOpen && (
                      <div className="absolute right-0 top-full mt-2 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-20 overflow-hidden w-48">
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

                {/* Token */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-zinc-500">Token</span>
                  <div className="relative">
                    <button onClick={() => { setTokenOpen(!tokenOpen); setChainOpen(false); }}
                      className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-zinc-500 transition-colors">
                      <TokenIcon symbol={token.symbol} size={18} />
                      {token.symbol}
                      <CaretDown size={12} weight="bold" className="text-zinc-500" />
                    </button>
                    {tokenOpen && (
                      <div className="absolute right-0 top-full mt-2 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-20 overflow-hidden w-36">
                        {tokens.map((t) => (
                          <button key={t.symbol} onClick={() => { setToken(t); setTokenOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 transition-colors flex items-center gap-3 ${t.symbol === token.symbol ? "text-pink-400" : "text-zinc-300"}`}>
                            <TokenIcon symbol={t.symbol} size={18} />
                            {t.symbol}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
                  <span className="text-xs text-zinc-500">Amount <span className="text-zinc-700">(optional)</span></span>
                  <input
                    type="number"
                    placeholder="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-28 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 text-right"
                  />
                </div>

                {/* URL preview */}
                <p className="text-[10px] text-zinc-600 font-mono break-all leading-relaxed">{shareUrl}</p>
              </div>

              {/* Privacy notice — same style as wait notice */}
              <div className="rounded-xl border border-zinc-800 px-4 py-3 mb-5 flex gap-3">
                <ShieldCheck size={13} weight="duotone" className="text-zinc-600 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-500">
                  Your real wallet is never revealed. The 0zk address is always re-derivable from the same wallet — no key to save.
                </p>
              </div>

              {/* Regenerate — same rounded-full style, secondary */}
              <button
                onClick={() => { setStep("idle"); setShieldedAddr(null); }}
                className="w-full py-3.5 rounded-full border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
              >
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
