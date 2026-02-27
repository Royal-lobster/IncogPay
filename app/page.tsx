"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { SendForm } from "@/components/SendForm";
import { SendStepper } from "@/components/SendStepper";

export type SendIntent = {
  amount: string;
  token: string;
};

export default function Home() {
  const [intent, setIntent] = useState<SendIntent | null>(null);

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Header />
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <SendForm onSend={(i) => setIntent(i)} />
      </div>

      {intent && (
        <SendStepper intent={intent} onClose={() => setIntent(null)} />
      )}
    </main>
  );
}
