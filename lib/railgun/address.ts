/**
 * Lightweight RAILGUN 0zk address derivation.
 *
 * Uses the engine's key-derivation primitives directly — pure crypto,
 * NO engine initialization, NO IndexedDB, NO network calls.
 * This is used by the receive page to derive an address instantly.
 */
import {
  WalletNode,
  deriveNodes,
  encodeAddress,
} from "@railgun-community/engine/dist/key-derivation";
import { getBytes, Mnemonic } from "ethers";

/**
 * Derive a RAILGUN 0zk address from an Ethereum signature.
 *
 * Same deterministic derivation as `getOrCreateWallet` in wallet.ts,
 * but without needing the RAILGUN engine to be running.
 */
export async function deriveRailgunAddressLightweight(
  signature: string,
): Promise<string> {
  // 1. Derive mnemonic from signature entropy (same as wallet.ts)
  const entropy = getBytes(signature).slice(0, 16); // 128 bits → 12-word mnemonic
  const mnemonic = Mnemonic.fromEntropy(entropy).phrase;

  // 2. Derive spending and viewing nodes
  const { spending, viewing } = deriveNodes(mnemonic, 0);

  // 3. Get key pairs
  const { pubkey: spendingPublicKey } = spending.getSpendingKeyPair();
  const viewingKeyPair = await viewing.getViewingKeyPair();
  const nullifyingKey = await viewing.getNullifyingKey();

  // 4. Compute master public key
  const masterPublicKey = WalletNode.getMasterPublicKey(
    spendingPublicKey,
    nullifyingKey,
  );

  // 5. Encode as 0zk bech32m address (all-chain, no chain filter)
  return encodeAddress({
    masterPublicKey,
    viewingPublicKey: viewingKeyPair.pubkey,
  });
}
