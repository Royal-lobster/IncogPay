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
}

export interface BroadcasterInfo {
  railgunAddress: string;
  tokenAddress: string;
  feePerUnitGas: bigint;
  feesID: string;
}
