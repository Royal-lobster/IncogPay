import { Clock, PaperPlaneTilt, ShieldCheck } from "@phosphor-icons/react";

const HOW_IT_WORKS = [
  { icon: ShieldCheck, text: "Approve and shield your funds into RAILGUN's private pool." },
  { icon: Clock, text: "Funds mix for ~1 hour while RAILGUN runs its on-chain privacy check." },
  {
    icon: PaperPlaneTilt,
    text: "Enter recipient, generate a ZK proof, and send via relayer. No ETH needed.",
  },
];

export function ConnectStep() {
  return (
    <>
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Connect Wallet</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Connect a Web3 wallet to get started. No transaction yet — just a connection.
        </p>
      </div>
      <ul className="space-y-2.5">
        {HOW_IT_WORKS.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3.5 py-3"
          >
            <item.icon size={13} weight="duotone" className="text-pink-400 mt-0.5 shrink-0" />
            <span className="text-xs text-zinc-400">{item.text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
