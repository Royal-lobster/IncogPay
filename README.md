# IncogPay

Private crypto payments powered by [RAILGUN](https://railgun.org). Send and receive USDC, USDT, WETH and more — the recipient only ever sees the RAILGUN relayer, never your real wallet address.

**Live:** [incogpay.vercel.app](https://incogpay.vercel.app)

---

## What it does

**Send privately** — Shield funds into RAILGUN's private pool, wait ~1 hour for the on-chain privacy check (Proof of Innocence), then send to any address. The recipient's on-chain view shows the RAILGUN relayer as the sender, not your wallet.

**Receive privately** — Sign a message from your wallet to derive a RAILGUN 0zk shielded address. Share it (or a pre-filled payment link) with whoever is paying you. They can't trace the 0zk address back to your real wallet.

---

## Chains & tokens

| Chain | Tokens |
|---|---|
| Arbitrum | USDC, USDT, WETH |
| Ethereum | USDC, USDT, DAI, WETH |
| Polygon | USDC, USDT, WETH |
| BNB Chain | USDC, USDT, WBNB |

---

## Fees

- **Protocol fee:** 0.25% deducted at shield time (RAILGUN protocol, not us)
- **Relayer fee:** ~$0.05–0.10 on Arbitrum (paid from shielded balance — no extra ETH needed for the send step)
- **No markup.** We add nothing on top.

---

## Privacy model

- Recipient sees funds arriving from the RAILGUN relayer contract — not your wallet
- Sender's address never appears on-chain in relation to the recipient
- Correlation risk: if the pool is quiet, exact amount + timing can narrow things down — use round numbers and wait the full hour
- RAILGUN uses [Private Proofs of Innocence](https://docs.railgun.org/privacy-system/private-proofs-of-innocence) — funds are proven non-sanctioned before sending

---

## Stack

- **Next.js** (static export, no backend)
- **wagmi + viem** — wallet connection and contract interaction
- **RAILGUN SDK** (`@railgun-community/wallet`) — shielding, ZK proof generation, relayer broadcast
- **Phosphor Icons**, Geist Sans, Tailwind CSS

---

## Status

UI is complete. RAILGUN SDK calls are stubbed with `// TODO` markers at:
- `components/steps/ShieldStep.tsx` — approve + shield
- `components/steps/MixingStep.tsx` — replace timer with PPOI polling
- `components/steps/SendStep.tsx` — ZK proof generation + relayer broadcast
- `app/receive/page.tsx` — `deriveShieldedAddress()` → `getRailgunAddress()`

---

## Run locally

```bash
pnpm install
pnpm dev
```

No env vars required for the UI. Add `NEXT_PUBLIC_WC_PROJECT_ID` for WalletConnect support.

---

Built for personal use. Non-custodial, no backend, open source.
