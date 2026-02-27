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
    <main className="h-screen overflow-y-auto flex flex-col items-center justify-center px-6 py-8 bg-[#0a0a0a]">
      <SendForm onSend={(i) => setIntent(i)} />
      {intent && (
        <SendStepper intent={intent} onClose={() => setIntent(null)} />
      )}
    </main>
  );
}
