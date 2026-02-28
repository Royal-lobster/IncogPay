import {
  generateUnshieldProof,
  populateProvedUnshield,
  gasEstimateForUnprovenUnshield,
} from "@railgun-community/wallet";
import type {
  RailgunERC20AmountRecipient,
  FeeTokenDetails,
  TransactionGasDetails,
  EVMGasType,
} from "@railgun-community/shared-models";
import { NETWORK_CONFIG } from "@railgun-community/shared-models";
import { ensureEngine } from "./init";
import { getNetworkName, TXID_VERSION } from "./networks";
import { findBestBroadcaster, sendViaBroadcaster } from "./broadcaster";
import type { SendResult } from "./types";

/**
 * Execute a private unshield (send shielded tokens to a public address)
 * via the broadcaster network.
 *
 * Flow:
 *   1. Find the best available broadcaster
 *   2. Estimate gas for the unshield
 *   3. Generate a zero-knowledge proof
 *   4. Populate the proved transaction
 *   5. Relay the transaction via the Waku broadcaster network
 *
 * @param chainId          - EVM chain id
 * @param walletId         - RAILGUN wallet id
 * @param encryptionKey    - Wallet encryption key (keccak256 of signature)
 * @param tokenAddress     - ERC-20 token contract address
 * @param amount           - Amount in base units (bigint)
 * @param recipientAddress - Public destination address (0x...)
 * @param onProgress       - Optional callback for progress updates
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
  await ensureEngine();
  const networkName = getNetworkName(chainId);
  const { chain } = NETWORK_CONFIG[networkName];

  // ── Step 1: Find best broadcaster ──────────────────────────────────────
  onProgress?.("Finding best relayer...");
  const broadcaster = await findBestBroadcaster(networkName, tokenAddress);

  const feeTokenDetails: FeeTokenDetails = {
    tokenAddress: broadcaster.tokenAddress,
    feePerUnitGas: broadcaster.feePerUnitGas,
  };

  const broadcasterFeeRecipient: RailgunERC20AmountRecipient = {
    tokenAddress: broadcaster.tokenAddress,
    amount: BigInt(0), // Placeholder — actual fee calculated by the SDK
    recipientAddress: broadcaster.railgunAddress,
  };

  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
    { tokenAddress, amount, recipientAddress },
  ];

  // ── Step 2: Estimate gas ───────────────────────────────────────────────
  onProgress?.("Estimating gas...");

  // The SDK requires originalGasDetails as a TransactionGasDetails.
  // Use Type0 as an initial estimate placeholder.
  const dummyGasDetails: TransactionGasDetails = {
    evmGasType: 0 as EVMGasType.Type0,
    gasEstimate: BigInt(0),
    gasPrice: BigInt(0),
  };

  const gasEstimate = await gasEstimateForUnprovenUnshield(
    TXID_VERSION,
    networkName,
    walletId,
    encryptionKey,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    dummyGasDetails,
    feeTokenDetails,
    false, // sendWithPublicWallet
  );

  const overallBatchMinGasPrice = gasEstimate.gasEstimate ?? BigInt(0);

  // ── Step 3: Generate ZK proof ──────────────────────────────────────────
  onProgress?.("Generating proof...", 0);

  const progressCallback = (progress: number, _status: string) => {
    onProgress?.("Generating proof...", Math.round(progress * 100));
  };

  await generateUnshieldProof(
    TXID_VERSION,
    networkName,
    walletId,
    encryptionKey,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    broadcasterFeeRecipient,
    false, // sendWithPublicWallet
    overallBatchMinGasPrice,
    progressCallback,
  );

  // ── Step 4: Populate proved transaction ────────────────────────────────
  onProgress?.("Preparing transaction...");

  const finalGasDetails: TransactionGasDetails = {
    evmGasType: 0 as EVMGasType.Type0,
    gasEstimate: gasEstimate.gasEstimate,
    gasPrice: overallBatchMinGasPrice,
  };

  const populateResult = await populateProvedUnshield(
    TXID_VERSION,
    networkName,
    walletId,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    broadcasterFeeRecipient,
    false, // sendWithPublicWallet
    overallBatchMinGasPrice,
    finalGasDetails,
  );

  // ── Step 5: Send via broadcaster ───────────────────────────────────────
  onProgress?.("Broadcasting...");

  const nullifiers = populateResult.nullifiers ?? [];
  const txHash = await sendViaBroadcaster(
    TXID_VERSION,
    {
      to: populateResult.transaction.to!,
      data: populateResult.transaction.data!,
    },
    broadcaster.railgunAddress,
    broadcaster.feesID,
    chain,
    nullifiers,
    overallBatchMinGasPrice,
    true, // useRelayAdapt
    populateResult.preTransactionPOIsPerTxidLeafPerList,
  );

  return { txHash };
}
