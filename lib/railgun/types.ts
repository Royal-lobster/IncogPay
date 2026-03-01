export interface RailgunWalletState {
  walletId: string;
  railgunAddress: string;
  encryptionKey: string;
}

export interface ShieldResult {
  txHash: string;
}

export interface SendResult {
  txHash: string;
  /** Present when no broadcaster was found — caller must submit this tx via user's wallet. */
  selfRelayTx?: {
    to: string;
    data: `0x${string}`;
    gasLimit: bigint;
  };
}

export interface BroadcasterInfo {
  railgunAddress: string;
  tokenAddress: string;
  feePerUnitGas: bigint;
  feesID: string;
}
