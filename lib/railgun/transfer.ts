import type {
  RailgunERC20AmountRecipient,
  TransactionGasDetails,
} from "@railgun-community/shared-models";
import { EVMGasType, NETWORK_CONFIG } from "@railgun-community/shared-models";
import {
  balanceForERC20Token,
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

/**
 * Execute a private unshield (send shielded tokens to a public address).
 *
 * Tries the broadcaster (relayer) network first for maximum privacy.
 * If no broadcaster is found after retries, falls back to self-relay
 * where the user's own wallet submits the transaction (requires native
 * gas token, slightly less private but funds aren't stuck).
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
  const { chain } = NETWORK_CONFIG[networkName];

  // ── Wait for merkle tree scan to find the balance ──────────────────────
  // After a fresh page load, loadWalletByID triggers a background merkle
  // tree scan.  A single refreshBalances call may return before the scan
  // reaches the block that contains the shield.  We poll until the SDK
  // reports a non-zero balance (or time out after ~90 s).
  const MAX_BALANCE_POLLS = 12;
  const BALANCE_POLL_INTERVAL_MS = 8_000;

  let foundBalance = BigInt(0);
  for (let attempt = 1; attempt <= MAX_BALANCE_POLLS; attempt++) {
    onProgress?.(`Syncing balances${attempt > 1 ? ` (${attempt}/${MAX_BALANCE_POLLS})` : ""}...`);
    console.log(`[IncogPay] refreshBalances attempt ${attempt}/${MAX_BALANCE_POLLS}`);

    await refreshBalances(chain, [walletId]).catch((err) => {
      console.warn("[IncogPay] refreshBalances warning:", err);
    });

    try {
      const wallet = walletForID(walletId);
      const spendable = await balanceForERC20Token(
        TXID_VERSION, wallet, networkName, tokenAddress, true,
      );
      const total = await balanceForERC20Token(
        TXID_VERSION, wallet, networkName, tokenAddress, false,
      );
      console.log(`[IncogPay] Balance poll ${attempt} — spendable: ${spendable.toString()}, total: ${total.toString()}, token: ${tokenAddress}, needed: ${amount.toString()}`);
      foundBalance = spendable;
    } catch (err) {
      console.warn("[IncogPay] Balance check failed:", err);
    }

    if (foundBalance >= amount) break;

    // If total is non-zero but spendable is 0, PPOI hasn't verified yet
    // If both are 0, merkle tree scan hasn't reached the shield tx yet
    if (attempt < MAX_BALANCE_POLLS) {
      onProgress?.(`Waiting for balance to sync (${attempt}/${MAX_BALANCE_POLLS})...`);
      await new Promise((r) => setTimeout(r, BALANCE_POLL_INTERVAL_MS));
    }
  }

  if (foundBalance < amount) {
    throw new Error(
      `Private balance not found after scanning. Spendable: ${foundBalance.toString()}, needed: ${amount.toString()}. ` +
      `The merkle tree may still be syncing — please wait a minute and try again.`,
    );
  }

  // ── Step 1: Try to find a broadcaster ──────────────────────────────────
  onProgress?.("Finding relayer...");
  let broadcaster = await findBestBroadcaster(
    networkName,
    tokenAddress,
    (msg) => onProgress?.(msg),
  );

  let selfRelay = !broadcaster;

  // ── Step 2: Estimate gas (may fall back to self-relay) ─────────────────
  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
    { tokenAddress, amount, recipientAddress },
  ];

  const { defaultEVMGasType } = NETWORK_CONFIG[networkName];
  const dummyGasDetails: TransactionGasDetails =
    defaultEVMGasType === EVMGasType.Type2
      ? {
          evmGasType: EVMGasType.Type2,
          gasEstimate: BigInt(0),
          maxFeePerGas: BigInt(0),
          maxPriorityFeePerGas: BigInt(0),
        }
      : {
          evmGasType: EVMGasType.Type0,
          gasEstimate: BigInt(0),
          gasPrice: BigInt(0),
        };

  let gasEstimate;

  if (broadcaster && !selfRelay) {
    // Try with broadcaster fees first
    onProgress?.("Estimating gas...");
    try {
      gasEstimate = await gasEstimateForUnprovenUnshield(
        TXID_VERSION,
        networkName,
        walletId,
        encryptionKey,
        erc20AmountRecipients,
        [],
        dummyGasDetails,
        { tokenAddress: broadcaster.tokenAddress, feePerUnitGas: broadcaster.feePerUnitGas },
        false,
      );
      console.log("[IncogPay] Gas estimate with broadcaster succeeded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[IncogPay] Broadcaster gas estimate failed:", msg);
      // Any error during broadcaster estimation → fall back to self-relay
      console.log("[IncogPay] Falling back to self-relay");
      onProgress?.("Relayer unavailable — switching to self-relay...");
      selfRelay = true;
      broadcaster = null;
    }
  }

  // Self-relay path (no broadcaster fee, user pays gas in native token)
  if (selfRelay) {
    onProgress?.("Self-relay mode (you pay gas in ETH)...");
    gasEstimate = await gasEstimateForUnprovenUnshield(
      TXID_VERSION,
      networkName,
      walletId,
      encryptionKey,
      erc20AmountRecipients,
      [],
      dummyGasDetails,
      undefined,
      true,
    );
    console.log("[IncogPay] Gas estimate with self-relay succeeded");
  }

  const broadcasterFeeRecipient: RailgunERC20AmountRecipient | undefined = broadcaster
    ? {
        tokenAddress: broadcaster.tokenAddress,
        amount: BigInt(0),
        recipientAddress: broadcaster.railgunAddress,
      }
    : undefined;

  if (!gasEstimate) throw new Error("Gas estimation failed");
  const overallBatchMinGasPrice = gasEstimate.gasEstimate ?? BigInt(0);

  // ── Step 3: Generate ZK proof ──────────────────────────────────────────
  onProgress?.("Generating proof...", 0);

  const progressCallback = (progress: number, _status: string) => {
    onProgress?.("Generating proof...", Math.round(progress * 100));
  };

  console.log("[IncogPay] Starting proof generation...");
  await generateUnshieldProof(
    TXID_VERSION,
    networkName,
    walletId,
    encryptionKey,
    erc20AmountRecipients,
    [],
    broadcasterFeeRecipient,
    selfRelay,
    overallBatchMinGasPrice,
    progressCallback,
  );
  console.log("[IncogPay] Proof generation complete");

  // ── Step 4: Populate proved transaction ────────────────────────────────
  onProgress?.("Preparing transaction...");

  const finalGasDetails: TransactionGasDetails =
    defaultEVMGasType === EVMGasType.Type2
      ? {
          evmGasType: EVMGasType.Type2,
          gasEstimate: gasEstimate.gasEstimate,
          maxFeePerGas: overallBatchMinGasPrice,
          maxPriorityFeePerGas: overallBatchMinGasPrice,
        }
      : {
          evmGasType: EVMGasType.Type0,
          gasEstimate: gasEstimate.gasEstimate,
          gasPrice: overallBatchMinGasPrice,
        };

  const populateResult = await populateProvedUnshield(
    TXID_VERSION,
    networkName,
    walletId,
    erc20AmountRecipients,
    [],
    broadcasterFeeRecipient,
    selfRelay,
    overallBatchMinGasPrice,
    finalGasDetails,
  );
  console.log("[IncogPay] populateProvedUnshield result:", JSON.stringify(populateResult, (_, v) => typeof v === "bigint" ? v.toString() : v));

  if (!populateResult?.transaction) {
    throw new Error(
      `populateProvedUnshield returned no transaction. ` +
      `Result keys: ${populateResult ? Object.keys(populateResult).join(", ") : "undefined"}`,
    );
  }

  // ── Step 5: Send transaction ───────────────────────────────────────────
  if (selfRelay) {
    onProgress?.("Sign in wallet...");
    return {
      txHash: "",
      selfRelayTx: {
        to: populateResult.transaction.to!,
        data: populateResult.transaction.data! as `0x${string}`,
        gasLimit: gasEstimate.gasEstimate,
      },
    };
  }

  onProgress?.("Broadcasting...");

  const nullifiers = populateResult.nullifiers ?? [];
  const txHash = await sendViaBroadcaster(
    TXID_VERSION,
    {
      to: populateResult.transaction.to!,
      data: populateResult.transaction.data!,
    },
    broadcaster!.railgunAddress,
    broadcaster!.feesID,
    chain,
    nullifiers,
    overallBatchMinGasPrice,
    true,
    populateResult.preTransactionPOIsPerTxidLeafPerList,
  );

  return { txHash };
}
