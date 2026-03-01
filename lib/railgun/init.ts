import { NETWORK_CONFIG, NetworkName } from "@railgun-community/shared-models";
import { ArtifactStore, loadProvider, startRailgunEngine } from "@railgun-community/wallet";

// level-js has no TypeScript declarations — import as untyped and cast.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LevelDB = require("level-js") as new (
  name: string,
) => import("abstract-leveldown").AbstractLevelDOWN;

// ── singleton promises ────────────────────────────────────────────────────
let initPromise: Promise<void> | null = null;
const loadedProviders = new Set<NetworkName>();

// ── artifact store (caches WASM proof files in IndexedDB via level-js) ────
function createArtifactStore(): ArtifactStore {
  const db = new LevelDB("incogpay-artifacts");

  const get = async (path: string): Promise<string | Buffer | null> => {
    try {
      const data = await new Promise<Buffer>((resolve, reject) => {
        db.get(path, { asBuffer: true }, (err: Error | undefined, value: Buffer) => {
          if (err) reject(err);
          else resolve(value);
        });
      });
      return data;
    } catch {
      return null;
    }
  };

  const store = async (_dir: string, path: string, item: string | Uint8Array): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      db.put(path, item, (err: Error | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  const exists = async (path: string): Promise<boolean> => {
    try {
      await new Promise<Buffer>((resolve, reject) => {
        db.get(path, { asBuffer: true }, (err: Error | undefined, value: Buffer) => {
          if (err) reject(err);
          else resolve(value);
        });
      });
      return true;
    } catch {
      return false;
    }
  };

  return new ArtifactStore(get, store, exists);
}

// ── POI node URLs (public RAILGUN aggregators) ────────────────────────────
const POI_NODES = ["https://ppoi-agg.horsewithsixlegs.xyz"];

// ── RPC endpoints per network (CORS-friendly, browser-compatible) ────────
// Multiple fallbacks per chain — the RAILGUN SDK tries them in priority order.
const NETWORK_RPCS: Record<NetworkName, string[]> = {
  [NetworkName.Arbitrum]: [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum.llamarpc.com",
    "https://1rpc.io/arb",
    "https://rpc.ankr.com/arbitrum",
  ],
  [NetworkName.Ethereum]: [
    "https://eth.llamarpc.com",
    "https://1rpc.io/eth",
    "https://rpc.ankr.com/eth",
    "https://ethereum-rpc.publicnode.com",
  ],
  [NetworkName.Polygon]: [
    "https://polygon.llamarpc.com",
    "https://polygon-rpc.com",
    "https://1rpc.io/matic",
    "https://rpc.ankr.com/polygon",
  ],
  [NetworkName.BNBChain]: [
    "https://bsc-dataseed.binance.org",
    "https://bsc-dataseed1.defibit.io",
    "https://1rpc.io/bnb",
    "https://rpc.ankr.com/bsc",
  ],
} as Record<NetworkName, string[]>;

// ── public API ────────────────────────────────────────────────────────────

/**
 * Lazily initialise the RAILGUN engine (no provider loading).
 * Safe to call from any module; the engine is started exactly once.
 */
export async function ensureEngine(): Promise<void> {
  if (!initPromise) {
    initPromise = doInit();
  }
  return initPromise;
}

/**
 * Ensure the provider for a specific network is loaded.
 * Call this before any operation that needs on-chain data for a specific chain.
 * Lazy — only loads the requested chain, not all chains.
 */
export async function ensureProvider(networkName: NetworkName): Promise<void> {
  await ensureEngine();

  if (loadedProviders.has(networkName)) return;

  const rpcs = NETWORK_RPCS[networkName];
  if (!rpcs || rpcs.length === 0) throw new Error(`No RPC configured for ${networkName}`);

  const { chain } = NETWORK_CONFIG[networkName];

  // Try each RPC individually — avoids FallbackProvider quorum issues
  // where slight sync differences between RPCs cause failures.
  for (let i = 0; i < rpcs.length; i++) {
    try {
      console.log(`[IncogPay] Trying RPC ${i + 1}/${rpcs.length} for ${networkName}: ${rpcs[i]}`);
      await loadProvider(
        {
          chainId: chain.id,
          providers: [{ provider: rpcs[i], priority: 1, weight: 1 }],
        },
        networkName,
      );
      loadedProviders.add(networkName);
      console.log(`[IncogPay] Provider loaded for ${networkName} using ${rpcs[i]}`);
      return;
    } catch (err) {
      console.warn(`[IncogPay] RPC ${rpcs[i]} failed for ${networkName}:`, err);
      if (i === rpcs.length - 1) throw err;
      // Small delay before trying next RPC
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function doInit(): Promise<void> {
  const db = new LevelDB("incogpay-engine");
  const artifactStore = createArtifactStore();

  await startRailgunEngine(
    "incogpay", // walletSource (max 16 chars, lowercase)
    db, // LevelDOWN-compatible database
    false, // shouldDebug
    artifactStore, // persistent artifact storage
    false, // useNativeArtifacts (false for browser / WASM)
    false, // skipMerkletreeScans
    POI_NODES, // PPOI aggregator nodes
  );
}
