"use client";

import { useMutation } from "@tanstack/react-query";
import { parseUnits } from "viem";
import type { UseSendTransactionReturnType } from "wagmi";
import { getCachedWallet, privateSend } from "@/lib/railgun";
import type { SupportedChain } from "@/lib/wagmi";
import { TOKENS_BY_CHAIN } from "@/lib/wagmi";
import { useState } from "react";

interface UseSendFlowOptions {
  intent: { amount: string; token: string } | null;
  formChain: SupportedChain;
  recipient: string;
  sendAmount: string;
  sendTransactionAsync: UseSendTransactionReturnType["sendTransactionAsync"];
  onSuccess: () => void;
}

export function useSendFlow({
  intent,
  formChain,
  recipient,
  sendAmount,
  sendTransactionAsync,
  onSuccess,
}: UseSendFlowOptions) {
  const [sendSubLabel, setSendSubLabel] = useState<"proving" | "broadcasting">("proving");
  const [proofProgress, setProofProgress] = useState(0);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!intent) throw new Error("No intent");

      const wallet = getCachedWallet();
      if (!wallet) throw new Error("RAILGUN wallet not initialized");

      const tokenInfo = TOKENS_BY_CHAIN[formChain.id].find((t) => t.symbol === intent.token);
      if (!tokenInfo) throw new Error("Token not found");

      const amount = parseUnits(sendAmount, tokenInfo.decimals);

      const result = await privateSend(
        formChain.id,
        wallet.walletId,
        wallet.encryptionKey,
        tokenInfo.address,
        amount,
        recipient,
        (phase, pct) => {
          if (phase.includes("proof")) {
            setSendSubLabel("proving");
            setProofProgress(pct ?? 0);
          } else if (
            phase.includes("Broadcasting") ||
            phase.includes("relayer") ||
            phase.includes("Sign in wallet")
          ) {
            setSendSubLabel("broadcasting");
          }
        },
      );

      if (result.selfRelayTx) {
        setSendSubLabel("broadcasting");
        const hash = await sendTransactionAsync({
          to: result.selfRelayTx.to as `0x${string}`,
          data: result.selfRelayTx.data,
          gas: result.selfRelayTx.gasLimit,
        });
        return { txHash: hash };
      }

      return result;
    },
    onSuccess,
  });

  const sendButtonLabel = sendMutation.isPending
    ? sendSubLabel === "proving"
      ? "Generating ZK proof…"
      : "Broadcasting…"
    : sendMutation.isSuccess
      ? "Sent"
      : sendMutation.isError
        ? "Try again"
        : "Confirm Send";

  return { sendMutation, sendSubLabel, proofProgress, sendButtonLabel };
}
