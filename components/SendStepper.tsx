"use client";

import { useState } from "react";
import { X } from "@phosphor-icons/react";
import type { SendIntent } from "@/app/page";
import { PreflightStep } from "./steps/PreflightStep";
import { ShieldStep } from "./steps/ShieldStep";
import { MixingStep } from "./steps/MixingStep";
import { SendStep } from "./steps/SendStep";

export type Step = "preflight" | "shield" | "mixing" | "send" | "done";

const VISIBLE_STEPS: Step[] = ["shield", "mixing", "send"];
const STEP_LABELS: Record<Step, string> = {
  preflight: "Overview",
  shield: "Shield",
  mixing: "Mixing",
  send: "Send",
  done: "Done",
};

export function SendStepper({ intent, onClose }: { intent: SendIntent; onClose: () => void }) {
  const [step, setStep] = useState<Step>("preflight");
  const [txHash, setTxHash] = useState<string | null>(null);

  const curIdx = VISIBLE_STEPS.indexOf(step);

  const handleCancel = () => {
    if (step === "preflight" || step === "shield") { onClose(); return; }
    // TODO: trigger unshield
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full sm:max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
          {step !== "preflight" && step !== "done" ? (
            <div className="flex items-center gap-4">
              {VISIBLE_STEPS.map((s, i) => {
                const sIdx = VISIBLE_STEPS.indexOf(s);
                const active = s === step;
                const done = curIdx > sIdx;
                return (
                  <div key={s} className="flex items-center gap-3">
                    {i > 0 && <div className={`w-6 h-px ${done ? "bg-pink-500" : "bg-zinc-800"}`} />}
                    <span className={`text-xs font-medium transition-colors ${
                      active ? "text-pink-400" : done ? "text-zinc-600" : "text-zinc-700"
                    }`}>
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="text-sm font-medium text-zinc-300">
              {step === "done" ? "Complete" : "How it works"}
            </span>
          )}
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "preflight" && (
            <PreflightStep intent={intent} onStart={() => setStep("shield")} onCancel={onClose} />
          )}
          {step === "shield" && (
            <ShieldStep intent={intent} onSuccess={(h) => { setTxHash(h); setStep("mixing"); }} onCancel={handleCancel} />
          )}
          {step === "mixing" && (
            <MixingStep txHash={txHash} onReady={() => setStep("send")} onCancel={handleCancel} />
          )}
          {step === "send" && (
            <SendStep intent={intent} onSuccess={() => setStep("done")} onCancel={handleCancel} />
          )}
          {step === "done" && (
            <div className="py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mx-auto mb-4">
                <span className="text-2xl">✓</span>
              </div>
              <p className="font-semibold text-zinc-100 mb-1">Transfer complete</p>
              <p className="text-sm text-zinc-500 mb-6 max-w-xs mx-auto">
                Funds sent privately. Recipient's on-chain view shows only the RAILGUN relayer address.
              </p>
              <button onClick={onClose} className="rounded-full border border-zinc-700 px-6 py-2 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors">
                Close
              </button>
            </div>
          )}
        </div>

        {/* Cancel footer */}
        {step !== "done" && step !== "preflight" && (
          <div className="border-t border-zinc-800/60 px-6 py-3 flex justify-center">
            <button onClick={handleCancel} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
              Cancel & return funds to wallet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
