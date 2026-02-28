import { NETWORK_CONFIG, NetworkName } from "@railgun-community/shared-models";
import { createRailgunWallet, loadWalletByID } from "@railgun-community/wallet";
import { getBytes, keccak256, Mnemonic } from "ethers";
import { ensureEngine } from "./init";
import type { RailgunWalletState } from "./types";

const STORAGE_KEY = "incogpay-railgun-wallet-id";
const SIGN_MESSAGE = "Generate my IncogPay RAILGUN wallet";

// ── in-memory cache for current session ───────────────────────────────────
let cachedState: RailgunWalletState | null = null;

export { SIGN_MESSAGE };

/**
 * Create or load a RAILGUN wallet from a wallet signature.
 * The same signature always produces the same deterministic wallet.
 */
export async function getOrCreateWallet(signature: string): Promise<RailgunWalletState> {
  if (cachedState) return cachedState;

  await ensureEngine();

  const encryptionKey = keccak256(getBytes(signature));

  // Check if we have a stored wallet ID from a previous session
  const storedId = localStorage.getItem(STORAGE_KEY);
  if (storedId) {
    try {
      const walletInfo = await loadWalletByID(encryptionKey, storedId, false);
      cachedState = {
        walletId: walletInfo.id,
        railgunAddress: walletInfo.railgunAddress,
        encryptionKey,
      };
      return cachedState;
    } catch {
      // Stored ID invalid or DB was cleared — fall through to create
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Derive deterministic mnemonic from signature
  // 128 bits of entropy → 12-word BIP-39 mnemonic
  const entropy = getBytes(signature).slice(0, 16);
  const mnemonic = Mnemonic.fromEntropy(entropy).phrase;

  // Use deployment blocks for faster initial sync.
  // MapType<number> is Partial<Record<string, number>>.
  const creationBlockNumbers: Partial<Record<string, number>> = {};
  for (const name of Object.values(NetworkName)) {
    const config = NETWORK_CONFIG[name as NetworkName];
    if (config?.deploymentBlock) {
      creationBlockNumbers[name] = config.deploymentBlock;
    }
  }

  const walletInfo = await createRailgunWallet(encryptionKey, mnemonic, creationBlockNumbers);

  localStorage.setItem(STORAGE_KEY, walletInfo.id);

  cachedState = {
    walletId: walletInfo.id,
    railgunAddress: walletInfo.railgunAddress,
    encryptionKey,
  };
  return cachedState;
}

/**
 * Get the cached wallet state (null if not yet created).
 */
export function getCachedWallet(): RailgunWalletState | null {
  return cachedState;
}

/**
 * Get just the RAILGUN 0zk address from a signature.
 * Convenience wrapper used by the receive flow.
 */
export async function deriveRailgunAddress(signature: string): Promise<string> {
  const state = await getOrCreateWallet(signature);
  return state.railgunAddress;
}
