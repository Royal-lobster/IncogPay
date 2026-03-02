import type {
  FeeTokenDetails,
  RailgunERC20AmountRecipient,
  TransactionGasDetails,
} from "@railgun-community/shared-models";
import { EVMGasType, NETWORK_CONFIG } from "@railgun-community/shared-models";
import {
  balanceForERC20Token,
  calculateBroadcasterFeeERC20Amount,
  gasEstimateForUnprovenUnshield,
  generateUnshieldProof,
  populateProvedUnshield,
  refreshBalances,
  walletForID,
} from "@railgun-community/wallet";
import { findBestBroadcaster, sendViaBroadcaster } from "./broadcaster";
import { ensureProvider } from "./init";
import { getNetworkName, TXID_VERSION } from "./networks";
import type { SendResult } from "./types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeDummyGasDetails(evmGasType: EVMGasType): TransactionGasDetails {
  if (evmGasType === EVMGasType.Type2) {
    return { evmGasType, gasEstimate: BigInt(0), maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) };
  }
  return { evmGasType: EVMGasType.Type0, gasEstimate: BigInt(0), gasPrice: BigInt(0) };
}

function makeFinalGasDetails(
  evmGasType: EVMGasType,
  gasEstimate: bigint,
  gasPrice: bigint,
): TransactionGasDetails {
  // 0.5 gwei floor — wallets and broadcasters will override, but SDK
  // needs a non-zero value to populate transaction fields correctly.
  const safePrice = gasPrice > BigInt(500_000_000) ? gasPrice : BigInt(500_000_000);
  if (evmGasType === EVMGasType.Type2) {
    return { evmGasType, gasEstimate, maxFeePerGas: safePrice, maxPriorityFeePerGas: safePrice };
  }
  return { evmGasType: EVMGasType.Type0, gasEstimate, gasPrice: safePrice };
}

// ─── main ─────────────────────────────────────────────────────────────────────

/**
 * Execute a private send (unshield) using RAILGUN.
 *
 * Strategy:
 *   1. Try broadcaster (Waku P2P) — fully private, recipient only sees
 *      the RAILGUN contract address.
 *   2. Fall back to self-relay only if no broadcaster is available.
 *      Self-relay reveals the sender's wallet address to the recipient
 *      and should be treated as a degraded mode.
 */
