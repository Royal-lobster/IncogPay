const STORAGE_KEY = "incogpay-send-flow";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PersistedSendFlow {
  version: 1;
  phase: "shield" | "mixing" | "send";
  intent: { amount: string; token: string };
  chainId: number;
  txHash: string | null;
  mixingStartedAt: number | null;
  recipient: string;
  sendAmount: string;
  savedAt: number;
}

export function saveSendFlow(data: Omit<PersistedSendFlow, "version" | "savedAt">): void {
  const persistable: PersistedSendFlow["phase"][] = ["shield", "mixing", "send"];
  if (!persistable.includes(data.phase)) return;

  const entry: PersistedSendFlow = { ...data, version: 1, savedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function loadSendFlow(): PersistedSendFlow | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data: PersistedSendFlow = JSON.parse(raw);

    // Schema validation
    if (
      data.version !== 1 ||
      !["shield", "mixing", "send"].includes(data.phase) ||
      !data.intent?.amount ||
      !data.intent?.token ||
      typeof data.chainId !== "number"
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // Reject stale data
    if (Date.now() - data.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return data;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearSendFlow(): void {
  localStorage.removeItem(STORAGE_KEY);
}
