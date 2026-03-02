"use client";

import { useMutation } from "@tanstack/react-query";
import { parseUnits } from "viem";
import type { UseSignMessageReturnType, UseSendTransactionReturnType, UseWriteContractReturnType } from "wagmi";
import {
  getCachedWallet,
  getOrCreateWallet,
  getShieldContractAddress,
  getShieldSignMessage,
  getSpendableBalances,
  populateShieldTx,
  SIGN_MESSAGE,
} from "@/lib/railgun";
import type { ExistingBalance } from "@/components/send/FormStep";
import type { SupportedChain } from "@/lib/wagmi";
import { TOKENS_BY_CHAIN } from "@/lib/wagmi";
import { useState } from "react";

interface UseShieldFlowOptions {
  intent: { amount: string; token: string } | null;
  address: `0x${string}` | undefined;
  formChain: SupportedChain;
  signMessageAsync: UseSignMessageReturnType["signMessageAsync"];
  writeContractAsync: UseWriteContractReturnType["writeContractAsync"];
  sendTransactionAsync: UseSendTransactionReturnType["sendTransactionAsync"];
  onSuccess: (txHash: string, mixingStartedAt: number) => void;
}

export function useShieldFlow({
  intent,
  address,
  formChain,
  signMessageAsync,
  writeContractAsync,
  sendTransactionAsync,
  onSuccess,
}: UseShieldFlowOptions) {
  const [shieldSubPhase, setShieldSubPhase] = useState<"approving" | "shielding">("approving");
  const [existingBalances, setExistingBalances] = useState<ExistingBalance[] | null>(null);
  const [checkingBalances, setCheckingBalances] = useState(false);

  const shieldMutation = useMutation({
    mutationFn: async () => {
      if (!intent || !address) throw new Error("Missing intent or wallet");

      const chainId = formChain.id;
      const tokenInfo = TOKENS_BY_CHAIN[chainId].find((t) => t.symbol === intent.token);
      if (!tokenInfo) throw new Error("Token not found");

      setShieldSubPhase("approving");
      const walletSig = await signMessageAsync({ message: SIGN_MESSAGE });
      const wallet = await getOrCreateWallet(walletSig);

      const shieldMsg = getShieldSignMessage();
      const shieldSig = await signMessageAsync({ message: shieldMsg });

      const amount = parseUnits(intent.amount, tokenInfo.decimals);
      const proxyContract = getShieldContractAddress(chainId);

      await writeContractAsync({
        address: tokenInfo.address as `0x${string}`,
        abi: [
          {
            name: "approve",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ] as const,
        functionName: "approve",
        args: [proxyContract as `0x${string}`, amount],
      });

      setShieldSubPhase("shielding");
      const { transaction } = await populateShieldTx(
        chainId,
        shieldSig,
        tokenInfo.address,
        amount,
        wallet.railgunAddress,
        address,
      );

      const txHash = await sendTransactionAsync({
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}`,
        value: transaction.value ? BigInt(transaction.value.toString()) : BigInt(0),
      });

      return { txHash };
    },
    onSuccess: ({ txHash }) => {
      onSuccess(txHash, Date.now());
    },
  });

  const checkExistingBalances = async () => {
    const wallet = getCachedWallet();
    if (!wallet) { setExistingBalances([]); return; }

    setCheckingBalances(true);
    try {
      const tokens = TOKENS_BY_CHAIN[formChain.id];
      const balances = await getSpendableBalances(
        formChain.id,
        wallet.walletId,
        tokens.map((t) => t.address),
      );
      setExistingBalances(
        balances.map((b) => ({
          ...b,
          symbol: tokens.find((t) => t.address === b.tokenAddress)?.symbol ?? "???",
        })),
      );
    } catch (err) {
      console.error("[IncogPay] checkExistingBalances failed:", err);
      setExistingBalances([]);
    } finally {
      setCheckingBalances(false);
    }
  };

  const shieldButtonLabel = shieldMutation.isPending
    ? shieldSubPhase === "approving"
      ? "Approve in wallet…"
      : "Shielding funds…"
    : shieldMutation.isError
      ? "Try again"
      : "Deposit into pool";

  return {
    shieldMutation,
    shieldSubPhase,
    existingBalances,
    checkingBalances,
    checkExistingBalances,
    shieldButtonLabel,
  };
}
