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
  calculateBroadcasterFeeERC20Amount,
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
import type { FeeTokenDetails, TransactionGasDetails } from "@railgun-community/shared-models";
import { EVMGasType, NETWORK_CONFIG, NetworkName, TXIDVersion } from "@railgun-community/shared-models";
import { findBestBroadcaster, sendViaBroadcaster } from "../lib/railgun/broadcaster";
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

  // ── Check public USDC balance (for auto-shield decision) ──────────────────
  const erc20 = new ethers.Contract(
    TOKEN_ADDRESS,
    ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"],
    signer,
  );
  const publicUSDC: bigint = await erc20.balanceOf(signer.address).catch(() => BigInt(0));
  const publicUSDCDisplay = (Number(publicUSDC) / 10 ** TOKEN_DECIMALS).toFixed(6);

  if (spendable > BigInt(0)) {
    ok(`Spendable: ${sDisp}  |  Total: ${tDisp}`);
  } else if (total > BigInt(0)) {
    warn(`Total: ${tDisp} but not yet spendable — PPOI verification in progress`);
  } else if (publicUSDC > BigInt(0)) {
    info(`No shielded balance. Public wallet has ${publicUSDCDisplay} USDC — will shield now.`);
  } else {
    fail("No public or shielded USDC found. Fund the wallet first.");
    process.exit(1);
  }

  const sendAmountUnits = BigInt(Math.floor(parseFloat(SEND_AMOUNT) * 10 ** TOKEN_DECIMALS));
  const { defaultEVMGasType } = NETWORK_CONFIG[networkName];

  // ── STEP 4: Shield (if no shielded balance yet) ───────────────────────────
  if (total === BigInt(0) && spendable === BigInt(0) && publicUSDC > BigInt(0)) {
    step(4, "Shield USDC into RAILGUN pool");

    const shieldMsg = getShieldPrivateKeySignatureMessage();
    const shieldSig = await signer.signMessage(shieldMsg);
    const shieldKey = ethers.keccak256(ethers.getBytes(shieldSig));
    const shieldAmt = publicUSDC < sendAmountUnits ? publicUSDC : sendAmountUnits;
    const shieldRecipients = [{ tokenAddress: TOKEN_ADDRESS, amount: shieldAmt, recipientAddress: railgunAddress }];

    // Approve
    info(`Approving ${(Number(shieldAmt) / 10 ** TOKEN_DECIMALS).toFixed(6)} USDC to RAILGUN proxy...`);
    const proxyContract = NETWORK_CONFIG[networkName].proxyContract;
    const approveTx = await erc20.approve(proxyContract, shieldAmt);
    await approveTx.wait(1);
    ok(`Approved. TX: https://arbiscan.io/tx/${approveTx.hash}`);

    // Estimate + populate + send shield
    info("Estimating gas for shield...");
    const gasResult = await gasEstimateForShield(TXID_VERSION, networkName, shieldKey, shieldRecipients, [], signer.address);
    ok(`Gas estimate: ${gasResult.gasEstimate.toString()}`);

    const gasDetails = (defaultEVMGasType === EVMGasType.Type2
      ? { evmGasType: EVMGasType.Type2, gasEstimate: gasResult.gasEstimate, maxFeePerGas, maxPriorityFeePerGas: maxFeePerGas }
      : { evmGasType: EVMGasType.Type0, gasEstimate: gasResult.gasEstimate, gasPrice: maxFeePerGas }) as TransactionGasDetails;

    const { transaction } = await populateShield(TXID_VERSION, networkName, shieldKey, shieldRecipients, [], gasDetails);
    info("Sending shield transaction...");
    const shieldTx = await signer.sendTransaction({
      to: transaction.to!,
      data: transaction.data! as string,
      value: transaction.value ? BigInt(transaction.value.toString()) : BigInt(0),
    });
    await shieldTx.wait(1);
    ok(`Shielded! TX: https://arbiscan.io/tx/${shieldTx.hash}`);
    info("PPOI verification will now run on-chain. This typically takes 10–30 minutes.");
    info("Continuing to poll for spendable balance...");
  }

  // ── STEP 5: Wait for PPOI (spendable balance) ─────────────────────────────
  step(5, "Waiting for PPOI Verification");

  if (spendable < sendAmountUnits) {
    info("Polling every 30s — PPOI usually completes in 10–30 min on Arbitrum...");
    const PPOI_MAX_WAIT_MS  = 50 * 60 * 1000; // 50 minutes
    const PPOI_POLL_MS      = 30_000;
    const started           = Date.now();

    while (spendable < sendAmountUnits) {
      if (Date.now() - started > PPOI_MAX_WAIT_MS) {
        fail("PPOI wait timed out after 50 minutes. Run the script again later.");
        process.exit(1);
      }
      const elapsed = Math.round((Date.now() - started) / 1000);
      process.stdout.write(`\r  ⏳ Waiting for PPOI... ${elapsed}s elapsed    `);
      await new Promise(r => setTimeout(r, PPOI_POLL_MS));

      await refreshBalances(chain, [railgunWalletId]).catch(() => {});
      try {
        const w = walletForID(railgunWalletId);
        spendable = await balanceForERC20Token(TXID_VERSION, w, networkName, TOKEN_ADDRESS, true);
      } catch { /* ignore */ }
    }
    console.log();
    ok(`Spendable balance confirmed: ${(Number(spendable) / 10 ** TOKEN_DECIMALS).toFixed(6)} USDC`);
  } else {
    ok(`Already spendable: ${sDisp}`);
  }

  if (!RECIPIENT) {
    warn("RECIPIENT not set — skipping send. Set RECIPIENT= in scripts/.env");
    process.exit(0);
  }

  // ── STEP 6: Send via broadcaster (or self-relay fallback) ─────────────────
  step(6, `Send ${SEND_AMOUNT} USDC → ${RECIPIENT}`);

  const recipients = [{ tokenAddress: TOKEN_ADDRESS, amount: sendAmountUnits, recipientAddress: RECIPIENT }];
  const dummyGas = (defaultEVMGasType === EVMGasType.Type2
    ? { evmGasType: EVMGasType.Type2, gasEstimate: BigInt(0), maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) }
    : { evmGasType: EVMGasType.Type0, gasEstimate: BigInt(0), gasPrice: BigInt(0) }) as TransactionGasDetails;

  // Find broadcaster
  info("Searching for Waku broadcaster...");
  const broadcaster = await findBestBroadcaster(networkName, TOKEN_ADDRESS, (m) => info(m)).catch(() => null);
  let selfRelay = broadcaster === null;

  if (selfRelay) {
    warn("No broadcaster found — using self-relay (recipient sees sender address, reduced privacy)");
  } else {
    ok(`Broadcaster: ${broadcaster!.railgunAddress}`);
  }

  // Gas estimate pass 1 — always sendWithPublicWallet=true (required when no feeTokenDetails)
  const est1 = await gasEstimateForUnprovenUnshield(
    TXID_VERSION, networkName, railgunWalletId, encryptionKey,
    recipients, [], dummyGas, undefined, true,
  );

  let broadcasterFeeRecipient: typeof recipients[0] | undefined;
  let overallBatchMinGasPrice = BigInt(0);
  let finalGasEstimate = est1.gasEstimate;

  if (!selfRelay && broadcaster) {
    const feeTokenDetails: FeeTokenDetails = { tokenAddress: broadcaster.tokenAddress, feePerUnitGas: broadcaster.feePerUnitGas };
    info(`DEBUG broadcaster.feePerUnitGas = ${broadcaster.feePerUnitGas.toString()}`);
    info(`DEBUG est1.gasEstimate = ${est1.gasEstimate.toString()}`);
    info(`DEBUG networkGasPrice (maxFeePerGas) = ${maxFeePerGas.toString()}`);

    // Pass 2: use FeeTokenDetails (not a recipient!) + sendWithPublicWallet=false
    const est2 = await gasEstimateForUnprovenUnshield(
      TXID_VERSION, networkName, railgunWalletId, encryptionKey,
      recipients, [], dummyGas, feeTokenDetails, false,
    ).catch(() => est1);

    // Use actual network gas price — feePerUnitGas is a token rate multiplier, not wei
    const gasDetails2 = (defaultEVMGasType === EVMGasType.Type2
      ? { evmGasType: EVMGasType.Type2, gasEstimate: est2.gasEstimate, maxFeePerGas, maxPriorityFeePerGas: maxFeePerGas }
      : { evmGasType: EVMGasType.Type0, gasEstimate: est2.gasEstimate, gasPrice: maxFeePerGas }) as TransactionGasDetails;
    const fee2 = calculateBroadcasterFeeERC20Amount(feeTokenDetails, gasDetails2);
    info(`DEBUG raw fee = ${fee2.amount.toString()} atoms = ${(Number(fee2.amount) / 10 ** TOKEN_DECIMALS).toFixed(6)} USDC`);

    // Sanity check: if fee > 50% of spendable balance, broadcaster is misconfigured → fall back
    if (fee2.amount > spendable / BigInt(2)) {
      warn(`Broadcaster fee (${fee2.amount} atoms) exceeds 50% of balance — falling back to self-relay`);
      selfRelay = true;   // ← must flip so proof + submit use self-relay path
      broadcasterFeeRecipient = undefined;
      overallBatchMinGasPrice = BigInt(0);
      finalGasEstimate = est1.gasEstimate;
    } else {
      broadcasterFeeRecipient = { tokenAddress: fee2.tokenAddress, amount: fee2.amount, recipientAddress: broadcaster.railgunAddress };
      overallBatchMinGasPrice = broadcaster.feePerUnitGas;
      finalGasEstimate = est2.gasEstimate;
      ok(`Broadcaster fee: ${(Number(fee2.amount) / 10 ** TOKEN_DECIMALS).toFixed(6)} USDC`);
    }
  }

  // Generate ZK proof
  info("Generating ZK proof (first run downloads ~20MB WASM, 30–120s)...");
  const t0 = Date.now();
  try {
    await generateUnshieldProof(
      TXID_VERSION, networkName, railgunWalletId, encryptionKey,
      recipients, [], broadcasterFeeRecipient, selfRelay, overallBatchMinGasPrice,
      (progress, status) => {
        process.stdout.write(`\r  ⏳ Proof ${Math.round(progress * 100)}% — ${(status ?? "").slice(0, 40).padEnd(40)}`);
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

  // Populate
  info("Populating proved transaction...");
  // For Arbitrum with broadcaster: getEVMGasTypeForTransaction returns Type1 (not Type2).
  // Type1 uses gasPrice field. Only self-relay (sendWithPublicWallet) uses Type2 on Arbitrum.
  const safePrice = maxFeePerGas > BigInt(500_000_000) ? maxFeePerGas : BigInt(500_000_000);
  const populateGasType = (!selfRelay && defaultEVMGasType === EVMGasType.Type2)
    ? EVMGasType.Type1
    : defaultEVMGasType;
  const finalGasDetails = (populateGasType === EVMGasType.Type2
    ? { evmGasType: EVMGasType.Type2, gasEstimate: finalGasEstimate, maxFeePerGas: safePrice, maxPriorityFeePerGas: safePrice }
    : { evmGasType: populateGasType, gasEstimate: finalGasEstimate, gasPrice: safePrice }) as TransactionGasDetails;

  const populated = await populateProvedUnshield(
    TXID_VERSION, networkName, railgunWalletId,
    recipients, [], broadcasterFeeRecipient, selfRelay, overallBatchMinGasPrice, finalGasDetails,
  );

  if (!populated?.transaction) {
    fail(`populateProvedUnshield returned no transaction`);
    process.exit(1);
  }
  ok("Transaction populated");

  // Submit
  if (!selfRelay && broadcaster) {
    info("Submitting via broadcaster...");
    try {
      const txHash = await sendViaBroadcaster(
        TXID_VERSION,
        { to: populated.transaction.to!, data: populated.transaction.data! as string },
        broadcaster.railgunAddress,
        broadcaster.feesID,
        chain,
        populated.nullifiers ?? [],
        overallBatchMinGasPrice,
        false,
        populated.preTransactionPOIsPerTxidLeafPerList,
      );
      ok(`✅ TX HASH: ${txHash}`);
      ok(`Explorer: https://arbiscan.io/tx/${txHash}`);
      ok(`Recipient (${RECIPIENT}) will see funds from RAILGUN contract — NOT from ${signer.address}`);
    } catch (e) {
      fail(`Broadcaster submission failed: ${e}`);
      console.error(e);
      process.exit(1);
    }
  } else {
    warn("Self-relay fallback — signing with sender wallet");
    const txResp = await signer.sendTransaction({
      to: populated.transaction.to!,
      data: populated.transaction.data! as string,
      gasLimit: finalGasEstimate,
    });
    ok(`TX sent: https://arbiscan.io/tx/${txResp.hash}`);
    await txResp.wait(1);
    warn("⚠️  Recipient can see sender wallet address (self-relay)");
  }

  console.log();
  hr2();
  console.log("DONE");
  hr2();
  process.exit(0);
}

main().catch(e => { console.error("\n💥 Unhandled:", e); process.exit(1); });
