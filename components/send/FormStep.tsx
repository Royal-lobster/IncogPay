import { CaretDown, CircleNotch, ShieldCheck, Warning } from "@phosphor-icons/react";
import type { UseFormRegister } from "react-hook-form";
import { ChainIcon } from "@/components/ChainIcon";
import { TokenIcon } from "@/components/TokenIcon";
import type { SupportedChain } from "@/lib/wagmi";
import { SUPPORTED_CHAINS, TOKENS_BY_CHAIN } from "@/lib/wagmi";

type Token = { symbol: string; name: string; address: string; decimals: number };

export interface ExistingBalance {
  tokenAddress: string;
  amount: bigint;
  symbol: string;
}

interface FormStepProps {
  existingBalances: ExistingBalance[] | null;
  checkingBalances: boolean;
  formChain: SupportedChain;
  formToken: Token;
  formTokens: Token[];
  formNumeric: number;
  formFee: number;
  formReceive: number;
  chainOpen: boolean;
  setChainOpen: (v: boolean) => void;
  tokenOpen: boolean;
  setTokenOpen: (v: boolean) => void;
  handleChainChange: (c: SupportedChain) => void;
  onTokenChange: (t: Token) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerAmount: ReturnType<UseFormRegister<any>>;
  onSignAndCheck: () => void;
  onSkipToSend: (balance: ExistingBalance) => void;
}

export function FormStep({
  existingBalances,
  checkingBalances,
  formChain,
  formToken,
  formTokens,
  formNumeric,
  formFee,
  formReceive,
  chainOpen,
  setChainOpen,
  tokenOpen,
  setTokenOpen,
  handleChainChange,
  onTokenChange,
  registerAmount,
  onSignAndCheck,
  onSkipToSend,
}: FormStepProps) {
  return (
    <>
      {/* Existing private balance banner */}
      {existingBalances && existingBalances.length > 0 && (
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={13} weight="duotone" className="text-emerald-400 shrink-0" />
            <p className="text-xs font-medium text-emerald-300">
              You have private funds ready to send
            </p>
          </div>
          <div className="space-y-1">
            {existingBalances.map((b) => {
              const tokenInfo = TOKENS_BY_CHAIN[formChain.id].find(
                (t) => t.address === b.tokenAddress,
              );
              const decimals = tokenInfo?.decimals ?? 18;
              const display = (Number(b.amount) / 10 ** decimals).toFixed(2);
              return (
                <div key={b.tokenAddress} className="flex justify-between text-xs px-0.5">
                  <span className="text-zinc-400">{b.symbol}</span>
                  <span className="text-zinc-200 font-medium">{display}</span>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => onSkipToSend(existingBalances[0])}
            className="w-full py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
          >
            Skip to Send →
          </button>
        </div>
      )}

      {checkingBalances && (
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
          <CircleNotch size={12} className="animate-spin text-zinc-500 shrink-0" />
          <p className="text-xs text-zinc-500">Checking for existing private funds…</p>
        </div>
      )}

      {existingBalances !== null && existingBalances.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
          <ShieldCheck size={12} weight="duotone" className="text-zinc-600 shrink-0" />
          <p className="text-xs text-zinc-500">
            No private funds found. Proceed with a new deposit below.
          </p>
        </div>
      )}

      {existingBalances === null && !checkingBalances && (
        <button
          onClick={onSignAndCheck}
          className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/20 px-3 py-2.5 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors w-full"
        >
          <ShieldCheck size={12} weight="duotone" className="shrink-0" />
          Already shielded funds? Sign to check balance
        </button>
      )}

      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Enter Amount</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Choose a network, token, and how much to send.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        {/* Chain */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
          <span className="text-xs text-zinc-500">Network</span>
          <div className="relative">
            <button
              onClick={() => {
                setChainOpen(!chainOpen);
                setTokenOpen(false);
              }}
              className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 transition-colors"
            >
              <ChainIcon chainId={formChain.id} size={14} />
              {formChain.label}
              <CaretDown size={10} weight="bold" className="text-zinc-500" />
            </button>
            {chainOpen && (
              <div className="absolute right-0 top-full mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-30 overflow-hidden w-44">
                {SUPPORTED_CHAINS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleChainChange(c)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-800 transition-colors flex items-center gap-2.5 ${
                      c.id === formChain.id ? "text-pink-400" : "text-zinc-300"
                    }`}
                  >
                    <ChainIcon chainId={c.id} size={16} />
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Amount + token */}
        <div className="text-xs text-zinc-500 mb-2">Amount</div>
        <div className="flex items-center gap-3 mb-1">
          <input
            type="number"
            {...registerAmount}
            placeholder="0.00"
            className="min-w-0 flex-1 text-2xl font-semibold bg-transparent text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
            min="0"
          />
          <div className="relative shrink-0">
            <button
              onClick={() => {
                setTokenOpen(!tokenOpen);
                setChainOpen(false);
              }}
              className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 transition-colors"
            >
              <TokenIcon symbol={formToken.symbol} size={14} />
              {formToken.symbol}
              <CaretDown size={10} weight="bold" className="text-zinc-500" />
            </button>
            {tokenOpen && (
              <div className="absolute right-0 top-full mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-30 overflow-hidden w-32">
                {formTokens.map((t) => (
                  <button
                    key={t.symbol}
                    onClick={() => {
                      onTokenChange(t);
                      setTokenOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 transition-colors flex items-center gap-2.5 ${
                      t.symbol === formToken.symbol ? "text-pink-400" : "text-zinc-300"
                    }`}
                  >
                    <TokenIcon symbol={t.symbol} size={14} />
                    {t.symbol}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fee breakdown */}
        {formNumeric > 0 && (
          <div className="pt-3 mt-2 border-t border-zinc-800 space-y-1">
            <div className="flex justify-between text-xs text-zinc-600">
              <span>Protocol fee (0.25%)</span>
              <span>
                −{formFee.toFixed(2)} {formToken.symbol}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Recipient receives</span>
              <span className="text-zinc-100 font-medium">
                {formReceive.toFixed(2)} {formToken.symbol}
              </span>
            </div>
          </div>
        )}

        {/* Large amount warning */}
        {formNumeric >= 10000 && (
          <div className="flex gap-2 mt-3 rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2">
            <Warning size={12} weight="fill" className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400">
              Fee at this amount: <strong>${formFee.toFixed(0)}</strong>
            </p>
          </div>
        )}
      </div>
    </>
  );
}
