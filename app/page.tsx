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
      <main className="h-[100dvh] overflow-y-auto flex flex-col bg-[#0a0a0a]">
        <div className="my-auto flex justify-center px-6 py-8">
          <SendForm onSend={(i) => setIntent(i)} />
        </div>
      </main>
      {intent && (
        <SendStepper intent={intent} onClose={() => setIntent(null)} />
      )}
    </>
  );
}
