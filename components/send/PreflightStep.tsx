import { ArrowCounterClockwise, Clock, PaperPlaneTilt, Wallet } from "@phosphor-icons/react";

const PREFLIGHT_STEPS = [
  {
    icon: Wallet,
    role: "Step 1",
    title: "Deposit into private pool",
    desc: "Approve + shield your funds. You'll need a tiny amount of gas (~$0.10).",
    time: "~2 min",
  },
  {
    icon: Clock,
    role: "Step 2",
    title: "Funds mix in pool",
    desc: "RAILGUN runs an on-chain privacy check. Funds are safe — cancel anytime.",
    time: "~1 hour",
  },
  {
    icon: PaperPlaneTilt,
    role: "Step 3",
    title: "Enter recipient & send",
    desc: "Confirm the destination. No native token needed — relayer handles gas.",
    time: "~1 min",
  },
];

export function PreflightStep() {
  return (
    <>
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">What to expect</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Three steps to send privately. You can cancel at any point.
        </p>
      </div>
      <ul className="space-y-2">
        {PREFLIGHT_STEPS.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 ring-1 ring-pink-500/20">
              <s.icon size={13} weight="duotone" className="text-pink-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between mb-0.5">
                <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                  {s.role}
                </span>
                <span className="text-[10px] text-zinc-600">{s.time}</span>
              </div>
              <p className="text-xs font-medium text-zinc-200 mb-0.5">{s.title}</p>
              <p className="text-xs text-zinc-500">{s.desc}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex gap-2.5 rounded-xl border border-zinc-800 px-3 py-2.5">
        <ArrowCounterClockwise size={12} weight="bold" className="text-zinc-600 mt-0.5 shrink-0" />
        <p className="text-xs text-zinc-500">
          Cancel at any step. Funds return minus gas (~$0.10–$3).
        </p>
      </div>
    </>
  );
}
