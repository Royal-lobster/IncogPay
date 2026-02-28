import type {
  Chain,
  NetworkName,
  PreTransactionPOIsPerTxidLeafPerList,
  SelectedBroadcaster,
  TXIDVersion,
} from "@railgun-community/shared-models";
import { BroadcasterConnectionStatus, NETWORK_CONFIG } from "@railgun-community/shared-models";
import { calculateBroadcasterFeeERC20Amount } from "@railgun-community/wallet";
import type { BroadcasterInfo } from "./types";

// ── Lazy-loaded Waku module (heavy dependency, code-split) ──────────────

type WakuModule = typeof import("@railgun-community/waku-broadcaster-client-web");
let wakuModule: WakuModule | null = null;
let wakuStarted = false;

async function getWaku(): Promise<WakuModule> {
  if (!wakuModule) {
    wakuModule = await import("@railgun-community/waku-broadcaster-client-web");
  }
  return wakuModule;
}

// ── Public broadcaster fee signer (Railgun official) ─────────────────────
// This is the well-known address that signs broadcaster fee messages.
// Using an empty string disables trusted-signer filtering (accept all).
const TRUSTED_FEE_SIGNER = "";

/**
 * Start the Waku broadcaster client for a given network.
 * Idempotent — calling multiple times is a no-op after the first start.
 */
export async function initBroadcasters(networkName: NetworkName): Promise<void> {
  if (wakuStarted) return;
  const waku = await getWaku();
  const { chain } = NETWORK_CONFIG[networkName];

  const statusCallback = (_chain: Chain, status: BroadcasterConnectionStatus) => {
    if (status !== BroadcasterConnectionStatus.Connected) {
      console.log(`[IncogPay] Waku ${status}`);
    }
  };

  await waku.WakuBroadcasterClient.start(
    chain,
    { trustedFeeSigner: TRUSTED_FEE_SIGNER },
    statusCallback,
  );
  wakuStarted = true;
}

/**
 * Find the best available broadcaster for the given token on a network.
 */
export async function findBestBroadcaster(
  networkName: NetworkName,
  tokenAddress: string,
): Promise<BroadcasterInfo> {
  await initBroadcasters(networkName);
  const waku = await getWaku();
  const { chain } = NETWORK_CONFIG[networkName];

  // findBestBroadcaster is synchronous — returns Optional<SelectedBroadcaster>
  const selected: SelectedBroadcaster | undefined = waku.WakuBroadcasterClient.findBestBroadcaster(
    chain,
    tokenAddress,
    true,
  );

  if (!selected) {
    throw new Error("No broadcaster available for this token and network");
  }

  return {
    railgunAddress: selected.railgunAddress,
    tokenAddress: selected.tokenAddress,
    // CachedTokenFee.feePerUnitGas is a string in the SDK
    feePerUnitGas: BigInt(selected.tokenFee.feePerUnitGas),
    feesID: selected.tokenFee.feesID,
  };
}

/**
 * Create and send a transaction via the Waku broadcaster p2p network.
 *
 * @returns The on-chain transaction hash
 */
export async function sendViaBroadcaster(
  txidVersion: TXIDVersion,
  populatedTx: { to: string; data: string },
  broadcasterRailgunAddress: string,
  feesID: string,
  chain: Chain,
  nullifiers: string[],
  overallBatchMinGasPrice: bigint,
  useRelayAdapt: boolean,
  preTransactionPOIsPerTxidLeafPerList: PreTransactionPOIsPerTxidLeafPerList,
): Promise<string> {
  const waku = await getWaku();

  const broadcasterTx = await waku.BroadcasterTransaction.create(
    txidVersion,
    populatedTx.to,
    populatedTx.data,
    broadcasterRailgunAddress,
    feesID,
    chain,
    nullifiers,
    overallBatchMinGasPrice,
    useRelayAdapt,
    preTransactionPOIsPerTxidLeafPerList,
  );

  const txHash = await broadcasterTx.send();
  return txHash;
}

export { calculateBroadcasterFeeERC20Amount };
