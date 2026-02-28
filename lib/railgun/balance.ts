import { NETWORK_CONFIG } from "@railgun-community/shared-models";
import { balanceForERC20Token, refreshBalances, walletForID } from "@railgun-community/wallet";
import { ensureProvider } from "./init";
import { getNetworkName, TXID_VERSION } from "./networks";

export interface TokenBalance {
  tokenAddress: string;
  amount: bigint;
}

/**
 * Check spendable private balances for a list of token addresses.
 * Refreshes the merkle tree first, then queries each token.
 */
export async function getSpendableBalances(
  chainId: number,
  walletId: string,
  tokenAddresses: string[],
): Promise<TokenBalance[]> {
  const networkName = getNetworkName(chainId);
  await ensureProvider(networkName);
  const { chain } = NETWORK_CONFIG[networkName];

  const wallet = walletForID(walletId);

  // Trigger merkle-tree scan so balances are current
  await refreshBalances(chain, [walletId]).catch(() => {});

  const results: TokenBalance[] = [];
  for (const tokenAddress of tokenAddresses) {
    try {
      const amount = await balanceForERC20Token(
        TXID_VERSION,
        wallet,
        networkName,
        tokenAddress,
        true, // onlySpendable
      );
      if (amount > BigInt(0)) {
        results.push({ tokenAddress, amount });
      }
    } catch {
      // Token not found or query failed — skip
    }
  }

  return results;
}
