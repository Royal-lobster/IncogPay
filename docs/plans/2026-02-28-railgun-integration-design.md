# Railgun SDK Integration Design

## Overview

Replace all mock/placeholder Railgun operations in IncogPay with real SDK calls. Full client-side integration — no backend needed. Engine, wallet, proofs, and broadcaster communication all run in the browser.

## Decisions

- **Approach:** Full client-side (no backend)
- **Target chains:** All 4 — Arbitrum, Ethereum, Polygon, BNB Chain
- **Storage:** IndexedDB via `level-js` for engine database + artifact cache
- **Relayer:** RAILGUN public broadcaster network via Waku p2p
- **Key management:** Derive wallet from deterministic wallet signature
- **Code organization:** `lib/railgun/` module, step components call these functions

## Architecture

```
lib/railgun/
├── init.ts           # Engine startup, database, artifact store
├── wallet.ts         # Create/load wallet from signature-derived keys
├── shield.ts         # ERC20 approve + shield into RAILGUN pool
├── transfer.ts       # Generate ZK proof + send via broadcaster
├── broadcaster.ts    # Find best broadcaster, calculate fees, submit tx
├── poi.ts            # Poll PPOI status for shielded funds
├── networks.ts       # Chain configs, token mappings (wagmi → RAILGUN)
└── types.ts          # Shared Railgun-specific TypeScript types
```

### Data Flow

```
User connects wallet (wagmi)
        │
        ▼
Sign deterministic message → derive mnemonic → createRailgunWallet()
        │
        ▼
Engine initialized (level-js IndexedDB + WASM artifacts cached)
        │
        ▼
Shield: ensureCorrectChain() → approve ERC20 → populateShield() → send tx
        │
        ▼
PPOI: poll balance/status until funds are spendable
        │
        ▼
Send: findBestBroadcaster() → generateUnshieldProof() → BroadcasterTransaction.send()
```

## Module Details

### 1. Engine Initialization (`lib/railgun/init.ts`)

- Create `level-js` IndexedDB database at path `"incogpay-engine"`
- Build `ArtifactStore` that reads/writes WASM proof files to IndexedDB (downloaded ~10-20MB on first use, cached after)
- Call `startRailgunEngine("incogpay", db, ...)` lazily on first use
- Module-level promise ensures init only runs once even if called concurrently
- After engine starts, call `loadProvider()` for all 4 chains using public RPCs
- POI nodes: public RAILGUN POI aggregator URLs
- No explicit shutdown — engine lives for the browser tab lifetime
- On repeat visits, engine loads instantly from cached IndexedDB state

### 2. Wallet & Key Derivation (`lib/railgun/wallet.ts`)

1. User signs deterministic message: `"Generate my IncogPay RAILGUN wallet"`
2. `keccak256(signature)` → encryption key
3. Signature bytes → `Mnemonic.fromEntropy()` → deterministic mnemonic
4. `createRailgunWallet(encryptionKey, mnemonic, creationBlockNumbers)` → wallet ID + `0zk` address
5. Store `walletId` in `localStorage` → on return visits, `loadWalletByID()` instead of recreating

Properties:
- Same connected wallet always produces same signature → same RAILGUN wallet
- Replaces mock `deriveShieldedAddress()` in receive flow
- Send and receive flows share the same wallet derivation
- User only signs once per session

### 3. Shield Flow (`lib/railgun/shield.ts`)

1. **ERC20 Approve** — `token.approve(railgunContractAddress, amount)` via wagmi `writeContract`. Normal on-chain tx.
2. **Shield private key** — `getShieldPrivateKeySignatureMessage()` → user signs → `keccak256(signature)`
3. **Populate shield** — `populateShield(txidVersion, network, shieldPrivateKey, erc20AmountRecipients, [])`
4. **Send shield tx** — wagmi `sendTransaction` with populated tx. Returns real tx hash.

Chain switching: `ensureCorrectChain(selectedChainId)` called before approve.

### 4. PPOI Polling (`lib/railgun/poi.ts`)

- After shield tx confirms, poll SDK balance/PPOI status every 30-60 seconds
- Call `refreshBalances()` / scan merkletree to pick up shield event
- Check if shielded UTXO has valid POI status
- Once spendable, auto-advance to send step
- If user closes tab and returns: engine reloads from IndexedDB, wallet reloads via stored ID, polling resumes

UI change: Replace fixed 1-hour countdown with real status indicator + spinner. PPOI typically completes in minutes.

### 5. Send via Broadcaster (`lib/railgun/transfer.ts` + `lib/railgun/broadcaster.ts`)

1. **Find best broadcaster** — Init Waku client (`@railgun-community/waku-broadcaster-client-web`), call `findBestBroadcaster(chain, feeTokenAddress)`
2. **Calculate fee** — `calculateBroadcasterFeeERC20Amount(...)` — fee paid from shielded balance in same token
3. **Generate ZK proof** — `generateUnshieldProof(...)` with `progressCallback` for UI progress bar. Takes 10-30 seconds.
4. **Populate transaction** — `populateProvedUnshield(...)` → transaction data + nullifiers
5. **Submit via broadcaster** — `BroadcasterTransaction.create(...).send()` → tx hash. No wallet popup — broadcaster pays gas.

### 6. Network Config (`lib/railgun/networks.ts`)

- Maps wagmi chain IDs → RAILGUN `NetworkName` enum
- Exports `TXIDVersion.V2_PoseidonMerkle` constant
- Token addresses reuse `TOKENS_BY_CHAIN` from `lib/wagmi.ts` (single source of truth)
- Public RPCs reuse wagmi's existing `http()` transports

### 7. Chain Switching (`hooks/useEnsureCorrectChain.ts`)

```typescript
const { ensureCorrectChain } = useEnsureCorrectChain(selectedChainId);
```

Called before any on-chain transaction (approve, shield). Not needed for broadcaster send. Auto-switches user's wallet if on wrong chain.

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `lib/railgun/init.ts` | Engine startup, level-js DB, artifact store, load providers |
| `lib/railgun/wallet.ts` | Create/load wallet from signature-derived keys |
| `lib/railgun/shield.ts` | ERC20 approve + populateShield + send tx |
| `lib/railgun/transfer.ts` | Generate ZK proof + populate unshield |
| `lib/railgun/broadcaster.ts` | Find best broadcaster, calculate fee, submit tx |
| `lib/railgun/poi.ts` | Poll PPOI spendability status |
| `lib/railgun/networks.ts` | Chain ID to NetworkName mapping |
| `lib/railgun/types.ts` | Shared types |
| `hooks/useEnsureCorrectChain.ts` | Auto-switch wallet chain before on-chain txs |

### Modified Files

| File | Change |
|------|--------|
| `components/steps/ShieldStep.tsx` | Replace setTimeout mock with real approve + shield |
| `components/steps/MixingStep.tsx` | Replace countdown timer with real PPOI polling |
| `components/steps/SendStep.tsx` | Replace setTimeout mock with real proof + broadcaster |
| `app/receive/page.tsx` | Replace `deriveShieldedAddress()` with real wallet derivation |
| `app/send/page.tsx` | Wire wallet derivation before shield step |

### New Dependencies

| Package | Why |
|---------|-----|
| `level-js` | IndexedDB database for engine storage |
| `@railgun-community/waku-broadcaster-client-web` | Browser Waku client for p2p broadcaster |

### Unchanged

wagmi config, token data, UI layout, styling, header, homepage
