"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Ghost, ShieldCheck, Clock, PaperPlaneTilt,
  Wallet, CheckCircle, CaretDown,
} from "@phosphor-icons/react";
import { useAccount, useConnect } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { AmountStep } from "@/components/steps/AmountStep";
import { PreflightStep } from "@/components/steps/PreflightStep";
import { ShieldStep } from "@/components/steps/ShieldStep";
import { MixingStep } from "@/components/steps/MixingStep";
import { SendStep } from "@/components/steps/SendStep";
import { WalletSwitcherModal } from "@/components/WalletSwitcherModal";
import type { SendIntent } from "@/lib/types";

type Phase = "connect" | "form" | "preflight" | "shield" | "mixing" | "send" | "done";
const PROGRESS_PHASES = ["shield", "mixing", "send"] as const;
type ProgressPhase = (typeof PROGRESS_PHASES)[number];
const PROGRESS_LABELS: Record<ProgressPhase, string> = { shield: "Shield", mixing: "Mixing", send: "Send" };

const HOW_IT_WORKS = [
  { icon: ShieldCheck,    text: "Approve and shield your funds into RAILGUN's private pool." },
  { icon: Clock,          text: "Funds mix for ~1 hour while RAILGUN runs its on-chain privacy check." },
  { icon: PaperPlaneTilt, text: "Enter recipient, generate a ZK proof, and send via relayer. No ETH needed." },
];

function fmtAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function SendPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const { connect, isPending } = useConnect();

  const [phase, setPhase] = useState<Phase>(isConnected ? "form" : "connect");
  const [intent, setIntent] = useState<SendIntent | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    if (isConnected && phase === "connect") setPhase("form");
  }, [isConnected]); // eslint-disable-line

  const isProgress = (PROGRESS_PHASES as readonly string[]).includes(phase);
  const curIdx = PROGRESS_PHASES.indexOf(phase as ProgressPhase);

  return (
    <>
      <main className="min-h-[100dvh] flex flex-col bg-[#0a0a0a]">
        <div className="flex-1 flex flex-col justify-center px-6 py-5">

          {/* Top nav */}
          <div className="flex items-center justify-between mb-5 w-full max-w-md mx-auto">
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

            {/* Progress bar — shield / mixing / send */}
            {isProgress && (
              <div className="flex items-center gap-4 mb-6">
                {PROGRESS_PHASES.map((s, i) => {
                  const sIdx = PROGRESS_PHASES.indexOf(s);
                  const active = phase === s;
                  const done = curIdx > sIdx;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      {i > 0 && <div className={`w-6 h-px ${done ? "bg-pink-500" : "bg-zinc-800"}`} />}
                      <span className={`text-xs font-medium transition-colors ${
                        active ? "text-pink-400" : done ? "text-zinc-600" : "text-zinc-700"
                      }`}>
                        {PROGRESS_LABELS[s]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Page header — connect / form / preflight */}
            {(phase === "connect" || phase === "form" || phase === "preflight") && (
              <div className="flex flex-col items-center mb-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 ring-1 ring-pink-500/20 mb-3">
                  <Ghost size={24} weight="duotone" className="text-pink-400" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight mb-1.5">Send Privately</h1>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
                  The recipient only sees the RAILGUN relayer — not your wallet address or balance.
                </p>
              </div>
            )}

            {/* ── connect ── */}
            {phase === "connect" && (
              <>
                <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 mb-4">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/40 to-transparent" />
                  <ul className="space-y-2">
                    {HOW_IT_WORKS.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <item.icon size={13} weight="duotone" className="text-pink-400 mt-0.5 shrink-0" />
                        <span className="text-xs text-zinc-400">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs text-zinc-500 text-center mb-3">
                  A wallet is needed to shield and route funds privately.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => connect({ connector: injected() })}
                    disabled={isPending}
                    className="w-full flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-600 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/20">
                      <Wallet size={16} weight="duotone" className="text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">Browser wallet</p>
                      <p className="text-xs text-zinc-500">MetaMask, Rabby, Coinbase…</p>
                    </div>
                  </button>
                  <button
                    onClick={() => connect({ connector: walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "incogpay" }) })}
                    disabled={isPending}
                    className="w-full flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-600 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
                      <Wallet size={16} weight="duotone" className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">WalletConnect</p>
                      <p className="text-xs text-zinc-500">Rainbow, Trust, Ledger Live…</p>
                    </div>
                  </button>
                </div>
              </>
            )}

            {/* ── form (amount) ── */}
            {phase === "form" && (
              <AmountStep
                onNext={(i) => { setIntent(i); setPhase("preflight"); }}
                onCancel={() => router.push("/")}
              />
            )}

            {/* ── preflight ── */}
            {phase === "preflight" && intent && (
              <PreflightStep
                intent={intent}
                onStart={() => setPhase("shield")}
                onCancel={() => setPhase("form")}
              />
            )}

            {/* ── shield ── */}
            {phase === "shield" && intent && (
              <ShieldStep
                intent={intent}
                onSuccess={(h) => { setTxHash(h); setPhase("mixing"); }}
                onCancel={() => setPhase("form")}
              />
            )}

            {/* ── mixing ── */}
            {phase === "mixing" && (
              <MixingStep
                txHash={txHash}
                onReady={() => setPhase("send")}
                onCancel={() => setPhase("form")}
              />
            )}

            {/* ── send ── */}
            {phase === "send" && intent && (
              <SendStep
                intent={intent}
                onSuccess={() => setPhase("done")}
                onCancel={() => setPhase("form")}
              />
            )}

            {/* ── done ── */}
            {phase === "done" && (
              <div className="py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mx-auto mb-3">
                  <CheckCircle size={24} weight="duotone" className="text-emerald-400" />
                </div>
                <p className="font-semibold text-zinc-100 mb-1">Transfer complete</p>
                <p className="text-sm text-zinc-500 mb-5 max-w-xs mx-auto">
                  Funds sent privately. Recipient's on-chain view shows only the RAILGUN relayer address.
                </p>
                <Link
                  href="/"
                  className="inline-block rounded-full border border-zinc-700 px-6 py-2 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
                >
                  Done
                </Link>
              </div>
            )}

            {/* Cancel footer — active transaction phases */}
            {isProgress && phase !== "done" && (
              <div className="mt-5 flex justify-center">
                <button
                  onClick={() => setPhase("form")}
                  className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                >
                  Cancel &amp; return funds to wallet
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {switcherOpen && <WalletSwitcherModal onClose={() => setSwitcherOpen(false)} />}
    </>
  );
}
