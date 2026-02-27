"use client";

import { useState } from "react";
import { SendForm } from "@/components/SendForm";
import { SendStepper } from "@/components/SendStepper";

export type SendIntent = {
  amount: string;
  token: string;
};

export default function Home() {
  const [intent, setIntent] = useState<SendIntent | null>(null);

  return (
    <>
      <main className="min-h-[100dvh] flex items-center justify-center px-6 py-12 bg-[#0a0a0a]">
        <SendForm onSend={(i) => setIntent(i)} />
      </main>
      {intent && (
        <SendStepper intent={intent} onClose={() => setIntent(null)} />
      )}
    </>
  );
}
