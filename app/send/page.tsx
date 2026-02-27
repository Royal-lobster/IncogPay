"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { SendForm } from "@/components/SendForm";
import { SendStepper } from "@/components/SendStepper";
import { WalletConnectGate } from "@/components/WalletConnectGate";

export default function SendPage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <main className="h-[100dvh] overflow-y-auto flex flex-col bg-[#0a0a0a]">
        <div className="my-auto px-6 py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-8"
          >
            <ArrowLeft size={12} weight="bold" />
            Back
          </Link>

          <WalletConnectGate accentColor="pink">
            <SendForm onSend={() => setOpen(true)} />
          </WalletConnectGate>
        </div>
      </main>

      {open && <SendStepper onClose={() => setOpen(false)} />}
    </>
  );
}
