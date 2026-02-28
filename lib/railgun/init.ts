import { NETWORK_CONFIG, NetworkName } from "@railgun-community/shared-models";
import { ArtifactStore, loadProvider, startRailgunEngine } from "@railgun-community/wallet";

// level-js has no TypeScript declarations — import as untyped and cast.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LevelDB = require("level-js") as new (
  name: string,
) => import("abstract-leveldown").AbstractLevelDOWN;

// ── singleton promise to ensure init runs exactly once ────────────────────
let initPromise: Promise<void> | null = null;

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
const POI_NODES = ["https://poi-node.railgun.org"];

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

/**
 * Lazily initialise the RAILGUN engine.
 * Safe to call from any module; the engine is started exactly once.
 */
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
    "incogpay", // walletSource (max 16 chars, lowercase)
    db, // LevelDOWN-compatible database
    false, // shouldDebug
    artifactStore, // persistent artifact storage
    false, // useNativeArtifacts (false for browser / WASM)
    false, // skipMerkletreeScans
    POI_NODES, // PPOI aggregator nodes
  );

  // Load providers for all configured chains in parallel
  await Promise.all(
    NETWORKS_TO_LOAD.map(({ name, rpc }) => {
      const { chain } = NETWORK_CONFIG[name];
      return loadProvider(
        {
          chainId: chain.id,
          providers: [{ provider: rpc, priority: 1, weight: 1 }],
        },
        name,
      );
    }),
  );
}
