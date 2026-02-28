# Railgun SDK Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all mock Railgun operations with real SDK calls — shield, PPOI polling, ZK proof generation, and broadcaster send — fully client-side.

**Architecture:** All Railgun logic lives in `lib/railgun/` as pure async functions. Step components call these functions through their existing `useMutation` hooks. Engine initializes lazily on first use with `level-js` (IndexedDB) for persistence. Wallet keys are derived from a deterministic wallet signature.

**Tech Stack:** `@railgun-community/wallet`, `@railgun-community/shared-models`, `@railgun-community/waku-broadcaster-client-web`, `level-js`, `wagmi`, `viem`

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install new packages**

```bash
pnpm add level-js @railgun-community/waku-broadcaster-client-web
```

**Step 2: Verify installation**

```bash
pnpm ls level-js @railgun-community/waku-broadcaster-client-web
```

Expected: Both packages listed with versions.

**Step 3: Verify build still works**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add level-js and waku-broadcaster-client-web dependencies"
```

---

## Task 2: Network Config (`lib/railgun/networks.ts`)

**Files:**
- Create: `lib/railgun/networks.ts`

**Step 1: Create the network mapping module**

This maps wagmi chain IDs to RAILGUN `NetworkName` enum values and exports shared constants.

```typescript
import { NetworkName, TXIDVersion } from "@railgun-community/shared-models";
import { arbitrum, bsc, mainnet, polygon } from "wagmi/chains";

export const TXID_VERSION = TXIDVersion.V2_PoseidonMerkle;

export const CHAIN_TO_NETWORK: Record<number, NetworkName> = {
  [arbitrum.id]: NetworkName.Arbitrum,
  [mainnet.id]: NetworkName.Ethereum,
  [polygon.id]: NetworkName.Polygon,
  [bsc.id]: NetworkName.BNBChain,
};

export function getNetworkName(chainId: number): NetworkName {
  const network = CHAIN_TO_NETWORK[chainId];
  if (!network) throw new Error(`Unsupported chain: ${chainId}`);
  return network;
}
```

**Step 2: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

Expected: No type errors.

**Step 3: Commit**

```bash
git add lib/railgun/networks.ts
git commit -m "feat(railgun): add network config mapping wagmi chains to RAILGUN NetworkName"
```

---

## Task 3: Shared Types (`lib/railgun/types.ts`)

**Files:**
- Create: `lib/railgun/types.ts`

**Step 1: Create types module**

```typescript
export interface RailgunWalletState {
  walletId: string;
  railgunAddress: string;
  encryptionKey: string;
}

export interface ShieldResult {
  txHash: string;
}

export interface SendResult {
  txHash: string;
}

export interface BroadcasterInfo {
  railgunAddress: string;
  tokenAddress: string;
  feePerUnitGas: bigint;
  feesID: string;
}
```

**Step 2: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

**Step 3: Commit**

```bash
git add lib/railgun/types.ts
git commit -m "feat(railgun): add shared types for wallet state, shield, send, broadcaster"
```

---

## Task 4: Engine Initialization (`lib/railgun/init.ts`)

**Files:**
- Create: `lib/railgun/init.ts`

This is the most critical module. It initializes the RAILGUN engine lazily and ensures it only runs once.

**Step 1: Create the init module**

```typescript
import type { ArtifactStore } from "@railgun-community/wallet";
import {
  startRailgunEngine,
  loadProvider,
} from "@railgun-community/wallet";
import {
  NetworkName,
  NETWORK_CONFIG,
} from "@railgun-community/shared-models";
import LevelDB from "level-js";

// ── singleton promise to ensure init runs exactly once ────────────────────
let initPromise: Promise<void> | null = null;

