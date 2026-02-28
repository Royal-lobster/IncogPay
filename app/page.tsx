"use client";

import {
  ArrowRight,
  Clock,
  EyeSlash,
  Ghost,
  Lock,
  PaperPlaneTilt,
  QrCode,
  ShieldCheck,
  Signature,
  Wallet,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { ChainIcon } from "@/components/ChainIcon";
import { SUPPORTED_CHAINS } from "@/lib/wagmi";

const SEND_STEPS = [
  {
    icon: Wallet,
    title: "Connect your wallet",
    desc: "Browser wallet or WalletConnect. No transaction, just a connection.",
  },
  {
    icon: PaperPlaneTilt,
    title: "Enter amount & token",
    desc: "Pick your chain, token, and how much to send.",
  },
  {
    icon: ShieldCheck,
    title: "Shield into private pool",
    desc: "Funds enter RAILGUN's pool on-chain. Needs ~$0.10 gas.",
  },
  {
    icon: Clock,
    title: "Wait ~1 hour",
    desc: "ZK privacy check runs on-chain. Safe to close the tab.",
  },
  {
    icon: Lock,
    title: "Send to any address",
    desc: "Recipient sees the RAILGUN relayer — never your wallet. No ETH needed.",
  },
];

const RECEIVE_STEPS = [
  {
    icon: Wallet,
    title: "Connect your wallet",
    desc: "Browser wallet or WalletConnect. Nothing is sent.",
  },
  {
    icon: Signature,
    title: "Sign a message",
    desc: "Off-chain only — no gas, no transaction. Just derives your private address.",
  },
  {
    icon: QrCode,
    title: "Get your 0zk address",
    desc: "A shielded address tied to your wallet, but completely untraceable to it.",
  },
  {
    icon: EyeSlash,
    title: "Share & receive",
    desc: "Send the address or link. Payers see the RAILGUN relayer — not you.",
  },
];

export default function Home() {
  const [howTab, setHowTab] = useState<"send" | "receive">("send");
  const steps = howTab === "send" ? SEND_STEPS : RECEIVE_STEPS;
  const accent = howTab === "send" ? "pink" : "violet";

  return (
    <main className="bg-[#0a0a0a] px-5 md:px-8 py-12 md:py-20 lg:py-28 relative overflow-hidden">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 md:h-[28rem] md:w-[28rem] rounded-full bg-pink-500 opacity-[0.05] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 md:h-96 md:w-96 rounded-full bg-violet-500 opacity-[0.05] blur-3xl" />

      <div className="relative w-full max-w-sm md:max-w-3xl lg:max-w-4xl mx-auto flex flex-col gap-5 sm:gap-6 md:gap-10 lg:gap-12">
        {/* ── Hero + Action Cards ── */}
        <div className="md:flex md:items-start md:justify-between md:gap-10 lg:gap-16">
          {/* Hero */}
          <div className="md:flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 mb-4 md:mb-5">
              <Ghost size={13} weight="duotone" className="text-pink-400" />
              <span className="text-xs font-semibold text-zinc-300 tracking-tight">IncogPay</span>
            </div>

            <h1 className="text-[2rem] sm:text-[2.6rem] md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-2 sm:mb-3 md:mb-5 text-zinc-50">
              Private crypto
              <br />
              payments.
            </h1>

            <p className="text-sm md:text-[15px] lg:text-base text-zinc-500 leading-relaxed mb-3 sm:mb-4 md:mb-6 md:max-w-md">
              Send and receive without revealing your wallet.{" "}
              <span className="text-zinc-300">Powered by RAILGUN</span> — the same zero-knowledge
              protocol Vitalik uses.
            </p>

            {/* Supported chains */}
            <div className="flex items-center gap-1.5 md:gap-2">
              {SUPPORTED_CHAINS.map((c) => (
                <div
                  key={c.id}
                  title={c.label}
                  className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900"
                >
                  <ChainIcon chainId={c.id} size={14} />
                </div>
              ))}
              <span className="text-[11px] text-zinc-600 ml-1">4 chains</span>
            </div>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 mt-5 md:mt-0 md:w-[340px] lg:w-[380px] shrink-0">
            {/* Send */}
            <Link
              href="/send"
              className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-5 flex flex-col gap-4 hover:border-pink-800/50 hover:bg-pink-950/10 transition-all duration-200"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/50 to-transparent" />
              <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl bg-pink-500/10 ring-1 ring-pink-500/20">
                <PaperPlaneTilt size={17} weight="duotone" className="text-pink-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-zinc-100 mb-1">Send</h2>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Pay without revealing your wallet address
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-zinc-600 group-hover:text-pink-400 transition-colors">
                Send privately
                <ArrowRight
                  size={11}
                  weight="bold"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </Link>

            {/* Receive */}
            <Link
              href="/receive"
              className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-5 flex flex-col gap-4 hover:border-violet-800/50 hover:bg-violet-950/10 transition-all duration-200"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
              <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
                <QrCode size={17} weight="duotone" className="text-violet-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-zinc-100 mb-1">Receive</h2>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Get paid without exposing your real address
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-zinc-600 group-hover:text-violet-400 transition-colors">
                Get address
                <ArrowRight
                  size={11}
                  weight="bold"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </Link>
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-4 md:p-6 lg:p-8">
          {/* Header row: label + tab switcher */}
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <span className="text-[10px] md:text-[11px] font-medium uppercase tracking-widest text-zinc-600">
              How it works
            </span>
            <div className="flex items-center gap-0.5 bg-zinc-900 rounded-lg p-0.5">
              <button
                onClick={() => setHowTab("send")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  howTab === "send"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                <PaperPlaneTilt
                  size={10}
                  weight="duotone"
                  className={howTab === "send" ? "text-pink-400" : "text-zinc-600"}
                />
                Send
              </button>
              <button
                onClick={() => setHowTab("receive")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  howTab === "receive"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                <QrCode
                  size={10}
                  weight="duotone"
                  className={howTab === "receive" ? "text-violet-400" : "text-zinc-600"}
                />
                Receive
              </button>
            </div>
          </div>

          {/* Steps: vertical timeline on mobile, 2-col grid on desktop */}
          <ol className="space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-4 md:space-y-0">
            {steps.map((step, i) => (
              <li key={`${howTab}-${i}`} className="flex gap-3">
                {/* Number + connector line */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[10px] md:text-[11px] font-bold ring-1 shrink-0 ${
                      accent === "pink"
                        ? "bg-pink-500/10 text-pink-400 ring-pink-500/20"
                        : "bg-violet-500/10 text-violet-400 ring-violet-500/20"
                    }`}
                  >
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className="w-px bg-zinc-800 flex-1 my-1 md:hidden"
                      style={{ minHeight: "14px" }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className={`${i < steps.length - 1 ? "pb-3 md:pb-0" : ""} pt-0.5`}>
                  <p className="text-xs md:text-sm font-medium text-zinc-200">{step.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Privacy proof row */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-4 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4">
          <ShieldCheck size={14} weight="duotone" className="text-emerald-500 shrink-0" />
          <p className="text-xs md:text-sm text-zinc-500 leading-relaxed flex-1">
            ZK proofs on-chain — recipient sees the{" "}
            <span className="text-zinc-300">RAILGUN relayer</span>, never your wallet.
          </p>
          <EyeSlash size={14} weight="duotone" className="text-zinc-700 shrink-0" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 md:gap-5">
          <span className="text-[10px] md:text-[11px] text-zinc-700">Non-custodial</span>
          <span className="h-3 w-px bg-zinc-800" />
          <span className="text-[10px] md:text-[11px] text-zinc-700">No backend</span>
          <span className="h-3 w-px bg-zinc-800" />
          <a
            href="https://github.com/Royal-lobster/IncogPay"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] md:text-[11px] text-zinc-700 hover:text-zinc-400 transition-colors"
          >
            Open source ↗
          </a>
        </div>
      </div>
    </main>
  );
}