export async function privateSend(
  chainId: number,
  walletId: string,
  encryptionKey: string,
  tokenAddress: string,
  amount: bigint,
  recipientAddress: string,
  onProgress?: (phase: string, pct?: number) => void,
): Promise<SendResult> {
  const networkName = getNetworkName(chainId);
  await ensureProvider(networkName);
  const { chain, defaultEVMGasType } = NETWORK_CONFIG[networkName];

  // ── 1. Balance sync ────────────────────────────────────────────────────
  // Poll until the merkle tree scan has confirmed spendable balance.
  const MAX_POLLS = 12;
  const POLL_MS   = 8_000;
  let foundBalance = BigInt(0);

  for (let i = 1; i <= MAX_POLLS; i++) {
    onProgress?.(`Syncing balances${i > 1 ? ` (${i}/${MAX_POLLS})` : ""}...`);
    console.log(`[IncogPay] refreshBalances attempt ${i}/${MAX_POLLS}`);

    await refreshBalances(chain, [walletId]).catch((e) =>
      console.warn("[IncogPay] refreshBalances warning:", e),
    );

    try {
      const w = walletForID(walletId);
      const spendable = await balanceForERC20Token(TXID_VERSION, w, networkName, tokenAddress, true);
      const totalBal  = await balanceForERC20Token(TXID_VERSION, w, networkName, tokenAddress, false);
      console.log(`[IncogPay] poll ${i} — spendable: ${spendable}, total: ${totalBal}, need: ${amount}`);
      foundBalance = spendable;
      if (totalBal > BigInt(0) && spendable === BigInt(0)) {
        onProgress?.("Waiting for PPOI verification...");
      }
    } catch (e) {
      console.warn("[IncogPay] balance check warning:", e);
    }

    if (foundBalance >= amount) break;
    if (i < MAX_POLLS) await new Promise((r) => setTimeout(r, POLL_MS));
  }

  if (foundBalance < amount) {
    throw new Error(
      `Private balance not found after scanning. ` +
      `Spendable: ${foundBalance}, needed: ${amount}. ` +
      `The merkle tree may still be syncing — please wait and try again.`,
    );
  }

  const erc20Recipients: RailgunERC20AmountRecipient[] = [
    { tokenAddress, amount, recipientAddress },
  ];

  // ── 2. Find broadcaster ────────────────────────────────────────────────
  onProgress?.("Searching for relayer...");
  const broadcaster = await findBestBroadcaster(networkName, tokenAddress, onProgress).catch(
    (e) => { console.warn("[IncogPay] findBestBroadcaster error:", e); return null; },
  );

  const selfRelay = broadcaster === null;
  if (selfRelay) {
    console.warn(
      "[IncogPay] No broadcaster found — falling back to self-relay. " +
      "This reveals the sender's wallet address to the recipient.",
    );
    onProgress?.("No relayer found — using self-relay (reduced privacy)...");
  } else {
    console.log("[IncogPay] Broadcaster found:", broadcaster.railgunAddress);
  }

  // ── 3. Gas estimate (first pass — without broadcaster fee) ────────────
  onProgress?.("Estimating gas...");
  const dummyGas = makeDummyGasDetails(defaultEVMGasType);

  const firstEstimate = await gasEstimateForUnprovenUnshield(
    TXID_VERSION, networkName, walletId, encryptionKey,
    erc20Recipients, [], dummyGas,
    undefined, // no broadcaster fee in first estimate
    selfRelay,
  );
  console.log("[IncogPay] First gas estimate:", firstEstimate.gasEstimate.toString());

  // ── 4. Compute broadcaster fee + second gas estimate ──────────────────
  let broadcasterFeeRecipient: RailgunERC20AmountRecipient | undefined;
  let overallBatchMinGasPrice: bigint;
  let finalGasEstimate: bigint;

  if (!selfRelay && broadcaster) {
    const feeTokenDetails: FeeTokenDetails = {
      tokenAddress: broadcaster.tokenAddress,
      feePerUnitGas: broadcaster.feePerUnitGas,
    };
    const firstGasDetails = makeFinalGasDetails(
      defaultEVMGasType,
      firstEstimate.gasEstimate,
      broadcaster.feePerUnitGas,
    );

    // Calculate fee from first estimate
    const fee1 = calculateBroadcasterFeeERC20Amount(feeTokenDetails, firstGasDetails);

    const feeRecipient1: RailgunERC20AmountRecipient = {
      tokenAddress: fee1.tokenAddress,
      amount: fee1.amount,
      recipientAddress: broadcaster.railgunAddress,
    };

    // Second estimate with fee included (fee changes calldata size)
    const secondEstimate = await gasEstimateForUnprovenUnshield(
      TXID_VERSION, networkName, walletId, encryptionKey,
      erc20Recipients, [], dummyGas,
      feeRecipient1,
      false, // sendWithPublicWallet
    ).catch(() => firstEstimate); // fall back to first estimate if second fails

    const finalGasDetails = makeFinalGasDetails(
      defaultEVMGasType,
      secondEstimate.gasEstimate,
      broadcaster.feePerUnitGas,
    );

    // Final fee from second estimate
    const fee2 = calculateBroadcasterFeeERC20Amount(feeTokenDetails, finalGasDetails);

    broadcasterFeeRecipient = {
      tokenAddress: fee2.tokenAddress,
      amount: fee2.amount,
      recipientAddress: broadcaster.railgunAddress,
    };
    overallBatchMinGasPrice = broadcaster.feePerUnitGas;
    finalGasEstimate = secondEstimate.gasEstimate;

    console.log("[IncogPay] Broadcaster fee:", fee2.amount.toString(), fee2.tokenAddress);
    console.log("[IncogPay] Final gas estimate:", finalGasEstimate.toString());
  } else {
    // Self-relay: no broadcaster fee, gas price commitment = 0
    broadcasterFeeRecipient = undefined;
    overallBatchMinGasPrice = BigInt(0);
    finalGasEstimate = firstEstimate.gasEstimate;
  }

  // ── 5. Generate ZK proof ───────────────────────────────────────────────
  onProgress?.("Generating ZK proof...", 0);
  console.log("[IncogPay] generateUnshieldProof", { selfRelay, overallBatchMinGasPrice: overallBatchMinGasPrice.toString() });

  try {
    await generateUnshieldProof(
      TXID_VERSION, networkName, walletId, encryptionKey,
      erc20Recipients, [],
      broadcasterFeeRecipient,
      selfRelay,
      overallBatchMinGasPrice,
      (progress, status) => {
        console.log(`[IncogPay] proof ${Math.round(progress * 100)}% — ${status}`);
        onProgress?.("Generating ZK proof...", Math.round(progress * 100));
      },
    );
    console.log("[IncogPay] Proof generation complete");
  } catch (e) {
    console.error("[IncogPay] generateUnshieldProof FAILED:", e);
    throw e;
  }

  // ── 6. Populate proved transaction ─────────────────────────────────────
  onProgress?.("Preparing transaction...");
  const gasDetails = makeFinalGasDetails(defaultEVMGasType, finalGasEstimate, overallBatchMinGasPrice);

  const populated = await populateProvedUnshield(
    TXID_VERSION, networkName, walletId,
    erc20Recipients, [],
    broadcasterFeeRecipient,
    selfRelay,
    overallBatchMinGasPrice,
    gasDetails,
  );

  console.log("[IncogPay] populateProvedUnshield:", JSON.stringify(populated, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  ));

  if (!populated?.transaction) {
    throw new Error(
      `populateProvedUnshield returned no transaction (keys: ${Object.keys(populated ?? {}).join(", ")})`,
    );
  }

  // ── 7. Submit ──────────────────────────────────────────────────────────
  if (!selfRelay && broadcaster) {
    // ── Broadcaster path (private) ────────────────────────────────────
    onProgress?.("Sending via relayer...");
    console.log("[IncogPay] Submitting via broadcaster...");

    const txHash = await sendViaBroadcaster(
      TXID_VERSION,
      { to: populated.transaction.to!, data: populated.transaction.data! as string },
      broadcaster.railgunAddress,
      broadcaster.feesID,
      chain,
      populated.nullifiers ?? [],
      overallBatchMinGasPrice,
      false, // useRelayAdapt
      populated.preTransactionPOIsPerTxidLeafPerList,
    );

    console.log("[IncogPay] Broadcaster tx hash:", txHash);
    return { txHash };
  } else {
    // ── Self-relay fallback (reduced privacy) ────────────────────────
    onProgress?.("Sign in wallet...");
    return {
      txHash: "",
      selfRelayTx: {
        to:       populated.transaction.to!,
        data:     populated.transaction.data! as `0x${string}`,
        gasLimit: finalGasEstimate,
      },
    };
  }
}