// ── artifact store (caches WASM proof files in IndexedDB) ─────────────────
function createArtifactStore(): ArtifactStore {
  const db = new LevelDB("incogpay-artifacts");

  return {
    getFile: async (path: string): Promise<string | Buffer | undefined> => {
      try {
        const data = await new Promise<Buffer>((resolve, reject) => {
          db.get(path, { asBuffer: true }, (err: Error | null, value: Buffer) => {
            if (err) reject(err);
            else resolve(value);
          });
        });
        return data;
      } catch {
        return undefined;
      }
    },
    storeFile: async (path: string, data: string | Buffer): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        db.put(path, data, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}

// ── POI node URLs (public RAILGUN aggregators) ────────────────────────────
const POI_NODES = [
  "https://poi-node.railgun.org",
];

// ── networks to load providers for ───────────────────────────────────────
const NETWORKS_TO_LOAD: { name: NetworkName; rpc: string }[] = [
  {
    name: NetworkName.Arbitrum,
    rpc: "https://arb1.arbitrum.io/rpc",
  },
  {
    name: NetworkName.Ethereum,
    rpc: "https://eth.llamarpc.com",
  },
  {
    name: NetworkName.Polygon,
    rpc: "https://polygon-rpc.com",
  },
  {
    name: NetworkName.BNBChain,
    rpc: "https://bsc-dataseed.binance.org",
  },
];

// ── public API ────────────────────────────────────────────────────────────
export async function ensureEngine(): Promise<void> {
  if (!initPromise) {
    initPromise = doInit();
  }
  return initPromise;
}

async function doInit(): Promise<void> {
  const db = new LevelDB("incogpay-engine");
  const artifactStore = createArtifactStore();

  await startRailgunEngine(
    "incogpay",       // walletSource (max 16 chars, lowercase)
    db,               // LevelDOWN-compatible database
    false,            // shouldDebug (off in prod)
    artifactStore,    // persistent artifact storage
    false,            // useNativeArtifacts (false for browser/WASM)
    false,            // skipMerkletreeScans
    POI_NODES,        // PPOI aggregator nodes
  );

  // Load providers for all chains in parallel
  await Promise.all(
    NETWORKS_TO_LOAD.map(({ name, rpc }) => {
      const { chain } = NETWORK_CONFIG[name];
      return loadProvider(
        {
          chainId: chain.id,
          providers: [{ provider: rpc, priority: 1, weight: 1 }],
        },
        name,
        false, // pollingInterval — use default
      );
    }),
  );
}
```

**Step 2: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

Note: There may be type mismatches with the exact `loadProvider` signature. The implementer should check `node_modules/@railgun-community/wallet/dist/services/railgun/core/load-provider.d.ts` for the exact signature and adjust accordingly. The key parameters are the fallback provider config, network name, and polling interval.

**Step 3: Commit**

```bash
git add lib/railgun/init.ts
git commit -m "feat(railgun): add lazy engine initialization with level-js and artifact store"
```

---

## Task 5: Wallet Derivation (`lib/railgun/wallet.ts`)

**Files:**
- Create: `lib/railgun/wallet.ts`

**Step 1: Create the wallet module**

```typescript
import {
  createRailgunWallet,
  loadWalletByID,
} from "@railgun-community/wallet";
import { NETWORK_CONFIG, NetworkName } from "@railgun-community/shared-models";
import { keccak256, toBytes, Mnemonic } from "ethers";
import { ensureEngine } from "./init";
import type { RailgunWalletState } from "./types";

const STORAGE_KEY = "incogpay-railgun-wallet-id";
const SIGN_MESSAGE = "Generate my IncogPay RAILGUN wallet";

// ── in-memory cache for current session ───────────────────────────────────
let cachedState: RailgunWalletState | null = null;

export { SIGN_MESSAGE };

/**
 * Create or load a RAILGUN wallet from a wallet signature.
 * Same signature always produces the same wallet.
 */
export async function getOrCreateWallet(
  signature: string,
): Promise<RailgunWalletState> {
  if (cachedState) return cachedState;

  await ensureEngine();

  const encryptionKey = keccak256(toBytes(signature));

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
      // Stored ID invalid — fall through to create new wallet
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Derive deterministic mnemonic from signature
  const entropy = toBytes(signature).slice(0, 16); // 128 bits → 12-word mnemonic
  const mnemonic = Mnemonic.fromEntropy(entropy).phrase;

  // Use deployment blocks for faster initial sync
  const creationBlockNumbers: Partial<Record<NetworkName, number>> = {};
  for (const name of Object.values(NetworkName)) {
    const config = NETWORK_CONFIG[name];
    if (config?.deploymentBlock) {
      creationBlockNumbers[name] = config.deploymentBlock;
    }
  }

  const walletInfo = await createRailgunWallet(
    encryptionKey,
    mnemonic,
    creationBlockNumbers,
  );

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
export async function deriveRailgunAddress(
  signature: string,
): Promise<string> {
  const state = await getOrCreateWallet(signature);
  return state.railgunAddress;
}
```

**Step 2: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

Note: `ethers` is a transitive dependency via `@railgun-community/wallet`. If the import doesn't resolve, the implementer should check `node_modules/@railgun-community/wallet/node_modules/ethers` or use `viem`'s `keccak256` + a different mnemonic approach. Adjust imports accordingly.

**Step 3: Commit**

```bash
git add lib/railgun/wallet.ts
git commit -m "feat(railgun): add wallet derivation from signature with localStorage persistence"
```

---

## Task 6: Shield Flow (`lib/railgun/shield.ts`)

**Files:**
- Create: `lib/railgun/shield.ts`

**Step 1: Create the shield module**

```typescript
import {
  gasEstimateForShield,
  getShieldPrivateKeySignatureMessage,
  populateShield,
} from "@railgun-community/wallet";
import type { RailgunERC20AmountRecipient } from "@railgun-community/shared-models";
import { keccak256, toBytes } from "ethers";
import { ensureEngine } from "./init";
import { getNetworkName, TXID_VERSION } from "./networks";
import type { ShieldResult } from "./types";

/**
 * Returns the message the user must sign to generate the shield private key.
 */
export function getShieldSignMessage(): string {
  return getShieldPrivateKeySignatureMessage();
}

/**
 * Populate a shield transaction for the given token and amount.
 *
 * @param chainId - wagmi chain ID
 * @param shieldSignature - user's signature of getShieldSignMessage()
 * @param tokenAddress - ERC20 token contract address
 * @param amount - amount in token's smallest unit (bigint)
 * @param railgunAddress - recipient's RAILGUN 0zk address
 * @returns populated transaction object ready to send via wagmi
 */
export async function populateShieldTx(
  chainId: number,
  shieldSignature: string,
  tokenAddress: string,
  amount: bigint,
  railgunAddress: string,
) {
  await ensureEngine();

  const networkName = getNetworkName(chainId);
  const shieldPrivateKey = keccak256(toBytes(shieldSignature));

  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
    {
      tokenAddress,
      amount,
      recipientAddress: railgunAddress,
    },
  ];

  // Gas estimate
  const gasEstimate = await gasEstimateForShield(
    TXID_VERSION,
    networkName,
    shieldPrivateKey,
    erc20AmountRecipients,
    [], // no NFTs
    railgunAddress, // fromWalletAddress (public wallet)
  );

  // Populate the transaction
  const { transaction } = await populateShield(
    TXID_VERSION,
    networkName,
    shieldPrivateKey,
    erc20AmountRecipients,
    [], // no NFTs
    { gasLimit: gasEstimate.gasEstimate },
  );

  return { transaction, gasEstimate: gasEstimate.gasEstimate };
}
```

**Step 2: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

Note: The exact parameter order and names for `gasEstimateForShield` and `populateShield` should be verified against the SDK's `.d.ts` files at `node_modules/@railgun-community/wallet/dist/`. The implementer must check and adjust if the type checker complains.

**Step 3: Commit**

```bash
git add lib/railgun/shield.ts
git commit -m "feat(railgun): add shield transaction population with gas estimation"
```

---

## Task 7: PPOI Polling (`lib/railgun/poi.ts`)

**Files:**
- Create: `lib/railgun/poi.ts`

**Step 1: Create the POI polling module**

```typescript
import {
  refreshBalances,
  getWalletTransactionHistory,
} from "@railgun-community/wallet";
import { NETWORK_CONFIG } from "@railgun-community/shared-models";
import { ensureEngine } from "./init";
import { getNetworkName, TXID_VERSION } from "./networks";

/**
 * Poll until the shielded funds are spendable (PPOI verified).
 *
 * @param chainId - wagmi chain ID
 * @param walletId - RAILGUN wallet ID
 * @param onProgress - optional callback for status updates
 * @param pollIntervalMs - how often to check (default 30s)
 * @param signal - AbortSignal to cancel polling
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

    // Trigger a balance refresh / merkletree scan
    await refreshBalances(chain, [walletId]).catch(() => {
      // Scan may fail transiently — retry on next poll
    });

    // Check if we have spendable balances
    // The SDK marks UTXOs as spendable once PPOI is verified
    const balances = await getWalletTransactionHistory(
      chain,
      walletId,
      undefined, // startingBlock
    ).catch(() => null);

    // If we have transaction history entries, the shield has been picked up
    // and PPOI verification is complete when the balance is spendable
    if (balances && balances.length > 0) {
      onProgress?.("Privacy verification complete");
      return;
    }

    onProgress?.("Waiting for privacy verification...");

    // Wait before next poll
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, pollIntervalMs);
      signal?.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });
  }

  throw new DOMException("Aborted", "AbortError");
}
```

**Step 2: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

Note: The exact approach for checking "spendable" status depends on which SDK functions are available. The implementer should check `refreshBalances` and wallet balance APIs in `node_modules/@railgun-community/wallet/dist/services/railgun/wallets/`. The core idea is: poll `refreshBalances` → check if the shielded UTXO is marked spendable. Adjust the specific function calls based on what the SDK exposes.

**Step 3: Commit**

```bash
git add lib/railgun/poi.ts
git commit -m "feat(railgun): add PPOI polling to wait for spendable shielded funds"
```

---

## Task 8: Broadcaster Integration (`lib/railgun/broadcaster.ts`)

**Files:**
- Create: `lib/railgun/broadcaster.ts`

**Step 1: Create the broadcaster module**

```typescript
import { NETWORK_CONFIG } from "@railgun-community/shared-models";
import type { NetworkName } from "@railgun-community/shared-models";
import { calculateBroadcasterFeeERC20Amount } from "@railgun-community/wallet";
import type { BroadcasterInfo } from "./types";

// Dynamic import for the Waku broadcaster client (heavy WASM module)
let wakuModule: typeof import("@railgun-community/waku-broadcaster-client-web") | null = null;
let wakuStarted = false;

async function getWaku() {
  if (!wakuModule) {
    wakuModule = await import("@railgun-community/waku-broadcaster-client-web");
  }
  return wakuModule;
}

/**
 * Initialize the Waku broadcaster client for a given network.
 * Must be called before findBestBroadcaster.
 */
export async function initBroadcasters(networkName: NetworkName): Promise<void> {
  if (wakuStarted) return;

  const waku = await getWaku();
  const { chain } = NETWORK_CONFIG[networkName];

  const statusCallback = (_chain: unknown, status: string) => {
    if (status !== "Connected") {
      console.log(`[IncogPay] Waku ${status}`);
    }
  };

  await waku.WakuBroadcasterClient.start(chain, {}, statusCallback);
  wakuStarted = true;
}

/**
 * Find the best available broadcaster for a token on a network.
 */
export async function findBestBroadcaster(
  networkName: NetworkName,
  tokenAddress: string,
): Promise<BroadcasterInfo> {
  await initBroadcasters(networkName);

  const waku = await getWaku();
  const { chain } = NETWORK_CONFIG[networkName];

  const selected = await waku.WakuBroadcasterClient.findBestBroadcaster(
    chain,
    tokenAddress,
    true, // useRelayAdapt
  );

  if (!selected) {
    throw new Error("No broadcaster available for this token and network");
  }

  return {
    railgunAddress: selected.railgunAddress,
    tokenAddress: selected.tokenAddress,
    feePerUnitGas: BigInt(selected.tokenFee.feePerUnitGas),
    feesID: selected.tokenFee.feesID,
  };
}

/**
 * Send a populated transaction via a broadcaster.
 * Returns the transaction hash.
 */
export async function sendViaBroadcaster(
  populatedTx: { to: string; data: string },
  broadcasterRailgunAddress: string,
  feesID: string,
  chainId: number,
  networkName: NetworkName,
  nullifiers: string[],
  overallBatchMinGasPrice: bigint,
  useRelayAdapt: boolean,
): Promise<string> {
  const waku = await getWaku();
  const { chain } = NETWORK_CONFIG[networkName];

  const broadcasterTx = await waku.BroadcasterTransaction.create(
    populatedTx.to,
    populatedTx.data,
    broadcasterRailgunAddress,
    feesID,
    chain,
    nullifiers,
    overallBatchMinGasPrice,
    useRelayAdapt,
  );

  const txHash = await broadcasterTx.send();
  return txHash;
}

export { calculateBroadcasterFeeERC20Amount };
```

**Step 2: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

Note: The exact types and method signatures for `WakuBroadcasterClient` and `BroadcasterTransaction` should be verified against the `@railgun-community/waku-broadcaster-client-web` package. The implementer should check its `.d.ts` exports and adjust.

**Step 3: Commit**

```bash
git add lib/railgun/broadcaster.ts
git commit -m "feat(railgun): add broadcaster integration with Waku p2p client"
```

---

## Task 9: Transfer / Unshield (`lib/railgun/transfer.ts`)

**Files:**
- Create: `lib/railgun/transfer.ts`

**Step 1: Create the transfer module**

```typescript
import {
  generateUnshieldProof,
  populateProvedUnshield,
  gasEstimateForUnprovenUnshield,
} from "@railgun-community/wallet";
import type {
  RailgunERC20AmountRecipient,
  FeeTokenDetails,
} from "@railgun-community/shared-models";
import { ensureEngine } from "./init";
import { getNetworkName, TXID_VERSION } from "./networks";
import {
  findBestBroadcaster,
  sendViaBroadcaster,
} from "./broadcaster";
import type { SendResult } from "./types";

/**
 * Full private send flow:
 * 1. Find best broadcaster
 * 2. Estimate gas
 * 3. Generate ZK proof (with progress callback)
 * 4. Populate proved transaction
 * 5. Submit via broadcaster
 */
export async function privateSend(
  chainId: number,
  walletId: string,
  encryptionKey: string,
  tokenAddress: string,
  amount: bigint,
  recipientAddress: string, // public 0x address
  onProgress?: (phase: string, pct?: number) => void,
): Promise<SendResult> {
  await ensureEngine();

  const networkName = getNetworkName(chainId);

  // 1. Find best broadcaster
  onProgress?.("Finding best relayer...");
  const broadcaster = await findBestBroadcaster(networkName, tokenAddress);

  const feeTokenDetails: FeeTokenDetails = {
    tokenAddress: broadcaster.tokenAddress,
    feePerUnitGas: broadcaster.feePerUnitGas,
  };

  const broadcasterFeeRecipient: RailgunERC20AmountRecipient = {
    tokenAddress: broadcaster.tokenAddress,
    amount: 0n, // calculated by SDK
    recipientAddress: broadcaster.railgunAddress,
  };

  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
    {
      tokenAddress,
      amount,
      recipientAddress,
    },
  ];

  // 2. Estimate gas
  onProgress?.("Estimating gas...");
  const gasEstimate = await gasEstimateForUnprovenUnshield(
    TXID_VERSION,
    networkName,
    walletId,
    encryptionKey,
    erc20AmountRecipients,
    [], // no NFTs
    broadcasterFeeRecipient,
    false, // sendWithPublicWallet = false (using broadcaster)
    0n,    // overallBatchMinGasPrice
  );

  const overallBatchMinGasPrice = gasEstimate.gasEstimate ?? 0n;

  // 3. Generate ZK proof
  onProgress?.("Generating proof...", 0);
  const progressCallback = (progress: number) => {
    onProgress?.("Generating proof...", Math.round(progress * 100));
  };

  await generateUnshieldProof(
    TXID_VERSION,
    networkName,
    walletId,
    encryptionKey,
    erc20AmountRecipients,
    [], // no NFTs
    broadcasterFeeRecipient,
    false, // sendWithPublicWallet
    overallBatchMinGasPrice,
    progressCallback,
  );

  // 4. Populate proved transaction
  onProgress?.("Preparing transaction...");
  const populateResult = await populateProvedUnshield(
    TXID_VERSION,
    networkName,
    walletId,
    erc20AmountRecipients,
    [], // no NFTs
    broadcasterFeeRecipient,
    false, // sendWithPublicWallet
    overallBatchMinGasPrice,
    { gasLimit: gasEstimate.gasEstimate },
  );

  // 5. Submit via broadcaster
  onProgress?.("Broadcasting...");
  const nullifiers = populateResult.nullifiers ?? [];

  const txHash = await sendViaBroadcaster(
    {
      to: populateResult.transaction.to!,
      data: populateResult.transaction.data!,
    },
    broadcaster.railgunAddress,
    broadcaster.feesID,
    chainId,
    networkName,
    nullifiers,
    overallBatchMinGasPrice,
    true, // useRelayAdapt
  );

  return { txHash };
}
```

**Step 2: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

Note: The exact parameter signatures for `gasEstimateForUnprovenUnshield`, `generateUnshieldProof`, and `populateProvedUnshield` must be verified against the SDK `.d.ts` files. The implementer should check `node_modules/@railgun-community/wallet/dist/` and adjust parameter order/types. The overall flow is correct.

**Step 3: Commit**

```bash
git add lib/railgun/transfer.ts
git commit -m "feat(railgun): add private send flow with proof generation and broadcaster"
```

---

## Task 10: Barrel Export (`lib/railgun/index.ts`)

**Files:**
- Create: `lib/railgun/index.ts`

**Step 1: Create barrel export**

```typescript
export { ensureEngine } from "./init";
export {
  getOrCreateWallet,
  getCachedWallet,
  deriveRailgunAddress,
  SIGN_MESSAGE,
} from "./wallet";
export { getShieldSignMessage, populateShieldTx } from "./shield";
export { waitForSpendable } from "./poi";
export { privateSend } from "./transfer";
export { getNetworkName, TXID_VERSION, CHAIN_TO_NETWORK } from "./networks";
export type {
  RailgunWalletState,
  ShieldResult,
  SendResult,
  BroadcasterInfo,
} from "./types";
```

**Step 2: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

**Step 3: Commit**

```bash
git add lib/railgun/index.ts
git commit -m "feat(railgun): add barrel export for railgun module"
```

---

## Task 11: Chain Switching Hook (`hooks/useEnsureCorrectChain.ts`)

**Files:**
- Create: `hooks/useEnsureCorrectChain.ts`

**Step 1: Create the hook**

```typescript
import { useAccount, useSwitchChain } from "wagmi";
import type { config } from "@/lib/wagmi";

type SupportedChainId = (typeof config)["chains"][number]["id"];

export const useEnsureCorrectChain = (chainId: SupportedChainId) => {
  const { chain } = useAccount();
  const { switchChainAsync, chains } = useSwitchChain();

  const ensureCorrectChain = async () => {
    if (chain?.id !== chainId) {
      const targetChain = chains.find((c) => c.id === chainId);
      if (!targetChain) {
        throw new Error("Target chain not supported by wallet");
      }
      await switchChainAsync({ chainId });
    }
  };

  return { ensureCorrectChain };
};
```

**Step 2: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

**Step 3: Commit**

```bash
git add hooks/useEnsureCorrectChain.ts
git commit -m "feat: add useEnsureCorrectChain hook for auto chain switching"
```

---

## Task 12: Wire Receive Page — Real Address Derivation

**Files:**
- Modify: `app/receive/page.tsx:35-38` (replace `deriveShieldedAddress`)
- Modify: `app/receive/page.tsx:85-100` (update `generateMutation`)

**Step 1: Replace the mock `deriveShieldedAddress` function**

In `app/receive/page.tsx`, replace lines 35-38:

```typescript
// OLD:
function deriveShieldedAddress(sig: string): string {
  const hash = sig.slice(2, 42);
  return `0zk1qy${hash.slice(0, 8)}...${hash.slice(-8)}demo`;
}
```

With an import at the top of the file (after existing imports):

```typescript
import { deriveRailgunAddress } from "@/lib/railgun";
```

And remove the `deriveShieldedAddress` function entirely.

**Step 2: Update the mutation to use real derivation**

Replace the `generateMutation` (lines 85-100):

```typescript
// OLD:
const generateMutation = useMutation({
  mutationFn: async () => {
    stepper.navigation.goTo("signing");
    const sig = await signMessageAsync({
      message: "Generate my IncogPay shielded receive address",
    });
    return deriveShieldedAddress(sig);
  },
  // ...
});
```

With:

```typescript
const generateMutation = useMutation({
  mutationFn: async () => {
    stepper.navigation.goTo("signing");
    const sig = await signMessageAsync({
      message: "Generate my IncogPay RAILGUN wallet",
    });
    return deriveRailgunAddress(sig);
  },
  onSuccess: (addr) => {
    setShieldedAddr(addr);
    stepper.navigation.goTo("ready");
  },
  onError: () => {
    stepper.navigation.goTo("idle");
  },
});
```

**Step 3: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

**Step 4: Commit**

```bash
git add app/receive/page.tsx
git commit -m "feat: wire receive page to real RAILGUN address derivation"
```

---

## Task 13: Wire Send Page — Shield Mutation

**Files:**
- Modify: `app/send/page.tsx:179-192` (replace mock shield mutation)

This is the most involved UI wiring task. The send page's `shieldMutation` currently uses `setTimeout` mocks. We replace it with real SDK calls.

**Step 1: Add imports**

Add at the top of `app/send/page.tsx` (after existing imports):

```typescript
import { useSignMessage, useSendTransaction } from "wagmi";
import { parseUnits, erc20Abi } from "viem";
import { useWriteContract } from "wagmi";
import {
  getOrCreateWallet,
  getShieldSignMessage,
  populateShieldTx,
  SIGN_MESSAGE,
} from "@/lib/railgun";
import { useEnsureCorrectChain } from "@/hooks/useEnsureCorrectChain";
```

Note: `useSignMessage` may already be imported. The implementer should merge imports, not duplicate.

**Step 2: Add hooks inside the component**

Inside `SendPage()`, after the existing form setup, add:

```typescript
const { signMessageAsync } = useSignMessage();
const { writeContractAsync } = useWriteContract();
const { sendTransactionAsync } = useSendTransaction();
```

**Step 3: Replace the shield mutation**

Replace lines 179-192 (the `shieldMutation`):

```typescript
const shieldMutation = useMutation({
  mutationFn: async () => {
    if (!intent || !address) throw new Error("Missing intent or wallet");

    const chainId = formChain.id;
    const tokenInfo = TOKENS_BY_CHAIN[chainId].find(
      (t) => t.symbol === intent.token,
    );
    if (!tokenInfo) throw new Error("Token not found");

    // 1. Ensure correct chain
    setShieldSubPhase("approving");
    // (ensureCorrectChain would be called here if using the hook)

    // 2. Sign message to derive RAILGUN wallet
    const walletSig = await signMessageAsync({ message: SIGN_MESSAGE });
    const wallet = await getOrCreateWallet(walletSig);

    // 3. Sign shield private key message
    const shieldMsg = getShieldSignMessage();
    const shieldSig = await signMessageAsync({ message: shieldMsg });

    // 4. Approve ERC20
    const amount = parseUnits(intent.amount, tokenInfo.decimals);
    await writeContractAsync({
      address: tokenInfo.address as `0x${string}`,
      abi: erc20Abi,
      functionName: "approve",
      // The RAILGUN contract address is handled internally by populateShieldTx
      // We need to approve the RAILGUN proxy contract — get address from SDK
      args: [
        // TODO: Get the RAILGUN contract address for this chain from NETWORK_CONFIG
        "0x..." as `0x${string}`,
        amount,
      ],
    });

    // 5. Populate and send shield transaction
    setShieldSubPhase("shielding");
    const { transaction } = await populateShieldTx(
      chainId,
      shieldSig,
      tokenInfo.address,
      amount,
      wallet.railgunAddress,
    );

    const txHash = await sendTransactionAsync({
      to: transaction.to as `0x${string}`,
      data: transaction.data as `0x${string}`,
      value: transaction.value ? BigInt(transaction.value.toString()) : 0n,
    });

    return { txHash };
  },
  onSuccess: ({ txHash: hash }) => {
    setTxHash(hash);
    setMixingStartedAt(Date.now());
    stepper.navigation.goTo("mixing");
  },
});
```

Note: The RAILGUN proxy contract address for ERC20 approval needs to come from `NETWORK_CONFIG[networkName].proxyContract` or equivalent. The implementer must look up the exact field in `@railgun-community/shared-models`'s `NETWORK_CONFIG` to get the contract address that tokens should be approved for. This is a critical detail.

**Step 4: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

**Step 5: Commit**

```bash
git add app/send/page.tsx
git commit -m "feat: wire shield mutation to real RAILGUN SDK calls"
```

---

## Task 14: Wire Send Page — PPOI Polling (Replace Timer)

**Files:**
- Modify: `app/send/page.tsx:194-211` (replace mixing timer)

**Step 1: Replace the mixing timer effect**

Replace the mixing timer effect (lines 195-211):

```typescript
// OLD:
const [mixingElapsed, setMixingElapsed] = useState(0);
useEffect(() => {
  if (phase !== "mixing" || !mixingStartedAt) return;
  const id = setInterval(() => { ... }, 1000);
  return () => clearInterval(id);
}, [phase, mixingStartedAt]);
```

With:

```typescript
import { waitForSpendable, getCachedWallet } from "@/lib/railgun";

// ... inside the component:

const [poiStatus, setPoiStatus] = useState<string>("Waiting for privacy verification...");

useEffect(() => {
  if (phase !== "mixing") return;

  const wallet = getCachedWallet();
  if (!wallet) return;

  const abortController = new AbortController();

  waitForSpendable(
    formChain.id,
    wallet.walletId,
    (status) => setPoiStatus(status),
    30_000,
    abortController.signal,
  )
    .then(() => {
      stepper.navigation.goTo("send");
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        console.error("PPOI polling failed:", err);
      }
    });

  return () => abortController.abort();
}, [phase]);
```

**Step 2: Update the mixing UI section**

In the mixing phase JSX (around line 602-618), replace the progress bar with a status indicator:

Replace the progress bar div with:

```tsx
<div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
  <div className="flex items-center gap-3">
    <CircleNotch size={16} className="animate-spin text-pink-400 shrink-0" />
    <div>
      <p className="text-sm text-zinc-300">{poiStatus}</p>
      <p className="text-xs text-zinc-600 mt-0.5">
        This typically takes a few minutes
      </p>
    </div>
  </div>
