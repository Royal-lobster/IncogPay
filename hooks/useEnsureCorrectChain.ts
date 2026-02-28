import { useAccount, useSwitchChain } from "wagmi";
import type { config } from "@/lib/wagmi";

type SupportedChainId = (typeof config)["chains"][number]["id"];

export const useEnsureCorrectChain = (chainId: SupportedChainId) => {
  const { chain } = useAccount();
  const { switchChainAsync, chains } = useSwitchChain();

  const ensureCorrectChain = async () => {
    if (chain?.id !== chainId) {
      const targetChain = chains.find((c) => c.id === chainId);
      if (!targetChain) {
        throw new Error("Target chain not supported by wallet");
      }
      await switchChainAsync({ chainId });
    }
  };

  return { ensureCorrectChain };
};
