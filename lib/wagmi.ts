import { createConfig, http } from "wagmi";
import { arbitrum } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const config = createConfig({
  chains: [arbitrum],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "ghostpay",
    }),
  ],
  transports: {
    [arbitrum.id]: http(),
  },
});

export const SUPPORTED_TOKENS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether",
    address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    decimals: 6,
  },
  {
    symbol: "WETH",
    name: "Wrapped ETH",
    address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    decimals: 18,
  },
] as const;

export type SupportedToken = (typeof SUPPORTED_TOKENS)[number];
