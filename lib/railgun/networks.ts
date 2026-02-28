import { NetworkName, TXIDVersion } from "@railgun-community/shared-models";
import { arbitrum, bsc, mainnet, polygon } from "wagmi/chains";

export const TXID_VERSION = TXIDVersion.V2_PoseidonMerkle;

export const CHAIN_TO_NETWORK: Record<number, NetworkName> = {
  [arbitrum.id]: NetworkName.Arbitrum,
  [mainnet.id]: NetworkName.Ethereum,
  [polygon.id]: NetworkName.Polygon,
  [bsc.id]: NetworkName.BNBChain,
};

export function getNetworkName(chainId: number): NetworkName {
  const network = CHAIN_TO_NETWORK[chainId];
  if (!network) throw new Error(`Unsupported chain: ${chainId}`);
  return network;
}
