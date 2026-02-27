"use client";

import Link from "next/link";
import { Ghost, PaperPlaneTilt, QrCode, ShieldCheck, Clock, ArrowRight, Eye, EyeSlash } from "@phosphor-icons/react";

const SEND_FEATURES = [
  { icon: EyeSlash,     text: "Recipient sees RAILGUN relayer — not your wallet" },
  { icon: ShieldCheck,  text: "Funds mix in RAILGUN's private pool for ~1 hour" },
  { icon: PaperPlaneTilt, text: "USDC, USDT, WETH across 4 chains" },
];

const RECEIVE_FEATURES = [
  { icon: QrCode,      text: "Generate a 0zk address from your wallet signature" },
  { icon: EyeSlash,   text: "Sender has no way to trace back to your real wallet" },
  { icon: ArrowRight, text: "Share a link — pre-fill amount, token, and chain" },
];

function FeatureCard({
  href,
  icon: Icon,
  title,
  subtitle,
  features,
  cta,
  accent,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  features: { icon: React.ElementType; text: string }[];
  cta: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col gap-5 hover:border-zinc-600 transition-colors"
    >
      {/* Top accent line */}
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${accent} to-transparent`} />

      {/* Icon + title */}
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 ring-1 ring-pink-500/20">
          <Icon size={22} weight="duotone" className="text-pink-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Feature list */}
      <ul className="space-y-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3">
            <f.icon size={14} weight="duotone" className="text-zinc-500 mt-0.5 shrink-0" />
            <span className="text-xs text-zinc-400 leading-relaxed">{f.text}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-300 group-hover:text-white transition-colors mt-auto pt-2 border-t border-zinc-800">
        {cta}
        <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="h-[100dvh] overflow-y-auto flex flex-col bg-[#0a0a0a]">
      <div className="my-auto px-6 py-12">

        {/* Hero */}
        <div className="flex flex-col items-center text-center mb-10 max-w-sm mx-auto">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-500/10 ring-1 ring-pink-500/20 mb-5">
            <Ghost size={32} weight="duotone" className="text-pink-400" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">IncogPay</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Private crypto payments on Arbitrum, Ethereum, Polygon and BNB.
            Powered by <span className="text-zinc-200">RAILGUN</span> — the same protocol Vitalik uses.
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-4 max-w-sm mx-auto">
          <FeatureCard
            href="/send"
            icon={PaperPlaneTilt}
            title="Send Privately"
            subtitle="Pay someone without revealing your wallet."
            features={SEND_FEATURES}
            cta="Start sending"
            accent="via-pink-500/40"
          />
          <FeatureCard
            href="/receive"
            icon={QrCode}
            title="Receive Privately"
            subtitle="Get paid without exposing your address."
            features={RECEIVE_FEATURES}
            cta="Generate receive link"
            accent="via-violet-500/40"
          />
        </div>

        {/* Footer note */}
        <div className="flex flex-col items-center mt-10 gap-2">
          <div className="flex items-center gap-2">
            <Eye size={12} className="text-zinc-700" />
            <p className="text-[11px] text-zinc-700">Non-custodial · No backend · Open source</p>
          </div>
          <a
            href="https://github.com/Royal-lobster/IncogPay"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-700 hover:text-zinc-500 transition-colors"
          >
            github.com/Royal-lobster/IncogPay
          </a>
        </div>
      </div>
    </main>
  );
}
