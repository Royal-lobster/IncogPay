"use client";

import {
  ArrowLeft,
  CaretDown,
  Check,
  CircleNotch,
  Copy,
  Ghost,
  QrCode,
  ShieldCheck,
  Wallet,
} from "@phosphor-icons/react";
import { defineStepper } from "@stepperize/react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { ChainIcon } from "@/components/ChainIcon";
import { TokenIcon } from "@/components/TokenIcon";
import { WalletConnectModal } from "@/components/WalletConnectModal";
import { WalletSwitcherModal } from "@/components/WalletSwitcherModal";
import { deriveRailgunAddress } from "@/lib/railgun";
import { SUPPORTED_CHAINS, type SupportedChain, TOKENS_BY_CHAIN } from "@/lib/wagmi";

// ─── stepper ──────────────────────────────────────────────────────────────────
const { useStepper } = defineStepper(
  { id: "connect" },
  { id: "idle" },
  { id: "signing" },
  { id: "ready" },
);

const HOW_IT_WORKS = [
  { icon: Wallet, text: "Connect your wallet — nothing is sent, just a signature." },
  { icon: ShieldCheck, text: "We derive your RAILGUN 0zk address from that signature." },
  { icon: Ghost, text: "Share the address or link. Sender sees RAILGUN, not you." },
];

function fmtAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// ─── component ────────────────────────────────────────────────────────────────
export default function ReceivePage() {
  const { isConnected, address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const stepper = useStepper({ initialStep: isConnected ? "idle" : "connect" });
  const phase = stepper.state.current.data.id as "connect" | "idle" | "signing" | "ready";

  useEffect(() => {
    if (isConnected && phase === "connect") stepper.navigation.goTo("idle");
  }, [isConnected]);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // shielded address
  const [shieldedAddr, setShieldedAddr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // share link config
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

  // ── sign mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      stepper.navigation.goTo("signing");
      const sig = await signMessageAsync({
        message: "Generate my IncogPay RAILGUN wallet",
      });
      return deriveRailgunAddress(sig);
    },
    onSuccess: (addr) => {
      setShieldedAddr(addr);
      stepper.navigation.goTo("ready");
    },
    onError: () => {
      stepper.navigation.goTo("idle");
    },
  });

  const shareUrl = (() => {
    if (!shieldedAddr || typeof window === "undefined") return "";
    const p = new URLSearchParams({
      to: shieldedAddr,
      chain: String(chain.id),
      token: token.symbol,
    });
    if (amount) p.set("amount", amount);
    return `${window.location.origin}/send?${p}`;
  })();

  const copy = (text: string, which: "addr" | "link") => {
    navigator.clipboard.writeText(text);
    if (which === "addr") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <>
      <main className="h-[100dvh] overflow-hidden flex flex-col justify-center bg-[#0a0a0a] px-5 py-5 relative">
        {/* ambient glows */}
        <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-pink-500 opacity-[0.05] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-violet-500 opacity-[0.05] blur-3xl" />

        <div className="w-full max-w-md mx-auto">
          {/* Top nav */}
          <div className="flex items-center justify-between mb-3 shrink-0">
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
                className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="font-mono">{fmtAddr(address)}</span>
                <CaretDown size={9} weight="bold" className="text-zinc-600" />
              </button>
            )}
          </div>

          {/* ── Fixed card ── */}
          <div className="h-[520px] max-h-[calc(100dvh-88px)] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
            {/* gradient accent */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-500/40 to-transparent shrink-0" />

            {/* ── Permanent card header ── */}
            <div className="shrink-0 px-5 pt-4 pb-4 border-b border-zinc-800/60">
              {phase !== "ready" ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
                    <QrCode size={18} weight="duotone" className="text-violet-400" />
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold text-zinc-100">Receive Privately</h1>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Generate a shielded address. Senders can&apos;t trace it back to your wallet.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    <Check size={18} weight="bold" className="text-emerald-400" />
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold text-zinc-100">Your 0zk address</h1>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Share this address — senders can&apos;t trace it to your wallet.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Card body ── */}
            <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3">
              {/* ── connect ── */}
              {phase === "connect" && (
                <>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">Connect Wallet</h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      Connect a Web3 wallet to get started. No transaction — just a connection.
                    </p>
                  </div>
                  <ul className="space-y-2.5">
                    {HOW_IT_WORKS.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3.5 py-3"
                      >
                        <item.icon
                          size={13}
                          weight="duotone"
                          className="text-violet-400 mt-0.5 shrink-0"
                        />
                        <span className="text-xs text-zinc-400">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* ── idle ── */}
              {phase === "idle" && (
                <>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">
                      Generate Private Address
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      Sign a message to derive your RAILGUN 0zk address. Nothing is sent on-chain.
                    </p>
                  </div>
                  <ul className="space-y-2.5">
                    {HOW_IT_WORKS.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3.5 py-3"
                      >
                        <item.icon
                          size={13}
                          weight="duotone"
                          className="text-violet-400 mt-0.5 shrink-0"
                        />
                        <span className="text-xs text-zinc-400">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* ── signing ── */}
              {phase === "signing" && (
                <>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">Sign the Message</h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      Approve the signature request in your wallet to generate your 0zk address.
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <CircleNotch size={26} className="animate-spin text-violet-400" />
                    <p className="text-sm text-zinc-400 text-center">
                      Check your wallet and sign the message…
                    </p>
                  </div>
                </>
              )}

              {/* ── ready ── */}
              {phase === "ready" && shieldedAddr && (
                <>
                  <div className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5">
                    <div className="rounded-lg bg-white p-1.5 shrink-0 self-start">
                      <QRCodeSVG value={shieldedAddr} size={100} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                          0zk address
                        </span>
                        <button
                          onClick={() => copy(shieldedAddr, "addr")}
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {copied ? (
                            <>
                              <Check size={11} weight="bold" className="text-emerald-400" />
                              <span className="text-emerald-400 ml-0.5">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span className="ml-0.5">Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-300 font-mono break-all bg-zinc-800 rounded-lg px-2 py-1.5 leading-relaxed">
                        {shieldedAddr}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                        Share link
                      </span>
                      <button
                        onClick={() => copy(shareUrl, "link")}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {copiedLink ? (
                          <>
                            <Check size={11} weight="bold" className="text-emerald-400" />
                            <span className="text-emerald-400 ml-0.5">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span className="ml-0.5">Copy link</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button
                          onClick={() => {
                            setChainOpen(!chainOpen);
                            setTokenOpen(false);
                          }}
                          className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 transition-colors"
                        >
                          <ChainIcon chainId={chain.id} size={12} />
                          {chain.label}
                          <CaretDown size={9} weight="bold" className="text-zinc-500" />
                        </button>
                        {chainOpen && (
                          <div className="absolute left-0 top-full mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-20 overflow-hidden w-40">
                            {SUPPORTED_CHAINS.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => handleChainChange(c)}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors flex items-center gap-2 ${c.id === chain.id ? "text-violet-400" : "text-zinc-300"}`}
                              >
                                <ChainIcon chainId={c.id} size={14} />
                                {c.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => {
                            setTokenOpen(!tokenOpen);
                            setChainOpen(false);
                          }}
                          className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 transition-colors"
                        >
                          <TokenIcon symbol={token.symbol} size={12} />
                          {token.symbol}
                          <CaretDown size={9} weight="bold" className="text-zinc-500" />
                        </button>
                        {tokenOpen && (
                          <div className="absolute left-0 top-full mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-20 overflow-hidden w-28">
                            {tokens.map((t) => (
                              <button
                                key={t.symbol}
                                onClick={() => {
                                  setToken(t);
                                  setTokenOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors flex items-center gap-2 ${t.symbol === token.symbol ? "text-violet-400" : "text-zinc-300"}`}
                              >
                                <TokenIcon symbol={t.symbol} size={12} />
                                {t.symbol}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        type="number"
                        placeholder="any amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="flex-1 min-w-0 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-700 font-mono break-all leading-relaxed mt-2.5">
                      {shareUrl}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* ── Card footer ── */}
            <div className="shrink-0 border-t border-zinc-800/60 px-5 py-4">
              {phase === "connect" && (
                <button
                  onClick={() => setWalletModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors"
                >
                  <Wallet size={14} weight="duotone" />
                  Connect Wallet
                </button>
              )}
              {phase === "idle" && (
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="w-full py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <QrCode size={14} weight="duotone" />
                  Generate Receive Address
                </button>
              )}
              {phase === "signing" && (
                <button
                  onClick={() => {
                    generateMutation.reset();
                    stepper.navigation.goTo("idle");
                  }}
                  className="w-full py-2.5 rounded-full border border-zinc-800 text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
                >
                  Cancel
                </button>
              )}
              {phase === "ready" && (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] text-zinc-700 flex items-center gap-1.5 min-w-0">
                    <ShieldCheck size={10} weight="duotone" className="text-zinc-600 shrink-0" />
                    Real wallet never revealed — 0zk always re-derivable
                  </p>
                  <button
                    onClick={() => {
                      generateMutation.reset();
                      setShieldedAddr(null);
                      stepper.navigation.goTo("idle");
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap shrink-0"
                  >
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <WalletConnectModal open={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
      {switcherOpen && <WalletSwitcherModal onClose={() => setSwitcherOpen(false)} />}
    </>
  );
}
