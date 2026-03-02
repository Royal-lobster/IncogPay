"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CaretDown,
  CheckCircle,
  CircleNotch,
  Clock,
  Ghost,
  PaperPlaneTilt,
  ShieldCheck,
  Wallet,
} from "@phosphor-icons/react";
import { defineStepper } from "@stepperize/react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
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
import { ConnectStep } from "@/components/send/ConnectStep";
import { DoneStep } from "@/components/send/DoneStep";
import { type ExistingBalance, FormStep } from "@/components/send/FormStep";
import { MixingStep } from "@/components/send/MixingStep";
import { PreflightStep } from "@/components/send/PreflightStep";
import { SendStep } from "@/components/send/SendStep";
import { ShieldStep } from "@/components/send/ShieldStep";
import { WalletConnectModal } from "@/components/WalletConnectModal";
import { WalletSwitcherModal } from "@/components/WalletSwitcherModal";
import {
  getCachedWallet,
  getOrCreateWallet,
  getShieldContractAddress,
  getShieldSignMessage,
  getSpendableBalances,
  populateShieldTx,
  privateSend,
  SIGN_MESSAGE,
  waitForSpendable,
} from "@/lib/railgun";
import { clearSendFlow, loadSendFlow, saveSendFlow } from "@/lib/send-flow-storage";
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

function fmtAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// ─── component ────────────────────────────────────────────────────────────────
export default function SendPage() {
  return (
    <Suspense>
      <SendPageInner />
    </Suspense>
  );
}

