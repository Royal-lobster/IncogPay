import Image from "next/image";

const TOKEN_LOGOS: Record<string, string> = {
  USDC: "/tokens/usdc.png",
  USDT: "/tokens/usdt.png",
  DAI:  "/tokens/dai.png",
  WETH: "/tokens/weth.png",
  WBNB: "/tokens/wbnb.png",
};

export function TokenIcon({ symbol, size = 18 }: { symbol: string; size?: number }) {
  const src = TOKEN_LOGOS[symbol];
  if (!src) return <div style={{ width: size, height: size }} className="rounded-full bg-zinc-700" />;
  return (
    <Image
      src={src}
      alt={symbol}
      width={size}
      height={size}
      className="rounded-full"
    />
  );
}