</div>
```

**Step 3: Remove unused mixing timer state**

Remove these lines since they're no longer needed:
- `const MIXING_MS = 60 * 60 * 1000;` (line 82)
- `const [mixingElapsed, setMixingElapsed] = useState(0);` (line 195)
- `const mixingPct = ...` (line 210)
- `const mixingRemaining = ...` (line 211)
- `fmtMs` function (line 120-123) if no longer used

**Step 4: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

**Step 5: Commit**

```bash
git add app/send/page.tsx
git commit -m "feat: replace mixing countdown timer with real PPOI polling"
```

---

## Task 15: Wire Send Page — Send Mutation (Real Proof + Broadcaster)

**Files:**
- Modify: `app/send/page.tsx:218-228` (replace mock send mutation)

**Step 1: Replace the send mutation**

Replace lines 218-228:

```typescript
const [proofProgress, setProofProgress] = useState(0);

const sendMutation = useMutation({
  mutationFn: async () => {
    if (!intent) throw new Error("No intent");

    const wallet = getCachedWallet();
    if (!wallet) throw new Error("RAILGUN wallet not initialized");

    const tokenInfo = TOKENS_BY_CHAIN[formChain.id].find(
      (t) => t.symbol === intent.token,
    );
    if (!tokenInfo) throw new Error("Token not found");

    const amount = parseUnits(sendAmount, tokenInfo.decimals);

    const result = await privateSend(
      formChain.id,
      wallet.walletId,
      wallet.encryptionKey,
      tokenInfo.address,
      amount,
      recipient,
      (phase, pct) => {
        if (phase.includes("proof")) {
          setSendSubLabel("proving");
          setProofProgress(pct ?? 0);
        } else if (phase.includes("Broadcasting")) {
          setSendSubLabel("broadcasting");
        }
      },
    );

    return result;
  },
  onSuccess: () => {
    setTimeout(() => stepper.navigation.goTo("done"), 600);
  },
});
```

Add import at the top:

```typescript
import { privateSend } from "@/lib/railgun";
```

**Step 2: Update proof progress in the UI**

Replace the proof progress text (around line 813-817):

```tsx
{sendMutation.isPending && sendSubLabel === "proving" && (
  <p className="text-center text-[11px] text-zinc-600 mt-1.5">
    Generating ZK proof… {proofProgress}%
  </p>
)}
```

**Step 3: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```

