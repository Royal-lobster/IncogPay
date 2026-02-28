"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowSquareOut,
  CaretDown,
  CheckCircle,
  CircleNotch,
  Clock,
  Ghost,
  PaperPlaneTilt,
  ShieldCheck,
  Wallet,
  Warning,
} from "@phosphor-icons/react";
import { defineStepper } from "@stepperize/react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { parseUnits } from "viem";
import {
  useAccount,
  useConnect,
  useSendTransaction,
  useSignMessage,
  useWriteContract,
} from "wagmi";
import { z } from "zod";
import { ChainIcon } from "@/components/ChainIcon";
import { TokenIcon } from "@/components/TokenIcon";
import { WalletConnectModal } from "@/components/WalletConnectModal";
import { WalletSwitcherModal } from "@/components/WalletSwitcherModal";
import {
  getCachedWallet,
  getOrCreateWallet,
  getShieldContractAddress,
  getShieldSignMessage,
  populateShieldTx,
  privateSend,
  SIGN_MESSAGE,
  waitForSpendable,
} from "@/lib/railgun";
import { SUPPORTED_CHAINS, type SupportedChain, TOKENS_BY_CHAIN } from "@/lib/wagmi";

// ─── stepper ──────────────────────────────────────────────────────────────────
const { useStepper } = defineStepper(
  { id: "connect" },
  { id: "form" },
  { id: "preflight" },
  { id: "shield" },
  { id: "mixing" },
  { id: "send" },
  { id: "done" },
);

// ─── form schema ──────────────────────────────────────────────────────────────
const tokenSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  address: z.string(),
  decimals: z.number(),
});

const sendFormSchema = z.object({
  chain: z.custom<SupportedChain>(),
  token: tokenSchema,
  amount: z.string().refine((v) => parseFloat(v) > 0, { message: "Amount must be positive" }),
});

type SendFormValues = z.infer<typeof sendFormSchema>;

// ─── constants ────────────────────────────────────────────────────────────────
const PROGRESS: ["shield", "mixing", "send"] = ["shield", "mixing", "send"];

const PROGRESS_META = {
  shield: {
    icon: ShieldCheck,
    label: "Shield funds",
    heading: "Shield Funds",
    sub: "Approve and deposit into RAILGUN's private pool.",
  },
  mixing: {
    icon: Clock,
    label: "Mixing",
    heading: "Mixing in Pool",
    sub: "ZK privacy check is running on-chain. Your funds are safe.",
  },
  send: {
    icon: PaperPlaneTilt,
    label: "Send",
    heading: "Confirm & Send",
    sub: "Generate a ZK proof and send via relayer. No ETH needed.",
  },
} as const;

const HOW_IT_WORKS = [
  { icon: ShieldCheck, text: "Approve and shield your funds into RAILGUN's private pool." },
  { icon: Clock, text: "Funds mix for ~1 hour while RAILGUN runs its on-chain privacy check." },
  {
    icon: PaperPlaneTilt,
    text: "Enter recipient, generate a ZK proof, and send via relayer. No ETH needed.",
  },
];

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

function fmtAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
// ─── component ────────────────────────────────────────────────────────────────
export default function SendPage() {
  const { isConnected, address } = useAccount();
  const { isPending: connectPending } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  // ── stepper
  const stepper = useStepper({ initialStep: isConnected ? "form" : "connect" });
  const phase = stepper.state.current.data.id;

  useEffect(() => {
    if (isConnected && phase === "connect") stepper.navigation.goTo("form");
  }, [isConnected]);

  // ── wallet modals
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // ── UI dropdowns
  const [chainOpen, setChainOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);

  // ── amount form (react-hook-form + zod)
  const form = useForm<SendFormValues>({
    resolver: zodResolver(sendFormSchema),
    defaultValues: {
      chain: SUPPORTED_CHAINS[0],
      token: TOKENS_BY_CHAIN[SUPPORTED_CHAINS[0].id][0],
      amount: "",
    },
  });

  const formChain = form.watch("chain");
  const formToken = form.watch("token");
  const formAmountStr = form.watch("amount");
  const formTokens = TOKENS_BY_CHAIN[formChain.id];
  const formNumeric = parseFloat(formAmountStr) || 0;
  const formFee = formNumeric * 0.0025;
  const formReceive = formNumeric - formFee;
  const formValid = form.formState.isValid;

  const handleChainChange = (c: SupportedChain) => {
    form.setValue("chain", c);
    form.setValue("token", TOKENS_BY_CHAIN[c.id][0]);
    setChainOpen(false);
  };

  // ── intent (locked in when advancing from form → preflight)
  const [intent, setIntent] = useState<{ amount: string; token: string } | null>(null);

  // ── shield mutation
  const [shieldSubPhase, setShieldSubPhase] = useState<"approving" | "shielding">("approving");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [mixingStartedAt, setMixingStartedAt] = useState<number | null>(null);

  const shieldMutation = useMutation({
    mutationFn: async () => {
      if (!intent || !address) throw new Error("Missing intent or wallet");

      const chainId = formChain.id;
      const tokenInfo = TOKENS_BY_CHAIN[chainId].find((t) => t.symbol === intent.token);
      if (!tokenInfo) throw new Error("Token not found");

      // 1. Sign message to derive RAILGUN wallet
      setShieldSubPhase("approving");
      const walletSig = await signMessageAsync({ message: SIGN_MESSAGE });
      const wallet = await getOrCreateWallet(walletSig);

      // 2. Sign shield private key message
      const shieldMsg = getShieldSignMessage();
      const shieldSig = await signMessageAsync({ message: shieldMsg });

      // 3. Approve ERC20 spending to the RAILGUN proxy contract
      const amount = parseUnits(intent.amount, tokenInfo.decimals);
      const proxyContract = getShieldContractAddress(chainId);

      await writeContractAsync({
        address: tokenInfo.address as `0x${string}`,
        abi: [
          {
            name: "approve",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ] as const,
        functionName: "approve",
        args: [proxyContract as `0x${string}`, amount],
      });

      // 4. Populate and send shield transaction
      setShieldSubPhase("shielding");
      const { transaction } = await populateShieldTx(
        chainId,
        shieldSig,
        tokenInfo.address,
        amount,
        wallet.railgunAddress,
        address, // fromWalletAddress (the user's public EOA)
      );

      const txHash = await sendTransactionAsync({
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}`,
        value: transaction.value ? BigInt(transaction.value.toString()) : BigInt(0),
      });

      return { txHash };
    },
    onSuccess: ({ txHash: hash }) => {
      setTxHash(hash);
      setMixingStartedAt(Date.now());
      stepper.navigation.goTo("mixing");
    },
  });

  // ── PPOI polling (replaces mixing timer)
  const [poiStatus, setPoiStatus] = useState<string>("Waiting for privacy verification...");

  useEffect(() => {
    if (phase !== "mixing") return;

    const wallet = getCachedWallet();
    if (!wallet) return;

    const abortController = new AbortController();

    waitForSpendable(
      formChain.id,
      wallet.walletId,
      (status) => setPoiStatus(status),
      30_000,
      abortController.signal,
    )
      .then(() => {
        stepper.navigation.goTo("send");
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("PPOI polling failed:", err);
        }
      });

    return () => abortController.abort();
  }, [phase]);

  // ── send mutation
  const [sendSubLabel, setSendSubLabel] = useState<"proving" | "broadcasting">("proving");
  const [recipient, setRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [proofProgress, setProofProgress] = useState(0);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!intent) throw new Error("No intent");

      const wallet = getCachedWallet();
      if (!wallet) throw new Error("RAILGUN wallet not initialized");

      const tokenInfo = TOKENS_BY_CHAIN[formChain.id].find((t) => t.symbol === intent.token);
      if (!tokenInfo) throw new Error("Token not found");

      const amount = parseUnits(sendAmount, tokenInfo.decimals);

      const result = await privateSend(
        formChain.id,
        wallet.walletId,
        wallet.encryptionKey,
        tokenInfo.address,
        amount,
        recipient,
        (phase, pct) => {
          if (phase.includes("proof")) {
            setSendSubLabel("proving");
            setProofProgress(pct ?? 0);
          } else if (phase.includes("Broadcasting")) {
            setSendSubLabel("broadcasting");
          }
        },
      );

      return result;
    },
    onSuccess: () => {
      setTimeout(() => stepper.navigation.goTo("done"), 600);
    },
  });

  const sendAvail = intent ? parseFloat(intent.amount) * (1 - 0.0025) : 0;
  const sendValid =
    recipient.startsWith("0x") &&
    recipient.length === 42 &&
    parseFloat(sendAmount) > 0 &&
    parseFloat(sendAmount) <= sendAvail;

  // ── progress helpers
  const isProgress = (PROGRESS as string[]).includes(phase);
  const progressIdx = PROGRESS.indexOf(phase as (typeof PROGRESS)[number]);

  const shieldButtonLabel = shieldMutation.isPending
    ? shieldSubPhase === "approving"
      ? "Approve in wallet…"
      : "Shielding funds…"
    : shieldMutation.isError
      ? "Try again"
      : "Deposit into pool";

  const sendButtonLabel = sendMutation.isPending
    ? sendSubLabel === "proving"
      ? "Generating ZK proof…"
      : "Broadcasting…"
    : sendMutation.isSuccess
      ? "Sent"
      : sendMutation.isError
        ? "Try again"
        : "Confirm Send";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <main className="h-[100dvh] overflow-hidden flex flex-col justify-center bg-[#0a0a0a] px-5 py-5 relative">
        {/* ambient glows */}
        <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-pink-500 opacity-[0.05] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-violet-500 opacity-[0.05] blur-3xl" />

        <div className="w-full max-w-md mx-auto">
          {/* Top nav */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <ArrowLeft size={12} weight="bold" />
              Back
            </Link>
            {isConnected && address && (
              <button
                onClick={() => setSwitcherOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="font-mono">{fmtAddr(address)}</span>
                <CaretDown size={9} weight="bold" className="text-zinc-600" />
              </button>
            )}
          </div>

          {/* ── Fixed card ── */}
          <div className="h-[520px] max-h-[calc(100dvh-88px)] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
            {/* gradient accent */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-pink-500/40 to-transparent shrink-0" />

            {/* ── Permanent card header ── */}
            <div className="shrink-0 px-5 pt-4 pb-4 border-b border-zinc-800/60">
              {phase !== "done" ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 ring-1 ring-pink-500/20">
                    <Ghost size={18} weight="duotone" className="text-pink-400" />
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold text-zinc-100">Send Privately</h1>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      The recipient only sees the RAILGUN relayer — not your wallet.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    <CheckCircle size={18} weight="duotone" className="text-emerald-400" />
                  </div>
                  <h1 className="text-sm font-semibold text-zinc-100">Transfer complete</h1>
                </div>
              )}
            </div>

            {/* ── Card body — scrollable ── */}
            <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3">
              {/* ── connect ── */}
              {phase === "connect" && (
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
                        <item.icon
                          size={13}
                          weight="duotone"
                          className="text-pink-400 mt-0.5 shrink-0"
                        />
                        <span className="text-xs text-zinc-400">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* ── form ── */}
              {phase === "form" && (
                <>
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
                                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-800 transition-colors flex items-center gap-2.5 ${c.id === formChain.id ? "text-pink-400" : "text-zinc-300"}`}
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
                        {...form.register("amount")}
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
                                  form.setValue("token", t);
                                  setTokenOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 transition-colors flex items-center gap-2.5 ${t.symbol === formToken.symbol ? "text-pink-400" : "text-zinc-300"}`}
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
                        <Warning
                          size={12}
                          weight="fill"
                          className="text-amber-400 mt-0.5 shrink-0"
                        />
                        <p className="text-xs text-amber-400">
                          Fee at this amount: <strong>${formFee.toFixed(0)}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── preflight ── */}
              {phase === "preflight" && (
                <>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">What to expect</h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      Three steps to send privately. You can cancel at any point.
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {PREFLIGHT_STEPS.map((s, i) => (
                      <li
                        key={i}
                        className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
                      >
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
                    <ArrowCounterClockwise
                      size={12}
                      weight="bold"
                      className="text-zinc-600 mt-0.5 shrink-0"
                    />
                    <p className="text-xs text-zinc-500">
                      Cancel at any step. Funds return minus gas (~$0.10–$3).
                    </p>
                  </div>
                </>
              )}

              {/* ── progress tracker (shield / mixing / send) ── */}
              {isProgress && (
                <div className="flex items-center gap-1.5">
                  {PROGRESS.map((s, i) => {
                    const active = phase === s;
                    const done = progressIdx > i;
                    const meta = PROGRESS_META[s];
                    return (
                      <div key={s} className="flex items-center gap-1.5">
                        {i > 0 && (
                          <div
                            className={`w-4 h-px shrink-0 ${done ? "bg-pink-500" : "bg-zinc-800"}`}
                          />
                        )}
                        <div
                          className={`flex items-center gap-1 ${active ? "text-pink-400" : done ? "text-zinc-600" : "text-zinc-700"}`}
                        >
                          <meta.icon size={11} weight={active ? "duotone" : "regular"} />
                          <span className="text-[10px] font-medium">{meta.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── shield ── */}
              {phase === "shield" && intent && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 ring-1 ring-pink-500/20">
                      <ShieldCheck size={17} weight="duotone" className="text-pink-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-100">
                        {PROGRESS_META.shield.heading}
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">{PROGRESS_META.shield.sub}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">You deposit</span>
                      <span className="text-zinc-100 font-medium">
                        {intent.amount} {intent.token}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-600">
                      <span>Protocol fee (0.25%)</span>
                      <span>
                        −{(parseFloat(intent.amount) * 0.0025).toFixed(2)} {intent.token}
                      </span>
                    </div>
                    <div className="h-px bg-zinc-800" />
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Private balance</span>
                      <span className="text-emerald-400 font-medium">
                        +{(parseFloat(intent.amount) * 0.9975).toFixed(2)} {intent.token}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 px-3 py-2.5">
                    <p className="text-xs text-zinc-500">
                      You'll also need a small amount of native token for gas (~$0.10).
                    </p>
                  </div>
                  {shieldMutation.isError && (
                    <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-3 py-2.5">
                      <p className="text-xs text-red-400">
                        {shieldMutation.error instanceof Error
                          ? shieldMutation.error.message
                          : "Transaction failed"}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ── mixing ── */}
              {phase === "mixing" && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 ring-1 ring-pink-500/20">
                      <Clock size={17} weight="duotone" className="text-pink-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-100">
                        {PROGRESS_META.mixing.heading}
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">{PROGRESS_META.mixing.sub}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                    <div className="flex items-center gap-3">
                      <CircleNotch size={16} className="animate-spin text-pink-400 shrink-0" />
                      <div>
                        <p className="text-sm text-zinc-300">{poiStatus}</p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          This typically takes a few minutes
                        </p>
                      </div>
                    </div>
                  </div>
                  {txHash && (
                    <a
                      href={`https://arbiscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-pink-400 transition-colors"
                    >
                      <ArrowSquareOut size={12} weight="bold" />
                      View deposit on explorer
                    </a>
                  )}
                  <div className="rounded-xl border border-zinc-800 px-3 py-2.5">
                    <p className="text-xs text-zinc-500">
                      You can close this tab and come back — progress is saved locally.
                    </p>
                  </div>
                </>
              )}

              {/* ── send ── */}
              {phase === "send" && intent && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 ring-1 ring-pink-500/20">
                      <PaperPlaneTilt size={17} weight="duotone" className="text-pink-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-100">
                        {PROGRESS_META.send.heading}
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">{PROGRESS_META.send.sub}</p>
                    </div>
                  </div>
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
                    <ShieldCheck
                      size={12}
                      weight="duotone"
                      className="text-emerald-400 mt-0.5 shrink-0"
                    />
                    <p className="text-xs text-zinc-500">
                      Recipient sees funds from the RAILGUN relayer — not your wallet.
                    </p>
                  </div>
                  {sendMutation.isError && (
                    <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-3 py-2.5">
                      <p className="text-xs text-red-400">
                        {sendMutation.error instanceof Error
                          ? sendMutation.error.message
                          : "Send failed"}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ── done ── */}
              {phase === "done" && (
                <div className="flex flex-col items-center justify-center h-full text-center py-6">
                  <p className="text-sm text-zinc-400 max-w-xs">
                    Funds sent privately. Recipient's on-chain view shows only the RAILGUN relayer
                    address.
                  </p>
                </div>
              )}
            </div>

            {/* ── Card footer — pinned CTAs ── */}
            <div className="shrink-0 border-t border-zinc-800/60 px-5 py-4">
              {/* connect */}
              {phase === "connect" && (
                <button
                  onClick={() => setWalletModalOpen(true)}
                  disabled={connectPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  <Wallet size={14} weight="duotone" />
                  Connect Wallet
                </button>
              )}

              {/* form */}
              {phase === "form" && (
                <div className="flex gap-3">
                  <button
                    onClick={() => stepper.navigation.goTo("connect")}
                    className="flex-1 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (formValid) {
                        setIntent({ amount: formAmountStr, token: formToken.symbol });
                        stepper.navigation.goTo("preflight");
                      }
                    }}
                    disabled={!formValid}
                    className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors ${formValid ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
                  >
                    Continue →
                  </button>
                </div>
              )}

              {/* preflight */}
              {phase === "preflight" && (
                <div className="flex gap-3">
                  <button
                    onClick={() => stepper.navigation.goTo("form")}
                    className="flex-1 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => stepper.navigation.goTo("shield")}
                    className="flex-1 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors"
                  >
                    Start →
                  </button>
                </div>
              )}

              {/* shield */}
              {phase === "shield" && (
                <button
                  onClick={() => shieldMutation.mutate()}
                  disabled={shieldMutation.isPending}
                  className={`w-full py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${shieldMutation.isPending ? "bg-pink-950 text-pink-400 cursor-not-allowed" : "bg-white text-black hover:bg-zinc-200"}`}
                >
                  {shieldMutation.isPending && <CircleNotch size={13} className="animate-spin" />}
                  {shieldButtonLabel}
                </button>
              )}

              {/* mixing */}
              {phase === "mixing" && (
                <button
                  onClick={() => stepper.navigation.goTo("form")}
                  className="w-full text-xs text-zinc-600 hover:text-red-400 transition-colors py-1"
                >
                  Cancel &amp; return funds to wallet
                </button>
              )}

              {/* send */}
              {phase === "send" && (
                <>
                  <button
                    onClick={() => sendMutation.mutate()}
                    disabled={!sendValid || sendMutation.isPending}
                    className={`w-full py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${!sendValid || sendMutation.isPending ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-white text-black hover:bg-zinc-200"}`}
                  >
                    {sendMutation.isPending && <CircleNotch size={13} className="animate-spin" />}
                    {sendButtonLabel}
                  </button>
                  {sendMutation.isPending && sendSubLabel === "proving" && (
                    <p className="text-center text-[11px] text-zinc-600 mt-1.5">
                      Generating ZK proof… {proofProgress}%
                    </p>
                  )}
                </>
              )}

              {/* done */}
              {phase === "done" && (
                <Link
                  href="/"
                  className="block w-full py-2.5 rounded-full border border-zinc-700 text-sm text-center text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
                >
                  Done
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>

      <WalletConnectModal open={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
      {switcherOpen && <WalletSwitcherModal onClose={() => setSwitcherOpen(false)} />}
    </>
  );
}
