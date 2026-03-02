# IncogPay Test Scripts

Standalone Node.js scripts for testing the RAILGUN send flow outside the browser.
Run these to isolate exactly which step is failing.

## Setup

```bash
cp scripts/.env.example scripts/.env
# edit scripts/.env and fill in the values
```

## test-send.ts

Tests the full private send flow step by step:

```bash
npx tsx scripts/test-send.ts
```

**What it does:**

| Step | What | Needs money? |
|------|------|-------------|
| 1 | Engine init (leveldown DB + snarkjs prover) | No |
| 2 | Wallet derive/load from your private key | No |
| 3 | Balance sync (poll for spendable USDC in pool) | No |
| 4a | Unshield → send to RECIPIENT | Yes — shielded balance |
| 4b | Shield dry-run (populate only, not broadcast) | No |

**Fast setup tips:**

1. **CREATION_BLOCK** — paste the Arbitrum block when you first shielded tokens.
   The merkle tree scan only covers from that block forward, which is fast.
   Find it on Arbiscan: look at your shield tx block number.

2. **WALLET_ID** — paste your browser wallet ID to reuse the same RAILGUN wallet.
   Go to: DevTools → Application → Local Storage → `incogpay-railgun-wallet-id`

3. **Persistence** — the engine DB is saved to `scripts/.engine-db/`. Second run is
   much faster because the merkle state is cached.

**Example `.env` for testing with existing shielded balance:**

```env
PRIVATE_KEY=0x<your-key>
RPC_URL=https://arb-mainnet.g.alchemy.com/v2/<your-key>
CHAIN_ID=42161
TOKEN_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831
TOKEN_DECIMALS=6
SEND_AMOUNT=0.01
RECIPIENT=0x<recipient-address>
CREATION_BLOCK=437000000
WALLET_ID=<from-browser-localStorage>
```

## Troubleshooting

**Balance shows 0 spendable:**
- Check `CREATION_BLOCK` is at or before your shield tx
- Wait a few minutes — PPOI verification takes time after shielding
- Try running again (DB state is cached, sync continues)

**Proof generation fails:**
- This is the most common failure point
- Check browser console for errors when running in the app
- Script output will show the exact SDK error

**Transaction reverts:**
- Check recipient address is valid
- Ensure native ETH balance covers gas (~$0.10 on Arbitrum)
