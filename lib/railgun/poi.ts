import { NETWORK_CONFIG } from "@railgun-community/shared-models";
import { getWalletTransactionHistory, refreshBalances } from "@railgun-community/wallet";
import { ensureEngine } from "./init";
import { getNetworkName } from "./networks";

/**
 * Poll the RAILGUN engine until shielded funds become spendable.
 *
 * After a shield transaction is mined on-chain, the RAILGUN Proof-of-Innocence
 * (PPOI) system must verify the deposit before the funds appear as spendable.
 * This function scans the merkle tree and checks for transaction history to
 * determine when the shielded balance is available.
 *
 * @param chainId        - EVM chain id
 * @param walletId       - RAILGUN wallet id (from wallet creation)
 * @param onProgress     - Optional callback for status updates
 * @param pollIntervalMs - Delay between polling attempts (default 30s)
 * @param signal         - Optional AbortSignal to cancel polling
 */
export async function waitForSpendable(
  chainId: number,
  walletId: string,
  onProgress?: (status: string) => void,
  pollIntervalMs = 30_000,
  signal?: AbortSignal,
): Promise<void> {
  await ensureEngine();
  const networkName = getNetworkName(chainId);
  const { chain } = NETWORK_CONFIG[networkName];

  while (!signal?.aborted) {
    onProgress?.("Scanning for shielded balance...");

    // Trigger a merkle-tree scan / balance refresh for this wallet
    await refreshBalances(chain, [walletId]).catch(() => {});

    // Check whether any transaction history entries exist for this wallet.
    // The presence of history entries indicates the shield has been processed
    // and the PPOI verification is complete (funds are spendable).
    const history = await getWalletTransactionHistory(
      chain,
      walletId,
      undefined, // startingBlock — scan all
    ).catch(() => null);

    if (history && history.length > 0) {
      onProgress?.("Privacy verification complete");
      return;
    }

    onProgress?.("Waiting for privacy verification...");

    // Wait for the next poll interval, respecting abort signal
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, pollIntervalMs);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }

  throw new DOMException("Aborted", "AbortError");
}
