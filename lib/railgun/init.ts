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

// ── RPC endpoints per network ────────────────────────────────────────────
// Uses our own API proxy (same-origin, no CORS) as both providers.
// The RAILGUN SDK requires ≥2 providers for its FallbackProvider config.
function getBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

const PROXY_NETWORKS: Record<NetworkName, string> = {
  [NetworkName.Arbitrum]: "arbitrum",
  [NetworkName.Ethereum]: "ethereum",
  [NetworkName.Polygon]: "polygon",
  [NetworkName.BNBChain]: "bnb",
} as Record<NetworkName, string>;

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

  const proxyKey = PROXY_NETWORKS[networkName];
  if (!proxyKey) throw new Error(`No RPC configured for ${networkName}`);

  const base = getBaseUrl();
  const proxyUrl = `${base}/api/rpc/${proxyKey}`;
  const { chain } = NETWORK_CONFIG[networkName];

  console.log(`[IncogPay] Loading provider for ${networkName} via ${proxyUrl}`);

  await loadProvider(
    {
      chainId: chain.id,
      providers: [
        { provider: proxyUrl, priority: 1, weight: 2 },
        { provider: proxyUrl, priority: 2, weight: 1 },
      ],
    },
    networkName,
  );

  loadedProviders.add(networkName);
  console.log(`[IncogPay] Provider loaded for ${networkName}`);
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
