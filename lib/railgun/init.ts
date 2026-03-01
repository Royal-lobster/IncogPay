import { NETWORK_CONFIG, NetworkName } from "@railgun-community/shared-models";
import { ArtifactStore, getProver, loadProvider, startRailgunEngine } from "@railgun-community/wallet";

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

  // level-js requires an explicit open() before put/get — without it, the
  // internal IndexedDB handle (this.idb) is undefined and operations throw
  // "Cannot read properties of undefined (reading 'transaction')".
  const dbReady = new Promise<void>((resolve, reject) => {
    db.open((err: Error | undefined) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Do NOT use level-js { asBuffer: true } — it corrupts binary data.
  // IndexedDB returns Uint8Array for binary values.  level-js checks
  // Buffer.isBuffer(value), which is false for native Uint8Array in the
  // browser, so it falls through to Buffer.from(String(value)) which
  // turns the bytes into their comma-separated ASCII representation.
  // Instead we retrieve the raw value and convert it ourselves.
  const get = async (path: string): Promise<string | Buffer | null> => {
    try {
      await dbReady;
      const raw = await new Promise<unknown>((resolve, reject) => {
        db.get(path, { asBuffer: false }, (err: Error | undefined, value: unknown) => {
          if (err) reject(err);
          else resolve(value);
        });
      });
      if (raw instanceof ArrayBuffer) return Buffer.from(raw);
      if (raw instanceof Uint8Array) return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
      if (Buffer.isBuffer(raw)) return raw;
      if (typeof raw === "string") return raw;
      return null;
    } catch {
      return null;
    }
  };

  const store = async (_dir: string, path: string, item: string | Uint8Array): Promise<void> => {
    await dbReady;
    await new Promise<void>((resolve, reject) => {
      db.put(path, item, (err: Error | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  const exists = async (path: string): Promise<boolean> => {
    try {
      await dbReady;
      await new Promise<unknown>((resolve, reject) => {
        db.get(path, { asBuffer: false }, (err: Error | undefined, value: unknown) => {
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

// ── load snarkjs UMD from /public (avoids Turbopack crash) ─────────────────
let snarkJSPromise: Promise<void> | null = null;
function loadSnarkJS(): Promise<void> {
  if (snarkJSPromise) return snarkJSPromise;
  snarkJSPromise = new Promise<void>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((globalThis as any).snarkjs) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "/snarkjs.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load /snarkjs.min.js"));
    document.head.appendChild(script);
  });
  return snarkJSPromise;
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

  // Register the snarkjs groth16 prover for ZK proof generation.
  // snarkjs is loaded as a UMD script from /public (Turbopack crashes on
  // the npm package's internal file references).  The script is loaded
  // lazily so engine init doesn't block page load.
  await loadSnarkJS();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groth16 = (globalThis as any).snarkjs?.groth16;
  if (!groth16) throw new Error("snarkjs failed to load — groth16 not found on globalThis");
  getProver().setSnarkJSGroth16(groth16);
}
