"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, CaretDown, Copy, Check, Ghost, QrCode,
  Wallet, CircleNotch, ShieldCheck,
} from "@phosphor-icons/react";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { SUPPORTED_CHAINS, TOKENS_BY_CHAIN, type SupportedChain } from "@/lib/wagmi";
import { ChainIcon } from "@/components/ChainIcon";
import { TokenIcon } from "@/components/TokenIcon";
import { WalletSwitcherModal } from "@/components/WalletSwitcherModal";

function deriveShieldedAddress(sig: string): string {
  // TODO: replace with RAILGUN SDK getRailgunAddress()
  const hash = sig.slice(2, 42);
  return `0zk1qy${hash.slice(0, 8)}...${hash.slice(-8)}demo`;
}

type Phase = "connect" | "idle" | "signing" | "ready";

const HOW_IT_WORKS = [
  { icon: Wallet,      text: "Connect your wallet — nothing is sent, just a signature." },
  { icon: ShieldCheck, text: "We derive your RAILGUN 0zk address from that signature." },
  { icon: Ghost,       text: "Share the address or link. Sender sees RAILGUN, not you." },
];

function fmtAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ReceivePage() {
  const { isConnected, address } = useAccount();
  const { connect, isPending } = useConnect();
  const { signMessageAsync } = useSignMessage();

  const [phase, setPhase] = useState<Phase>(isConnected ? "idle" : "connect");
  const [shieldedAddr, setShieldedAddr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const [chain, setChain] = useState<SupportedChain>(SUPPORTED_CHAINS[0]);
  const [chainOpen, setChainOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const tokens = TOKENS_BY_CHAIN[chain.id];
  const [token, setToken] = useState(tokens[0]);
  const [amount, setAmount] = useState("");

  // advance to idle when wallet connects
  useEffect(() => {
    if (isConnected && phase === "connect") setPhase("idle");
  }, [isConnected]); // eslint-disable-line

  const handleChainChange = (c: SupportedChain) => {
    setChain(c);
    setToken(TOKENS_BY_CHAIN[c.id][0]);
    setChainOpen(false);
  };

  const handleGenerate = async () => {
    try {
      setPhase("signing");
      const sig = await signMessageAsync({
        message: "Generate my IncogPay shielded receive address",
      });
      setShieldedAddr(deriveShieldedAddress(sig));
      setPhase("ready");
    } catch {
      setPhase("idle");
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

  return (
    <>
      <main className="h-[100dvh] overflow-y-auto flex flex-col bg-[#0a0a0a]">
        <div className="my-auto px-6 py-8">

          {/* Top nav */}
          <div className="flex items-center justify-between mb-8 w-full max-w-md mx-auto">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <ArrowLeft size={12} weight="bold" />
              Back
            </Link>
            {isConnected && address && (
              <button
                onClick={() => setSwitcherOpen(true)}
                className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="font-mono">{fmtAddr(address)}</span>
                <CaretDown size={10} weight="bold" className="text-zinc-500" />
              </button>
            )}
          </div>

          <div className="w-full max-w-md mx-auto">

            {/* Page header — all phases */}
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/20 mb-4">
                <QrCode size={28} weight="duotone" className="text-violet-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Receive Privately</h1>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
                Generate a shielded address. Senders can't trace it back to your wallet.
              </p>
            </div>

            {/* ── connect ── */}
            {phase === "connect" && (
              <>
                <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-5">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                  <ul className="space-y-3">
                    {HOW_IT_WORKS.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <item.icon size={14} weight="duotone" className="text-violet-400 mt-0.5 shrink-0" />
                        <span className="text-xs text-zinc-400">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs text-zinc-500 text-center mb-3">
                  Sign once with your wallet — nothing is sent, it just derives your 0zk address.
                </p>
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
                    onClick={() => connect({ connector: walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "incogpay" }) })}
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
              </>
            )}

            {/* ── idle (connected, waiting to generate) ── */}
            {phase === "idle" && (
              <>
                <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-5">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                  <ul className="space-y-3">
                    {HOW_IT_WORKS.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <item.icon size={14} weight="duotone" className="text-violet-400 mt-0.5 shrink-0" />
                        <span className="text-xs text-zinc-400">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={handleGenerate}
                  className="w-full py-3.5 rounded-full text-sm font-semibold bg-white text-black hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                >
                  <QrCode size={15} weight="duotone" />
                  Generate Receive Address
                </button>
              </>
            )}

            {/* ── signing ── */}
            {phase === "signing" && (
              <div className="flex flex-col items-center py-6 gap-3">
                <CircleNotch size={28} className="animate-spin text-violet-400" />
                <p className="text-sm text-zinc-400">Check your wallet and sign the message…</p>
                <button
                  onClick={() => setPhase("idle")}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-2"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* ── ready ── */}
            {phase === "ready" && (
              <>
                {/* QR + address card */}
                <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-3">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                  <div className="flex flex-col items-center gap-4">
                    <div className="rounded-xl bg-white p-3">
                      <QRCodeSVG value={shieldedAddr!} size={156} />
                    </div>
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Your 0zk address</span>
                        <button
                          onClick={() => copy(shieldedAddr!, "addr")}
                          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {copied ? <Check size={12} weight="bold" className="text-emerald-400" /> : <Copy size={12} />}
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-300 font-mono break-all bg-zinc-800 rounded-lg px-3 py-2 leading-relaxed">{shieldedAddr}</p>
                    </div>
                  </div>
                </div>

                {/* Share link builder */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-3">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Share link</span>
                    <button
                      onClick={() => copy(shareUrl, "link")}
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {copiedLink ? <Check size={12} weight="bold" className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedLink ? "Copied" : "Copy link"}
                    </button>
                  </div>

                  {/* Network */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-zinc-500">Network</span>
                    <div className="relative">
                      <button
                        onClick={() => { setChainOpen(!chainOpen); setTokenOpen(false); }}
                        className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-zinc-500 transition-colors"
                      >
                        <ChainIcon chainId={chain.id} size={18} />
                        {chain.label}
                        <CaretDown size={12} weight="bold" className="text-zinc-500" />
                      </button>
                      {chainOpen && (
                        <div className="absolute right-0 top-full mt-2 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-20 overflow-hidden w-48">
                          {SUPPORTED_CHAINS.map((c) => (
                            <button key={c.id} onClick={() => handleChainChange(c)}
                              className={`w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 transition-colors flex items-center gap-3 ${c.id === chain.id ? "text-violet-400" : "text-zinc-300"}`}>
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
                      <button
                        onClick={() => { setTokenOpen(!tokenOpen); setChainOpen(false); }}
                        className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-zinc-500 transition-colors"
                      >
                        <TokenIcon symbol={token.symbol} size={18} />
                        {token.symbol}
                        <CaretDown size={12} weight="bold" className="text-zinc-500" />
                      </button>
                      {tokenOpen && (
                        <div className="absolute right-0 top-full mt-2 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-20 overflow-hidden w-36">
                          {tokens.map((t) => (
                            <button key={t.symbol} onClick={() => { setToken(t); setTokenOpen(false); }}
                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 transition-colors flex items-center gap-3 ${t.symbol === token.symbol ? "text-violet-400" : "text-zinc-300"}`}>
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

                  <p className="text-[10px] text-zinc-600 font-mono break-all leading-relaxed">{shareUrl}</p>
                </div>

                {/* Privacy notice */}
                <div className="rounded-xl border border-zinc-800 px-4 py-3 mb-5 flex gap-3">
                  <ShieldCheck size={13} weight="duotone" className="text-zinc-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-zinc-500">
                    Your real wallet is never revealed. The 0zk address is always re-derivable from the same wallet — no key to save.
                  </p>
                </div>

                <button
                  onClick={() => { setPhase("idle"); setShieldedAddr(null); }}
                  className="w-full py-3.5 rounded-full border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
                >
                  Regenerate
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      {switcherOpen && <WalletSwitcherModal onClose={() => setSwitcherOpen(false)} />}
    </>
  );
}
