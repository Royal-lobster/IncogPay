/**
 * Minimal type declarations for snarkjs (no official @types package).
 * Only the groth16 prover interface is declared — used by RAILGUN SDK.
 */
declare module "snarkjs" {
  export const groth16: {
    fullProve: (
      input: Record<string, unknown>,
      wasm: ArrayLike<number> | null,
      zkey: ArrayLike<number>,
      logger?: { debug: (log: string) => void },
    ) => Promise<{ proof: unknown; publicSignals: string[] }>;
    verify?: (
      vkey: object,
      publicSignals: unknown[],
      proof: unknown,
    ) => Promise<boolean>;
  };
}
