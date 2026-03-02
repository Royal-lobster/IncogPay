"use client";

import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { getCachedWallet } from "@/lib/railgun";
import { clearSendFlow, loadSendFlow, saveSendFlow } from "@/lib/send-flow-storage";
import type { SupportedChain } from "@/lib/wagmi";
import { SUPPORTED_CHAINS, TOKENS_BY_CHAIN } from "@/lib/wagmi";

interface FlowState {
  phase: string;
  intent: { amount: string; token: string } | null;
  formChain: SupportedChain;
  txHash: string | null;
  mixingStartedAt: number | null;
  recipient: string;
  sendAmount: string;
}

interface UseFlowPersistenceOptions {
  mounted: boolean;
  isConnected: boolean;
  state: FlowState;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  onRestore: (restored: {
    intent: { amount: string; token: string };
    txHash: string | null;
    mixingStartedAt: number | null;
    recipient: string;
    sendAmount: string;
    phase: "shield" | "mixing" | "send";
    needsResign: boolean;
  }) => void;
}

export function useFlowPersistence({
  mounted,
  isConnected,
  state,
  form,
  onRestore,
}: UseFlowPersistenceOptions) {
  // ── Restore on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !isConnected) return;

    const saved = loadSendFlow();
    if (!saved) return;

    const chain = SUPPORTED_CHAINS.find((c) => c.id === saved.chainId);
    if (!chain) { clearSendFlow(); return; }

    form.setValue("chain", chain);
    const token = TOKENS_BY_CHAIN[chain.id].find((t) => t.symbol === saved.intent.token);
    if (token) form.setValue("token", token);
    form.setValue("amount", saved.intent.amount);

    const needsResign =
      (saved.phase === "mixing" || saved.phase === "send") && !getCachedWallet();

    onRestore({
      intent: saved.intent,
      txHash: saved.txHash,
      mixingStartedAt: saved.mixingStartedAt,
      recipient: saved.recipient,
      sendAmount: saved.sendAmount,
      phase: saved.phase,
      needsResign,
    });
  }, [mounted, isConnected]);

  // ── Persist on change ─────────────────────────────────────────────────
  useEffect(() => {
    if (!state.intent) return;
    saveSendFlow({
      phase: state.phase as "shield" | "mixing" | "send",
      intent: state.intent,
      chainId: state.formChain.id,
      txHash: state.txHash,
      mixingStartedAt: state.mixingStartedAt,
      recipient: state.recipient,
      sendAmount: state.sendAmount,
    });
  }, [
    state.phase,
    state.intent,
    state.txHash,
    state.mixingStartedAt,
    state.recipient,
    state.sendAmount,
    state.formChain.id,
  ]);
}
