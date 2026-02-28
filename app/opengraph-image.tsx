import { ImageResponse } from "next/og";

export const alt = "IncogPay — Private crypto payments";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "72px 80px",
        position: "relative",
        overflow: "hidden",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Pink glow — top left */}
      <div
        style={{
          position: "absolute",
          top: -140,
          left: -120,
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236,72,153,0.18) 0%, transparent 65%)",
          display: "flex",
        }}
      />

      {/* Violet glow — bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: -120,
          right: -100,
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 65%)",
          display: "flex",
        }}
      />

      {/* Ghost watermark — right side (no transform, manually centered) */}
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 123,
          opacity: 0.04,
          display: "flex",
        }}
      >
        <svg width="320" height="384" viewBox="0 0 20 24" fill="none">
          <path
            d="M10 1C5.03 1 1 5.03 1 10V21L3.5 18.5L6 21L8.5 18.5L10 20L11.5 18.5L14 21L16.5 18.5L19 21V10C19 5.03 14.97 1 10 1Z"
            fill="white"
          />
        </svg>
      </div>

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Brand badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              background: "rgba(236,72,153,0.12)",
              border: "1px solid rgba(236,72,153,0.25)",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="28" height="33" viewBox="0 0 20 24" fill="none">
              <path
                d="M10 1C5.03 1 1 5.03 1 10V21L3.5 18.5L6 21L8.5 18.5L10 20L11.5 18.5L14 21L16.5 18.5L19 21V10C19 5.03 14.97 1 10 1Z"
                fill="#f472b6"
              />
              <circle cx="7" cy="11" r="1.8" fill="#0a0a0a" />
              <circle cx="13" cy="11" r="1.8" fill="#0a0a0a" />
            </svg>
          </div>
          <span
            style={{
              color: "#a1a1aa",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.3px",
            }}
          >
            IncogPay
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 88,
            fontWeight: 800,
            color: "#fafafa",
            lineHeight: 1.0,
            letterSpacing: "-3px",
            marginBottom: 28,
          }}
        >
          <span>Private crypto</span>
          <div style={{ display: "flex" }}>
            <span>payments</span>
            <span style={{ color: "#f472b6" }}>.</span>
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "#71717a",
            lineHeight: 1.5,
            maxWidth: 680,
            marginBottom: 52,
          }}
        >
          <span>
            Send and receive without revealing your wallet.{" "}
            <span style={{ color: "#d4d4d8" }}>Powered by RAILGUN</span> — zero-knowledge proofs
            on-chain.
          </span>
        </div>

        {/* Tag pills */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {(
            [
              {
                label: "Non-custodial",
                bg: "rgba(52,211,153,0.1)",
                border: "rgba(52,211,153,0.3)",
                text: "#34d399",
              },
              {
                label: "ZK proofs",
                bg: "rgba(236,72,153,0.1)",
                border: "rgba(236,72,153,0.3)",
                text: "#f472b6",
              },
              {
                label: "No backend",
                bg: "rgba(99,102,241,0.1)",
                border: "rgba(99,102,241,0.3)",
                text: "#818cf8",
              },
              {
                label: "4 chains",
                bg: "rgba(63,63,70,0.4)",
                border: "rgba(63,63,70,0.8)",
                text: "#71717a",
              },
            ] as { label: string; bg: string; border: string; text: string }[]
          ).map((tag) => (
            <div
              key={tag.label}
              style={{
                padding: "8px 18px",
                borderRadius: 100,
                background: tag.bg,
                border: `1px solid ${tag.border}`,
                color: tag.text,
                fontSize: 18,
                fontWeight: 500,
                display: "flex",
              }}
            >
              {tag.label}
            </div>
          ))}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
