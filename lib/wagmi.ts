import { createConfig, http } from "wagmi";
import { arbitrum, bsc, mainnet, polygon } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const SUPPORTED_CHAINS = [
  { ...arbitrum, label: "Arbitrum" },
  { ...mainnet, label: "Ethereum" },
  { ...polygon, label: "Polygon" },
  { ...bsc, label: "BNB Chain" },
] as const;

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

export const TOKENS_BY_CHAIN: Record<
  number,
  { symbol: string; name: string; address: string; decimals: number }[]
> = {
  [arbitrum.id]: [
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
  ],
  [mainnet.id]: [
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      decimals: 6,
    },
    {
      symbol: "USDT",
      name: "Tether",
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      decimals: 6,
    },
    {
      symbol: "DAI",
      name: "Dai",
      address: "0x6b175474e89094c44da98b954eedeac495271d0f",
      decimals: 18,
    },
    {
      symbol: "WETH",
      name: "Wrapped ETH",
      address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      decimals: 18,
    },
  ],
  [polygon.id]: [
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
      decimals: 6,
    },
    {
      symbol: "USDT",
      name: "Tether",
      address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
      decimals: 6,
    },
    {
      symbol: "WETH",
      name: "Wrapped ETH",
      address: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
      decimals: 18,
    },
  ],
  [bsc.id]: [
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      decimals: 18,
    },
    {
      symbol: "USDT",
      name: "Tether",
      address: "0x55d398326f99059ff775485246999027b3197955",
      decimals: 18,
    },
    {
      symbol: "WBNB",
      name: "Wrapped BNB",
      address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
      decimals: 18,
    },
  ],
};

export const config = createConfig({
  chains: [arbitrum, mainnet, polygon, bsc],
  connectors: [
    injected(),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "incogpay" }),
  ],
  transports: {
    [arbitrum.id]: http(),
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
  },
});
