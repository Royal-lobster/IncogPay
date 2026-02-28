import Image from "next/image";

const CHAIN_LOGOS: Record<number, string> = {
  42161: "/chains/arbitrum.png",
  1: "/chains/ethereum.png",
  137: "/chains/polygon.png",
  56: "/chains/bnb.png",
};

export function ChainIcon({ chainId, size = 20 }: { chainId: number; size?: number }) {
  const src = CHAIN_LOGOS[chainId];
  if (!src)
    return <div style={{ width: size, height: size }} className="rounded-full bg-zinc-700" />;
  return (
    <Image src={src} alt={`chain-${chainId}`} width={size} height={size} className="rounded-full" />
  );
}
