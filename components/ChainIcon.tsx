export function ChainIcon({ chainId, size = 16 }: { chainId: number; size?: number }) {
  const s = size;

  // Arbitrum
  if (chainId === 42161) return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="14" fill="#213147"/>
      <path d="M14.5 6L8 17.5H11L14.5 11L18 17.5H21L14.5 6Z" fill="#28A0F0"/>
      <path d="M11 17.5L13 21H16L18 17.5H11Z" fill="#96BEDC"/>
    </svg>
  );

  // Ethereum
  if (chainId === 1) return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="14" fill="#1C1C1C"/>
      <path d="M14 5L8.5 14.3L14 17.6L19.5 14.3L14 5Z" fill="#627EEA" fillOpacity="0.9"/>
      <path d="M8.5 15.5L14 23L19.5 15.5L14 18.8L8.5 15.5Z" fill="#627EEA"/>
      <path d="M14 17.6L8.5 14.3L14 11.2V17.6Z" fill="#627EEA" fillOpacity="0.5"/>
      <path d="M14 11.2L19.5 14.3L14 17.6V11.2Z" fill="#627EEA" fillOpacity="0.7"/>
    </svg>
  );

  // Polygon
  if (chainId === 137) return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="14" fill="#1A1A2E"/>
      <path d="M18.5 11.2L14 8.5L9.5 11.2V16.8L14 19.5L18.5 16.8V11.2ZM14 17.3L11.2 15.7V12.3L14 10.7L16.8 12.3V15.7L14 17.3Z" fill="#8247E5"/>
    </svg>
  );

  // BNB Chain
  if (chainId === 56) return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="14" fill="#1A1A1A"/>
      <path d="M14 7L16.1 9.1L11.2 14L16.1 18.9L14 21L9 16L11.1 13.9L9 11.8L14 7Z" fill="#F3BA2F"/>
      <path d="M14 7L19 11.8L16.9 13.9L19 16L14 21L16.1 18.9L11.2 14L16.1 9.1L14 7Z" fill="#F3BA2F"/>
      <circle cx="14" cy="14" r="2" fill="#F3BA2F"/>
    </svg>
  );

  return <div style={{ width: s, height: s }} className="rounded-full bg-zinc-700" />;
}
