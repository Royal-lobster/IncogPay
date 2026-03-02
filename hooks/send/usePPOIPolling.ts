"use client";

import { useEffect, useState } from "react";
import { getCachedWallet, waitForSpendable } from "@/lib/railgun";
import type { SupportedChain } from "@/lib/wagmi";

interface UsePPOIPollingOptions {
  active: boolean; // true only when phase === "mixing" and !needsResign
  formChain: SupportedChain;
  onSpendable: () => void;
}

export function usePPOIPolling({ active, formChain, onSpendable }: UsePPOIPollingOptions) {
  const [poiStatus, setPoiStatus] = useState("Waiting for privacy verification...");

  useEffect(() => {
    if (!active) return;

    const wallet = getCachedWallet();
    if (!wallet) return;

    const abort = new AbortController();

    waitForSpendable(
      formChain.id,
      wallet.walletId,
      (status) => setPoiStatus(status),
      30_000,
      abort.signal,
    )
      .then(onSpendable)
      .catch((err) => {
        if (err.name !== "AbortError") console.error("PPOI polling failed:", err);
      });

    return () => abort.abort();
  }, [active, formChain.id]);

  return { poiStatus };
}
