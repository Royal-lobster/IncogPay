"use client";

import { useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, CaretDown, Copy, Check, Ghost, QrCode,
  Wallet, CircleNotch, ShieldCheck, ArrowSquareOut,
} from "@phosphor-icons/react";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { injected } from "wagmi/connectors";
import { SUPPORTED_CHAINS, TOKENS_BY_CHAIN, type SupportedChain } from "@/lib/wagmi";
import { ChainIcon } from "@/components/ChainIcon";
import { TokenIcon } from "@/components/TokenIcon";

// Derive a deterministic 0zk-style address from a wallet signature (mocked for now)
function deriveShieldedAddress(sig: string): string {
  // TODO: replace with RAILGUN SDK getRailgunAddress()
  const hash = sig.slice(2, 42);
  return `0zk1qy${hash.slice(0, 8)}...${hash.slice(-8)}demo`;
}

type Step = "idle" | "connecting" | "signing" | "ready";

export default function ReceivePage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { signMessageAsync } = useSignMessage();

  const [step, setStep] = useState<Step>("idle");
  const [shieldedAddr, setShieldedAddr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Link builder state
  const [chain, setChain] = useState<SupportedChain>(SUPPORTED_CHAINS[0]);
  const [chainOpen, setChainOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const tokens = TOKENS_BY_CHAIN[chain.id];
  const [token, setToken] = useState(tokens[0]);
  const [amount, setAmount] = useState("");

  const handleGenerate = async () => {
    try {
      if (!isConnected) {
        setStep("connecting");
        connect({ connector: injected() });
        return;
      }
      setStep("signing");
      const sig = await signMessageAsync({
        message: "Generate my IncogPay shielded receive address",
      });
      const addr = deriveShieldedAddress(sig);
      setShieldedAddr(addr);
      setStep("ready");
    } catch {
      setStep("idle");
    }
  };

  const shareUrl = (() => {
    if (!shieldedAddr) return "";
    const base = typeof window !== "undefined" ? window.location.origin : "https://incogpay.vercel.app";
    const p = new URLSearchParams({ to: shieldedAddr, chain: String(chain.id), token: token.symbol });
    if (amount) p.set("amount", amount);
    return `${base}/send?${p}`;
  })();

  const copy = (text: string, which: "addr" | "link") => {
    navigator.clipboard.writeText(text);
    if (which === "addr") { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
  };

  const busy = step === "connecting" || step === "signing";

  return (
    <main className="h-[100dvh] overflow-y-auto flex flex-col bg-[#0a0a0a]">
      <div className="my-auto px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-8">
          <ArrowLeft size={12} weight="bold" />
          Back
        </Link>

        <div className="w-full max-w-md mx-auto">

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/20 mb-4">
              <QrCode size={28} weight="duotone" className="text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Receive Privately</h1>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
              Generate a shielded address. Senders can't trace it back to your wallet.
            </p>
          </div>

          {step !== "ready" ? (
            <>
              {/* How it works */}
              <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-4">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                <ul className="space-y-3">
                  {[
                    { icon: Wallet,      text: "Connect your wallet — nothing is sent, just a signature." },
                    { icon: ShieldCheck, text: "We derive your RAILGUN 0zk address from that signature." },
                    { icon: Ghost,       text: "Share the address or link. Sender sees RAILGUN, not you." },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <item.icon size={14} weight="duotone" className="text-violet-400 mt-0.5 shrink-0" />
                      <span className="text-xs text-zinc-400">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Wallet row */}
              {isConnected && address && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 mb-4 flex items-center gap-2">
                  <Wallet size={13} weight="duotone" className="text-zinc-500 shrink-0" />
                  <span className="text-xs text-zinc-400 truncate font-mono">{address}</span>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={busy}
                className={`w-full py-3.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${busy ? "bg-violet-950 text-violet-400 cursor-not-allowed" : "bg-white text-black hover:bg-zinc-200"}`}
              >
                {busy ? (
                  <><CircleNotch size={14} className="animate-spin" />{step === "connecting" ? "Connecting…" : "Sign in wallet…"}</>
                ) : (
                  <><QrCode size={14} weight="duotone" />{isConnected ? "Generate My Receive Address" : "Connect & Generate"}</>
                )}
              </button>
            </>
          ) : (
            <>
              {/* QR Code */}
              <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-4 flex flex-col items-center gap-4">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG value={shieldedAddr!} size={160} />
                </div>
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Your 0zk address</span>
                    <button onClick={() => copy(shieldedAddr!, "addr")} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">
                      {copied ? <Check size={11} weight="bold" className="text-emerald-400" /> : <Copy size={11} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 font-mono break-all bg-zinc-800 rounded-lg px-3 py-2">{shieldedAddr}</p>
                </div>
              </div>

              {/* Share link builder */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden mb-4">
                <div className="px-4 pt-4 pb-3 border-b border-zinc-800">
                  <p className="text-xs font-medium text-zinc-400 mb-1">Share a payment link</p>
                  <p className="text-[11px] text-zinc-600">Pre-fill amount, token, and chain for the sender.</p>
                </div>

                <div className="p-4 space-y-3">
                  {/* Chain */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Network</span>
                    <div className="relative">
                      <button onClick={() => { setChainOpen(!chainOpen); setTokenOpen(false); }} className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 transition-colors">
                        <ChainIcon chainId={chain.id} size={16} />
                        {chain.label}
                        <CaretDown size={11} weight="bold" className="text-zinc-500" />
                      </button>
                      {chainOpen && (
                        <div className="absolute right-0 top-full mt-1 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-20 overflow-hidden w-44">
                          {SUPPORTED_CHAINS.map((c) => (
                            <button key={c.id} onClick={() => { setChain(c); setToken(TOKENS_BY_CHAIN[c.id][0]); setChainOpen(false); }}
                              className={`w-full text-left px-3 py-2.5 text-xs hover:bg-zinc-800 transition-colors flex items-center gap-2.5 ${c.id === chain.id ? "text-violet-400" : "text-zinc-300"}`}>
                              <ChainIcon chainId={c.id} size={18} />
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Token */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Token</span>
                    <div className="relative">
                      <button onClick={() => { setTokenOpen(!tokenOpen); setChainOpen(false); }} className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 transition-colors">
                        <TokenIcon symbol={token.symbol} size={16} />
                        {token.symbol}
                        <CaretDown size={11} weight="bold" className="text-zinc-500" />
                      </button>
                      {tokenOpen && (
                        <div className="absolute right-0 top-full mt-1 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-20 overflow-hidden w-36">
                          {tokens.map((t) => (
                            <button key={t.symbol} onClick={() => { setToken(t); setTokenOpen(false); }}
                              className={`w-full text-left px-3 py-2.5 text-xs hover:bg-zinc-800 transition-colors flex items-center gap-2.5 ${t.symbol === token.symbol ? "text-violet-400" : "text-zinc-300"}`}>
                              <TokenIcon symbol={t.symbol} size={16} />
                              {t.symbol}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Amount <span className="text-zinc-700">(optional)</span></span>
                    <input
                      type="number"
                      placeholder="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-28 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 text-right"
                    />
                  </div>
                </div>

                {/* Share link display */}
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-zinc-500 truncate flex-1 font-mono">{shareUrl}</p>
                    <button onClick={() => copy(shareUrl, "link")} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">
                      {copiedLink ? <Check size={11} weight="bold" className="text-emerald-400" /> : <Copy size={11} />}
                      {copiedLink ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Privacy note */}
              <div className="relative overflow-hidden rounded-xl border border-zinc-800 px-4 py-3 flex gap-3">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                <ShieldCheck size={13} weight="duotone" className="text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-500">
                  Your real wallet address is never shared. The 0zk address is re-derivable from your wallet anytime — no key to save.
                </p>
              </div>

              {/* Explorer link placeholder */}
              <button onClick={() => { setStep("idle"); setShieldedAddr(null); }} className="w-full mt-4 py-3 rounded-full border border-zinc-800 text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors">
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
