import type {
  EVMGasType,
  RailgunERC20AmountRecipient,
  TransactionGasDetails,
} from "@railgun-community/shared-models";
import {
  gasEstimateForShield,
  getShieldPrivateKeySignatureMessage,
  populateShield,
} from "@railgun-community/wallet";
import { getBytes, keccak256 } from "ethers";
import { ensureProvider } from "./init";
import { getNetworkName, TXID_VERSION } from "./networks";

/**
 * Returns the message that must be signed by the user's wallet
 * to derive the shield private key used for shielding tokens.
 */
export function getShieldSignMessage(): string {
  return getShieldPrivateKeySignatureMessage();
}

/**
 * Populate a shield transaction that moves ERC-20 tokens from a public
 * wallet into the RAILGUN privacy system.
 *
 * @param chainId        - EVM chain id (e.g. 42161 for Arbitrum)
 * @param shieldSignature - Wallet signature of `getShieldSignMessage()`
 * @param tokenAddress   - ERC-20 token contract address
 * @param amount         - Amount in base units (bigint)
 * @param railgunAddress - Recipient 0zk RAILGUN address
 * @param fromWalletAddress - The public EOA address sending the shield tx
 */
export async function populateShieldTx(
  chainId: number,
  shieldSignature: string,
  tokenAddress: string,
  amount: bigint,
  railgunAddress: string,
  fromWalletAddress: string,
) {
  const networkName = getNetworkName(chainId);
  await ensureProvider(networkName);
  const shieldPrivateKey = keccak256(getBytes(shieldSignature));

  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
    { tokenAddress, amount, recipientAddress: railgunAddress },
  ];

  // Estimate gas for the shield transaction
  const gasEstimate = await gasEstimateForShield(
    TXID_VERSION,
    networkName,
    shieldPrivateKey,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    fromWalletAddress,
  );

  // Build gas details — use Type0 (gasPrice-based) as a safe default.
  // The caller can override with EIP-1559 gas details if desired.
  const gasDetails: TransactionGasDetails = {
    evmGasType: 0 as EVMGasType.Type0,
    gasEstimate: gasEstimate.gasEstimate,
    gasPrice: gasEstimate.gasEstimate, // placeholder — caller should set actual gas price
  };

  const { transaction } = await populateShield(
    TXID_VERSION,
    networkName,
    shieldPrivateKey,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    gasDetails,
  );

  return { transaction, gasEstimate: gasEstimate.gasEstimate };
}