**Step 4: Commit**

```bash
git add app/send/page.tsx
git commit -m "feat: wire send mutation to real ZK proof generation and broadcaster"
```

---

## Task 16: Build Verification & Cleanup

**Files:**
- All modified files

**Step 1: Run type checker**

```bash
pnpm exec tsc --noEmit
```

Fix any remaining type errors.

**Step 2: Run linter**

```bash
pnpm run lint
```

Fix any lint issues.

**Step 3: Run build**

```bash
pnpm build
```

Fix any build errors. Note: The Railgun SDK uses Node.js APIs and WASM. The Next.js build may need `webpack` config to handle WASM or polyfill Node modules. If build fails with missing polyfills, update `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
```

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build issues with Railgun SDK integration"
```

---

## Task 17: Remove Legacy Step Components

**Files:**
- Evaluate: `components/steps/ShieldStep.tsx`
- Evaluate: `components/steps/MixingStep.tsx`
- Evaluate: `components/steps/SendStep.tsx`
- Evaluate: `components/SendForm.tsx`
- Evaluate: `components/SendStepper.tsx`

**Step 1: Check if any component is still imported anywhere**

```bash
grep -r "ShieldStep\|MixingStep\|SendStep\|SendForm\|SendStepper" --include="*.tsx" --include="*.ts" app/ components/ lib/
```

If any of these components are no longer imported (because all logic now lives inline in `app/send/page.tsx`), delete them.

**Step 2: Delete unused components**

Only delete files confirmed unused in step 1.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused legacy step components"
```

