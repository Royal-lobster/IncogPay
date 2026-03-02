/** Parse raw blockchain / SDK errors into short, actionable messages. */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  console.error("[IncogPay] Raw error:", msg);

  if (lower.includes("no broadcaster available"))
    return "No relayer available for this token right now. Try again in a moment or switch networks.";
  if (
    lower.includes("private balance not found after scanning") ||
    lower.includes("merkle tree may still be syncing")
  )
    return "Wallet is still syncing your private balance. Please wait a minute and try again.";
  if (lower.includes("balance too low") || lower.includes("broadcaster fee"))
    return "Balance too low to cover relayer fee. Ensure you have some ETH for gas and try again.";
  if (lower.includes("block number") || lower.includes("polling provider"))
    return "RPC connection failed. Please try again — the network provider may be temporarily overloaded.";
  if (lower.includes("transfer amount exceeds balance"))
    return "Insufficient token balance. Check you have enough funds in your wallet.";
  if (lower.includes("transfer amount exceeds allowance"))
    return "Token approval failed. Please try again.";
  if (lower.includes("insufficient funds"))
    return "Not enough ETH for gas. Add a small amount of native token to cover fees.";
  if (lower.includes("user rejected") || lower.includes("user denied"))
    return "Transaction rejected in wallet.";
  if (lower.includes("nonce")) return "Transaction conflict. Try again in a moment.";
  if (lower.includes("rpc") || lower.includes("timeout") || lower.includes("failed to fetch"))
    return "Network error. Check your connection and try again.";
  if (lower.includes("execution reverted"))
    return "Transaction would fail on-chain. Double-check your balance and try again.";

  const reason = msg.match(/reason="([^"]+)"/)?.[1];
  if (reason) return reason;

  return msg.length > 120 ? `${msg.slice(0, 117)}…` : msg;
}
