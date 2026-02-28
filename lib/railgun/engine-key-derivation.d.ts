/**
 * Type declarations for deep import of @railgun-community/engine key-derivation.
 *
 * The engine package's "exports" field only exposes ".", but we need
 * the key-derivation subpath for lightweight address derivation.
 * Webpack resolves the actual module (via exportsFields: [] in next.config.ts),
 * this declaration satisfies TypeScript's type checker.
 */
declare module "@railgun-community/engine/dist/key-derivation" {
  export type SpendingPublicKey = [bigint, bigint];

  export type SpendingKeyPair = {
    privateKey: Uint8Array;
    pubkey: SpendingPublicKey;
  };

  export type ViewingKeyPair = {
    privateKey: Uint8Array;
    pubkey: Uint8Array;
  };

  export type WalletNodes = {
    spending: WalletNode;
    viewing: WalletNode;
  };

  export type AddressData = {
    masterPublicKey: bigint;
    viewingPublicKey: Uint8Array;
    chain?: { type: number; id: number };
    version?: number;
  };

  export function deriveNodes(mnemonic: string, index?: number): WalletNodes;
  export function encodeAddress(addressData: AddressData): string;

  export class WalletNode {
    getSpendingKeyPair(): SpendingKeyPair;
    static getMasterPublicKey(
      spendingPublicKey: SpendingPublicKey,
      nullifyingKey: bigint,
    ): bigint;
    getViewingKeyPair(): Promise<ViewingKeyPair>;
    getNullifyingKey(): Promise<bigint>;
  }
}