---

## Summary

| Task | Module | Description |
|------|--------|-------------|
| 1 | deps | Install `level-js` + `waku-broadcaster-client-web` |
| 2 | `lib/railgun/networks.ts` | Chain ID → NetworkName mapping |
| 3 | `lib/railgun/types.ts` | Shared types |
| 4 | `lib/railgun/init.ts` | Lazy engine init with IndexedDB |
| 5 | `lib/railgun/wallet.ts` | Signature-derived wallet creation |
| 6 | `lib/railgun/shield.ts` | ERC20 approve + shield tx |
| 7 | `lib/railgun/poi.ts` | PPOI spendability polling |
| 8 | `lib/railgun/broadcaster.ts` | Waku broadcaster integration |
| 9 | `lib/railgun/transfer.ts` | ZK proof + broadcaster send |
| 10 | `lib/railgun/index.ts` | Barrel export |
| 11 | `hooks/useEnsureCorrectChain.ts` | Chain switching hook |
| 12 | `app/receive/page.tsx` | Real address derivation |
| 13 | `app/send/page.tsx` | Real shield mutation |
| 14 | `app/send/page.tsx` | Real PPOI polling |
| 15 | `app/send/page.tsx` | Real send mutation |
| 16 | all | Build verification + fixes |
| 17 | cleanup | Remove unused legacy components |