function SendPageInner() {
  const { isConnected, address } = useAccount();
  const { isPending: connectPending } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  // ── hydration guard: defer client-only state to avoid SSR mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── URL query params (from receive page share links)
  const searchParams = useSearchParams();

  // ── stepper
  const stepper = useStepper({ initialStep: "connect" });
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

  // ── recipient (declared early so URL prefill can set it)
  const [recipient, setRecipient] = useState("");

  // ── populate form from URL query params (receive link)
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current) return;
    const qTo = searchParams.get("to");
    const qChain = searchParams.get("chain");
    const qToken = searchParams.get("token");
    const qAmount = searchParams.get("amount");

    if (!qTo && !qChain && !qToken && !qAmount) return;
    prefilled.current = true;

    if (qChain) {
      const chainId = parseInt(qChain, 10);
      const matched = SUPPORTED_CHAINS.find((c) => c.id === chainId);
      if (matched) {
        form.setValue("chain", matched);
        if (qToken) {
          const matchedToken = TOKENS_BY_CHAIN[matched.id].find(
            (t) => t.symbol.toLowerCase() === qToken.toLowerCase(),
          );
          if (matchedToken) form.setValue("token", matchedToken);
        }
      }
    }

    if (qAmount) form.setValue("amount", qAmount);
    if (qTo) setRecipient(qTo);
  }, [searchParams]);

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

  const handleTokenChange = (t: typeof formToken) => {
    form.setValue("token", t);
  };

  const handleSkipToSend = (balance: ExistingBalance) => {
    const tokenInfo = TOKENS_BY_CHAIN[formChain.id].find((t) => t.address === balance.tokenAddress);
    if (tokenInfo) {
      const amount = (Number(balance.amount) / 10 ** tokenInfo.decimals).toFixed(2);
      setIntent({ amount, token: tokenInfo.symbol });
      form.setValue("token", tokenInfo);
      form.setValue("amount", amount);
    }
    stepper.navigation.goTo("send");
  };

  const handleSignAndCheck = async () => {
    try {
      const sig = await signMessageAsync({ message: SIGN_MESSAGE });
      await getOrCreateWallet(sig);
      await checkExistingBalances();
    } catch {
      // User rejected sign or check failed — ignore
    }
  };

  // ── intent (locked in when advancing from form → preflight)
  const [intent, setIntent] = useState<{ amount: string; token: string } | null>(null);

  // ── shield mutation
  const [shieldSubPhase, setShieldSubPhase] = useState<"approving" | "shielding">("approving");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [mixingStartedAt, setMixingStartedAt] = useState<number | null>(null);
  const [needsResign, setNeedsResign] = useState(false);
  const [existingBalances, setExistingBalances] = useState<ExistingBalance[] | null>(null);
  const [checkingBalances, setCheckingBalances] = useState(false);

  // ── send state (declared early so persist effect can reference them)
  const [sendSubLabel, setSendSubLabel] = useState<"proving" | "broadcasting">("proving");
  const [sendAmount, setSendAmount] = useState("");
  const [proofProgress, setProofProgress] = useState(0);

  // ── restore persisted send flow on mount
  useEffect(() => {
    if (!mounted || !isConnected) return;

    const saved = loadSendFlow();
    if (!saved) return;

    // Restore chain
    const chain = SUPPORTED_CHAINS.find((c) => c.id === saved.chainId);
    if (!chain) {
      clearSendFlow();
      return;
    }

    // Restore form values
    form.setValue("chain", chain);
    const token = TOKENS_BY_CHAIN[chain.id].find((t) => t.symbol === saved.intent.token);
    if (token) form.setValue("token", token);
    form.setValue("amount", saved.intent.amount);

    // Restore flow state
    setIntent(saved.intent);
    setTxHash(saved.txHash);
    setMixingStartedAt(saved.mixingStartedAt);
    setRecipient(saved.recipient);
    setSendAmount(saved.sendAmount);

    // Navigate to saved phase
    stepper.navigation.goTo(saved.phase);

    // If mixing or send phase, wallet encryption key is lost on refresh — need re-sign
    if ((saved.phase === "mixing" || saved.phase === "send") && !getCachedWallet()) {
      setNeedsResign(true);
    }
  }, [mounted, isConnected]);

  // ── persist flow state on change
  useEffect(() => {
    if (!intent) return;
    saveSendFlow({
      phase: phase as "shield" | "mixing" | "send",
      intent,
      chainId: formChain.id,
      txHash,
      mixingStartedAt,
      recipient,
      sendAmount,
    });
  }, [phase, intent, txHash, mixingStartedAt, recipient, sendAmount, formChain.id]);

  // ── check for existing spendable balances (after signing to resume or fresh connect)
  const checkExistingBalances = async () => {
    const wallet = getCachedWallet();
    if (!wallet) {
      console.warn("[IncogPay] checkExistingBalances: no cached wallet");
      setExistingBalances([]);
      return;
    }

    setCheckingBalances(true);
    try {
      const tokens = TOKENS_BY_CHAIN[formChain.id];
      const balances = await getSpendableBalances(
        formChain.id,
        wallet.walletId,
        tokens.map((t) => t.address),
      );

      setExistingBalances(
        balances.map((b) => ({
          ...b,
          symbol: tokens.find((t) => t.address === b.tokenAddress)?.symbol ?? "???",
        })),
      );
    } catch (err) {
      console.error("[IncogPay] checkExistingBalances failed:", err);
      setExistingBalances([]);
    } finally {
      setCheckingBalances(false);
    }
  };

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
    if (phase !== "mixing" || needsResign) return;

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
  }, [phase, needsResign]);

  // ── send mutation
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
          } else if (phase.includes("Broadcasting") || phase.includes("relayer")) {
            setSendSubLabel("broadcasting");
          } else if (phase.includes("Sign in wallet")) {
            setSendSubLabel("broadcasting");
          }
        },
      );

      // Self-relay: no broadcaster found, user's wallet submits the tx directly
      if (result.selfRelayTx) {
        setSendSubLabel("broadcasting");
        const hash = await sendTransactionAsync({
          to: result.selfRelayTx.to as `0x${string}`,
          data: result.selfRelayTx.data,
          gas: result.selfRelayTx.gasLimit,
        });
        return { txHash: hash };
      }

      return result;
    },
    onSuccess: () => {
      clearSendFlow();
      setTimeout(() => stepper.navigation.goTo("done"), 600);
    },
  });

  const sendAvailRaw = intent ? parseFloat(intent.amount) * (1 - 0.0025) : 0;
  // Floor to 2 decimals so the displayed "Available" matches what validation accepts
  const sendAvail = Math.floor(sendAvailRaw * 100) / 100;
  const isValidRecipient =
    (recipient.startsWith("0x") && recipient.length === 42) ||
    recipient.startsWith("0zk");
  const sendValid =
    isValidRecipient &&
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
            {mounted && isConnected && address && (
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
              {phase === "connect" && <ConnectStep />}

              {/* ── form ── */}
              {phase === "form" && (
                <FormStep
                  existingBalances={existingBalances}
                  checkingBalances={checkingBalances}
                  formChain={formChain}
                  formToken={formToken}
                  formTokens={formTokens}
                  formNumeric={formNumeric}
                  formFee={formFee}
                  formReceive={formReceive}
                  chainOpen={chainOpen}
                  setChainOpen={setChainOpen}
                  tokenOpen={tokenOpen}
                  setTokenOpen={setTokenOpen}
                  handleChainChange={handleChainChange}
                  onTokenChange={handleTokenChange}
                  registerAmount={form.register("amount")}
                  onSignAndCheck={handleSignAndCheck}
                  onSkipToSend={handleSkipToSend}
                />
              )}

              {/* ── preflight ── */}
              {phase === "preflight" && <PreflightStep />}

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
                <ShieldStep
                  intent={intent}
                  error={shieldMutation.isError ? shieldMutation.error : undefined}
                />
              )}

              {/* ── mixing ── */}
              {phase === "mixing" && (
                <MixingStep
                  needsResign={needsResign}
                  poiStatus={poiStatus}
                  txHash={txHash}
                  formChain={formChain}
                />
              )}

              {/* ── send ── */}
              {phase === "send" && intent && (
                <SendStep
                  intent={intent}
                  needsResign={needsResign}
                  sendAvail={sendAvail}
                  recipient={recipient}
                  setRecipient={setRecipient}
                  sendAmount={sendAmount}
                  setSendAmount={setSendAmount}
                  isError={sendMutation.isError}
                  error={sendMutation.isError ? sendMutation.error : undefined}
                />
              )}

              {/* ── done ── */}
              {phase === "done" && <DoneStep />}
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
                    onClick={() => {
                      clearSendFlow();
                      stepper.navigation.goTo("connect");
                    }}
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
                needsResign ? (
                  <button
                    onClick={async () => {
                      const sig = await signMessageAsync({ message: SIGN_MESSAGE });
                      await getOrCreateWallet(sig);
                      setNeedsResign(false);
                    }}
                    className="w-full py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Wallet size={14} weight="duotone" />
                    Sign to Resume
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      clearSendFlow();
                      stepper.navigation.goTo("form");
                    }}
                    className="w-full text-xs text-zinc-600 hover:text-red-400 transition-colors py-1"
                  >
                    Cancel &amp; return funds to wallet
                  </button>
                )
              )}

              {/* send */}
              {phase === "send" && (
                needsResign ? (
                  <button
                    onClick={async () => {
                      const sig = await signMessageAsync({ message: SIGN_MESSAGE });
                      await getOrCreateWallet(sig);
                      setNeedsResign(false);
                    }}
                    className="w-full py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Wallet size={14} weight="duotone" />
                    Sign to Resume
                  </button>
                ) : (
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
                )
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
