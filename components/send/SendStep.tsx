import { ShieldCheck, Wallet } from "@phosphor-icons/react";
import { friendlyError } from "./utils";

interface SendStepProps {
  intent: { amount: string; token: string };
  needsResign: boolean;
  sendAvail: number;
  recipient: string;
  setRecipient: (v: string) => void;
  sendAmount: string;
  setSendAmount: (v: string) => void;
  isError: boolean;
  error?: unknown;
}

export function SendStep({
  intent,
  needsResign,
  sendAvail,
  recipient,
  setRecipient,
  sendAmount,
  setSendAmount,
  isError,
  error,
}: SendStepProps) {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 ring-1 ring-pink-500/20">
          <ShieldCheck size={17} weight="duotone" className="text-pink-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Confirm &amp; Send</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Generate a ZK proof and send via relayer. No ETH needed.
          </p>
        </div>
      </div>

      {needsResign ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-3">
            <Wallet size={16} weight="duotone" className="text-pink-400 shrink-0" />
            <div>
              <p className="text-sm text-zinc-300">Session restored</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                Sign to unlock your private wallet and continue sending.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between text-xs px-0.5">
            <span className="text-zinc-600">Available</span>
            <span className="text-zinc-400">
              {sendAvail.toFixed(2)} {intent.token}
            </span>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="px-4 pt-3.5 pb-3 border-b border-zinc-800/60">
              <div className="text-xs text-zinc-500 mb-1.5">Recipient address</div>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x…"
                className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none font-mono"
              />
            </div>
            <div className="px-4 pt-3 pb-3.5">
              <div className="text-xs text-zinc-500 mb-1.5">Amount</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  max={sendAvail}
                  min={0}
                  className="flex-1 bg-transparent text-xl font-semibold text-zinc-100 focus:outline-none"
                />
                <span className="text-xs text-zinc-500">{intent.token}</span>
                <button
                  onClick={() => setSendAmount(sendAvail.toFixed(2))}
                  className="text-[10px] font-medium text-pink-400 border border-pink-500/30 rounded-full px-2 py-1 hover:bg-pink-500/10 transition-colors uppercase tracking-widest"
                >
                  Max
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
            <ShieldCheck size={12} weight="duotone" className="text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-zinc-500">
              Recipient sees funds from the RAILGUN relayer — not your wallet.
            </p>
          </div>

          {isError && error !== undefined && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-3 py-2.5">
              <p className="text-xs text-red-400">{friendlyError(error)}</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
