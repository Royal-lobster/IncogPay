/**
 * scripts/test-send.ts
 *
 * Standalone Node.js test script for the IncogPay RAILGUN send flow.
 * Runs each step in isolation so you can see exactly where things break.
 *
 * Usage:
 *   cp scripts/.env.example scripts/.env
 *   # fill in your values
 *   npx tsx scripts/test-send.ts
 *
 * Steps:
 *   1. Engine init  (leveldown persistence, snarkjs prover)
 *   2. Wallet load  (from WALLET_ID env var or derived from PRIVATE_KEY)
 *   3. Balance sync (poll until spendable USDC found)
 *   4a. Unshield    (if spendable balance + RECIPIENT set)
 *   4b. Shield dry-run (if no balance — populates tx but does NOT broadcast)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

// ── Load .env ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
if (!fs.existsSync(envPath)) {
  console.error("❌  scripts/.env not found. Copy scripts/.env.example and fill it in.");
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const [k, ...v] = l.split("="); return [k.trim(), v.join("=").trim()]; })
);

const PRIVATE_KEY    = env["PRIVATE_KEY"] ?? "";
const RPC_URL        = env["RPC_URL"] ?? "https://arb1.arbitrum.io/rpc";
const CHAIN_ID       = parseInt(env["CHAIN_ID"] ?? "42161", 10);
const TOKEN_ADDRESS  = env["TOKEN_ADDRESS"] ?? "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const TOKEN_DECIMALS = parseInt(env["TOKEN_DECIMALS"] ?? "6", 10);
const SEND_AMOUNT    = env["SEND_AMOUNT"] ?? "0.01";
const RECIPIENT      = env["RECIPIENT"] ?? "";
// Optional: paste wallet ID from browser localStorage key "incogpay-railgun-wallet-id"
const WALLET_ID_OVERRIDE = env["WALLET_ID"] ?? "";
// Optional: block when you first shielded (limits scan window, saves time)
const CREATION_BLOCK = env["CREATION_BLOCK"] ? parseInt(env["CREATION_BLOCK"], 10) : null;

if (!PRIVATE_KEY) {
  console.error("❌  PRIVATE_KEY is required in scripts/.env");
  process.exit(1);
}

// ── Railgun SDK ───────────────────────────────────────────────────────────────
import {
  ArtifactStore,
  balanceForERC20Token,
  createRailgunWallet,
  gasEstimateForShield,
  gasEstimateForUnprovenUnshield,
  generateUnshieldProof,
  getProver,
  getShieldPrivateKeySignatureMessage,
  loadProvider,
  loadWalletByID,
  populateProvedUnshield,
  populateShield,
  refreshBalances,
  startRailgunEngine,
  walletForID,
} from "@railgun-community/wallet";
import type { TransactionGasDetails } from "@railgun-community/shared-models";
import { EVMGasType, NETWORK_CONFIG, NetworkName, TXIDVersion } from "@railgun-community/shared-models";
// @ts-expect-error — snarkjs has no bundled types
import { groth16 } from "snarkjs";
// @ts-expect-error — leveldown has no bundled types
import leveldown from "leveldown";

// ── Constants ──────────────────────────────────────────────────────────────────
const TXID_VERSION   = TXIDVersion.V2_PoseidonMerkle;
const SIGN_MESSAGE   = "Generate my IncogPay RAILGUN wallet";
const DB_DIR         = path.join(__dirname, ".engine-db");
const ARTIFACTS_DIR  = path.join(__dirname, ".artifacts");
const WALLET_ID_FILE = path.join(__dirname, ".wallet-id");
const POI_NODES      = ["https://ppoi-agg.horsewithsixlegs.xyz"];

const CHAIN_TO_NETWORK: Record<number, NetworkName> = {
  42161: NetworkName.Arbitrum,
  1:     NetworkName.Ethereum,
  137:   NetworkName.Polygon,
  56:    NetworkName.BNBChain,
};

// ── Logging ───────────────────────────────────────────────────────────────────
const hr  = () => console.log("─".repeat(62));
const hr2 = () => console.log("═".repeat(62));
const step = (n: number, label: string) => { console.log(); hr(); console.log(`STEP ${n}: ${label}`); hr(); };
const ok   = (m: string) => console.log(`  ✅ ${m}`);
const info = (m: string) => console.log(`  ℹ️  ${m}`);
const warn = (m: string) => console.log(`  ⚠️  ${m}`);
const fail = (m: string) => { console.error(`  ❌ ${m}`); };

// ── Filesystem artifact store ─────────────────────────────────────────────────
function createArtifactStore(): ArtifactStore {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const fspath = (p: string) => path.join(ARTIFACTS_DIR, p.replace(/[/\\]/g, "__"));

  return new ArtifactStore(
    async (p) => {
      const full = fspath(p);
      if (!fs.existsSync(full)) return null;
      return fs.readFileSync(full);
    },
    async (_dir, p, item) => fs.writeFileSync(fspath(p), Buffer.from(item)),
    async (p) => fs.existsSync(fspath(p)),
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🛤️  IncogPay RAILGUN — Send Test Script");
  console.log(`   Chain:    ${CHAIN_ID} (${CHAIN_TO_NETWORK[CHAIN_ID] ?? "unknown"})`);
  console.log(`   RPC:      ${RPC_URL}`);
  console.log(`   Token:    ${TOKEN_ADDRESS} (${TOKEN_DECIMALS} decimals)`);
  console.log(`   Amount:   ${SEND_AMOUNT}`);
  console.log(`   Recipient: ${RECIPIENT || "(not set — send step skipped)"}`);
  console.log(`   Wallet ID: ${WALLET_ID_OVERRIDE || "(derive from private key)"}`);
  console.log(`   Creation block: ${CREATION_BLOCK ?? "(use SDK defaults)"}`);

  const networkName = CHAIN_TO_NETWORK[CHAIN_ID];
  if (!networkName) {
    fail(`Unsupported chain ${CHAIN_ID}. Supported: 42161, 1, 137, 56`);
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
  info(`Public wallet: ${signer.address}`);

  // ── STEP 1: Engine init ────────────────────────────────────────────────────
  step(1, "Engine Initialization");

  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = leveldown(DB_DIR);
  const artifactStore = createArtifactStore();

  try {
    await startRailgunEngine("incogpaytest", db, false, artifactStore, false, false, POI_NODES);
    ok("startRailgunEngine OK");
  } catch (e) { fail(`startRailgunEngine: ${e}`); process.exit(1); }

  try {
    getProver().setSnarkJSGroth16(groth16);
    ok("snarkjs groth16 registered");
  } catch (e) { fail(`snarkjs: ${e}`); process.exit(1); }

  const { chain } = NETWORK_CONFIG[networkName];
  try {
    await loadProvider(
      { chainId: chain.id, providers: [{ provider: RPC_URL, priority: 1, weight: 2 }, { provider: RPC_URL, priority: 2, weight: 1 }] },
      networkName,
    );
    ok(`Provider loaded for ${networkName}`);
  } catch (e) { fail(`loadProvider: ${e}`); process.exit(1); }

  // Fetch current gas prices for use in transactions
  let maxFeePerGas = BigInt(100_000_000); // 0.1 gwei fallback
  try {
    const feeData = await provider.getFeeData();
    if (feeData.maxFeePerGas) maxFeePerGas = feeData.maxFeePerGas;
    else if (feeData.gasPrice) maxFeePerGas = feeData.gasPrice;
    ok(`Network gas price: ${(Number(maxFeePerGas) / 1e9).toFixed(4)} gwei`);
  } catch (e) {
    warn(`Could not fetch gas price, using fallback: ${(Number(maxFeePerGas) / 1e9).toFixed(4)} gwei`);
  }

  // ── STEP 2: Wallet ─────────────────────────────────────────────────────────
  step(2, "Wallet Load / Derive");

  const walletSig     = await signer.signMessage(SIGN_MESSAGE);
  const encryptionKey = ethers.keccak256(ethers.getBytes(walletSig)).slice(2);
  ok("Signed deterministic message");

  let railgunWalletId: string;
  let railgunAddress:  string;

  // Build creation block map — use override if provided, else SDK defaults
  const creationBlocks: Partial<Record<string, number>> = {};
  for (const name of Object.values(NetworkName)) {
    const cfg = NETWORK_CONFIG[name as NetworkName];
    if (cfg?.deploymentBlock) {
      creationBlocks[name] = CREATION_BLOCK ?? cfg.deploymentBlock;
    }
  }

  // Priority: WALLET_ID env > stored .wallet-id file > create new
  const candidateId = WALLET_ID_OVERRIDE || (fs.existsSync(WALLET_ID_FILE) ? fs.readFileSync(WALLET_ID_FILE, "utf-8").trim() : "");

  if (candidateId) {
    try {
      info(`Loading wallet ID: ${candidateId}`);
      const w = await loadWalletByID(encryptionKey, candidateId, false);
      railgunWalletId = w.id;
      railgunAddress  = w.railgunAddress;
      ok("Wallet loaded from stored ID");
    } catch (e) {
      warn(`loadWalletByID failed (${e}) — recreating...`);
      if (!WALLET_ID_OVERRIDE) fs.existsSync(WALLET_ID_FILE) && fs.unlinkSync(WALLET_ID_FILE);
      const entropy  = ethers.getBytes(walletSig).slice(0, 16);
      const mnemonic = ethers.Mnemonic.fromEntropy(entropy).phrase;
      const w = await createRailgunWallet(encryptionKey, mnemonic, creationBlocks);
      railgunWalletId = w.id;
      railgunAddress  = w.railgunAddress;
      if (!WALLET_ID_OVERRIDE) fs.writeFileSync(WALLET_ID_FILE, railgunWalletId);
    }
  } else {
    const entropy  = ethers.getBytes(walletSig).slice(0, 16);
    const mnemonic = ethers.Mnemonic.fromEntropy(entropy).phrase;
    const w = await createRailgunWallet(encryptionKey, mnemonic, creationBlocks);
    railgunWalletId = w.id;
    railgunAddress  = w.railgunAddress;
    fs.writeFileSync(WALLET_ID_FILE, railgunWalletId);
    ok("New wallet created (ID saved to .wallet-id)");
  }

  ok(`Wallet ID:   ${railgunWalletId}`);
  ok(`0zk address: ${railgunAddress}`);

  // ── STEP 3: Balance sync ───────────────────────────────────────────────────
  step(3, "Balance Sync");

  const MAX_POLLS = parseInt(env["MAX_POLLS"] ?? "8", 10);
  const POLL_MS   = parseInt(env["POLL_MS"] ?? "12000", 10);
  let spendable   = BigInt(0);
  let total       = BigInt(0);

  info("Syncing merkle tree (first run can be slow — use a fast RPC like Alchemy/QuickNode)...");
  info(`Tip: set CREATION_BLOCK to the block when you first shielded to speed this up.`);

  // Helper: run refreshBalances with a per-attempt timeout so the script
  // never hangs forever on a slow or rate-limited RPC.
  const refreshWithTimeout = (timeoutMs: number) =>
    Promise.race([
      refreshBalances(chain, [railgunWalletId]).catch((e: unknown) => {
        warn(`refreshBalances: ${e}`);
      }),
      new Promise<void>(resolve => setTimeout(() => {
        warn(`refreshBalances timed out after ${timeoutMs / 1000}s (slow RPC?) — checking cached balance anyway`);
        resolve();
      }, timeoutMs)),
    ]);

  for (let i = 1; i <= MAX_POLLS; i++) {
    await refreshWithTimeout(25_000);

    try {
      const w = walletForID(railgunWalletId);
      spendable = await balanceForERC20Token(TXID_VERSION, w, networkName, TOKEN_ADDRESS, true);
      total     = await balanceForERC20Token(TXID_VERSION, w, networkName, TOKEN_ADDRESS, false);
    } catch (e) { warn(`balanceForERC20Token attempt ${i}: ${e}`); }

    const sDisp = (Number(spendable) / 10 ** TOKEN_DECIMALS).toFixed(6);
    const tDisp = (Number(total)     / 10 ** TOKEN_DECIMALS).toFixed(6);
    info(`Poll ${i}/${MAX_POLLS} — spendable: ${sDisp} / total: ${tDisp}`);

    if (spendable > BigInt(0)) break;
    if (total > BigInt(0)) {
      warn("Total > 0 but spendable = 0 → PPOI not verified yet. Waiting...");
    }
    if (i < MAX_POLLS) await new Promise(r => setTimeout(r, POLL_MS));
  }

  const sDisp = (Number(spendable) / 10 ** TOKEN_DECIMALS).toFixed(6);
  const tDisp = (Number(total)     / 10 ** TOKEN_DECIMALS).toFixed(6);

  if (spendable > BigInt(0)) {
    ok(`Spendable: ${sDisp}  |  Total: ${tDisp}`);
  } else if (total > BigInt(0)) {
    warn(`Total: ${tDisp} but not yet spendable (PPOI pending). Come back in a few minutes.`);
  } else {
    warn(`No balance found. Either merkle sync is incomplete or no tokens shielded.`);
    info(`Shield your token first: npx tsx scripts/test-send.ts (runs shield dry-run below)`);
  }

  // ── STEP 4a: Unshield + self-relay ────────────────────────────────────────
  const sendAmountUnits = BigInt(Math.floor(parseFloat(SEND_AMOUNT) * 10 ** TOKEN_DECIMALS));

  if (spendable >= sendAmountUnits && RECIPIENT) {
    step(4, `Unshield ${SEND_AMOUNT} → ${RECIPIENT}`);

    const recipients = [{ tokenAddress: TOKEN_ADDRESS, amount: sendAmountUnits, recipientAddress: RECIPIENT }];
    const { defaultEVMGasType } = NETWORK_CONFIG[networkName];

    // ── Gas estimate (dummy gas details for the estimate call)
    const dummyGas = (defaultEVMGasType === EVMGasType.Type2
      ? { evmGasType: EVMGasType.Type2, gasEstimate: BigInt(0), maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) }
      : { evmGasType: EVMGasType.Type0, gasEstimate: BigInt(0), gasPrice: BigInt(0) }) as TransactionGasDetails;

    info("Estimating gas...");
    let gasEstimate: bigint;
    try {
      const r = await gasEstimateForUnprovenUnshield(
        TXID_VERSION, networkName, railgunWalletId, encryptionKey,
        recipients, [], dummyGas, undefined, true, // sendWithPublicWallet
      );
      gasEstimate = r.gasEstimate;
      ok(`Gas limit estimate: ${gasEstimate.toString()}`);
    } catch (e) { fail(`gasEstimateForUnprovenUnshield: ${e}`); console.error(e); process.exit(1); }

    // overallBatchMinGasPrice = 0 for self-relay (no broadcaster fee)
    const overallBatchMinGasPrice = BigInt(0);

    // ── ZK proof generation
    info("Generating ZK proof (downloads ~20MB WASM on first run, 30–120s)...");
    const t0 = Date.now();
    try {
      await generateUnshieldProof(
        TXID_VERSION, networkName, railgunWalletId, encryptionKey,
        recipients, [],
        undefined, // no broadcaster fee
        true,      // sendWithPublicWallet / self-relay
        overallBatchMinGasPrice,
        (progress, status) => {
          process.stdout.write(`\r  ⏳ ${Math.round(progress * 100)}% — ${status.slice(0, 50).padEnd(50)}`);
        },
      );
      console.log();
      ok(`Proof generated in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      console.log();
      fail(`generateUnshieldProof: ${e}`);
      console.error(e);
      process.exit(1);
    }

    // ── Populate proved transaction
    info("Populating proved transaction...");
    const finalGasDetails = (defaultEVMGasType === EVMGasType.Type2
      ? { evmGasType: EVMGasType.Type2, gasEstimate, maxFeePerGas, maxPriorityFeePerGas: maxFeePerGas }
      : { evmGasType: EVMGasType.Type0, gasEstimate, gasPrice: maxFeePerGas }) as TransactionGasDetails;

    try {
      const result = await populateProvedUnshield(
        TXID_VERSION, networkName, railgunWalletId,
        recipients, [],
        undefined, // no broadcaster fee
        true,      // sendWithPublicWallet
        overallBatchMinGasPrice,
        finalGasDetails,
      );

      if (!result?.transaction) {
        fail(`populateProvedUnshield: no transaction in result (keys: ${Object.keys(result ?? {}).join(", ")})`);
        process.exit(1);
      }
      ok(`Transaction populated`);
      info(`  to:    ${result.transaction.to}`);
      info(`  data:  ${String(result.transaction.data).slice(0, 20)}…`);

      // ── Broadcast
      info("Broadcasting via self-relay (wallet signs & sends)...");
      const txResp = await signer.sendTransaction({
        to:       result.transaction.to!,
        data:     result.transaction.data! as string,
        gasLimit: gasEstimate,
      });
      ok(`TX sent! Hash: ${txResp.hash}`);
      info(`Explorer: https://arbiscan.io/tx/${txResp.hash}`);

      info("Waiting for confirmation...");
      const receipt = await txResp.wait(1);
      if (receipt?.status === 1) {
        ok(`Confirmed in block ${receipt.blockNumber} ✓`);
        ok(`USDC sent privately! Recipient sees RAILGUN contract — not ${signer.address}`);
      } else {
        fail(`Transaction reverted! Block: ${receipt?.blockNumber}`);
      }

    } catch (e) {
      fail(`Send failed: ${e}`);
      console.error(e);
      process.exit(1);
    }

  } else if (spendable >= sendAmountUnits && !RECIPIENT) {
    step(4, "Send step skipped");
    warn("Set RECIPIENT= in scripts/.env to run the full send test");

  } else {
    // ── STEP 4b: Shield dry-run ───────────────────────────────────────────
    step(4, "Shield Dry-Run (populate only — NOT broadcast)");

    if (spendable > BigInt(0) && spendable < sendAmountUnits) {
      warn(`Spendable (${sDisp}) < SEND_AMOUNT (${SEND_AMOUNT}). Lower SEND_AMOUNT in .env to test unshield.`);
    }

    const shieldMsg = getShieldPrivateKeySignatureMessage();
    const shieldSig = await signer.signMessage(shieldMsg);
    const shieldKey = ethers.keccak256(ethers.getBytes(shieldSig));
    const testAmt   = BigInt(1_000); // 0.001 USDC just to test populate

    const shieldRecipients = [{ tokenAddress: TOKEN_ADDRESS, amount: testAmt, recipientAddress: railgunAddress }];

    try {
      info(`Estimating gas for shield (${Number(testAmt) / 10 ** TOKEN_DECIMALS} tokens)...`);
      const gasResult = await gasEstimateForShield(TXID_VERSION, networkName, shieldKey, shieldRecipients, [], signer.address);
      ok(`Shield gas estimate: ${gasResult.gasEstimate.toString()} gas units`);

      const { defaultEVMGasType } = NETWORK_CONFIG[networkName];
      const gasDetails = (defaultEVMGasType === EVMGasType.Type2
        ? { evmGasType: EVMGasType.Type2, gasEstimate: gasResult.gasEstimate, maxFeePerGas, maxPriorityFeePerGas: maxFeePerGas }
        : { evmGasType: EVMGasType.Type0, gasEstimate: gasResult.gasEstimate, gasPrice: maxFeePerGas }) as TransactionGasDetails;

      const { transaction } = await populateShield(TXID_VERSION, networkName, shieldKey, shieldRecipients, [], gasDetails);
      ok("Shield tx populated (not broadcast — dry-run only)");
      info(`  to:   ${transaction.to}`);
      info(`  data: ${String(transaction.data).slice(0, 20)}…`);
      info("To actually shield: send this tx from a funded wallet with ${TOKEN_ADDRESS} balance");
    } catch (e) {
      fail(`Shield dry-run failed: ${e}`);
      console.error(e);
    }
  }

  console.log();
  hr2();
  console.log("DONE");
  hr2();
  process.exit(0);
}

main().catch(e => { console.error("\n💥 Unhandled:", e); process.exit(1); });
