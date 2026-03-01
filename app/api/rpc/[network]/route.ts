import { NextRequest, NextResponse } from "next/server";

/**
 * RPC proxy — forwards JSON-RPC requests to the actual chain RPC.
 * This avoids CORS issues since the browser calls our own origin.
 */

const RPC_TARGETS: Record<string, string[]> = {
  arbitrum: [
    "https://arb1.arbitrum.io/rpc",
    "https://rpc.ankr.com/arbitrum",
    "https://arbitrum-one.publicnode.com",
  ],
  ethereum: [
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com/eth",
    "https://ethereum-rpc.publicnode.com",
  ],
  polygon: [
    "https://polygon-rpc.com",
    "https://rpc.ankr.com/polygon",
    "https://polygon-bor-rpc.publicnode.com",
  ],
  bnb: [
    "https://bsc-dataseed.binance.org",
    "https://rpc.ankr.com/bsc",
    "https://bsc-rpc.publicnode.com",
  ],
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ network: string }> },
) {
  const { network } = await params;
  const targets = RPC_TARGETS[network];
  if (!targets) {
    return NextResponse.json({ error: "Unknown network" }, { status: 400 });
  }

  const body = await req.text();

  // Try each RPC in order until one succeeds
  for (let i = 0; i < targets.length; i++) {
    try {
      const res = await fetch(targets[i], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) continue;

      const data = await res.text();
      return new NextResponse(data, {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Try next RPC
      continue;
    }
  }

  return NextResponse.json(
    { error: "All upstream RPCs failed" },
    { status: 502 },
  );
}
