import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        background: "#0a0a0a",
        borderRadius: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* Subtle pink glow */}
      <div
        style={{
          position: "absolute",
          top: -20,
          left: -20,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%)",
        }}
      />
      {/* Ghost SVG */}
      <svg width="100" height="120" viewBox="0 0 20 24" fill="none">
        <path
          d="M10 1C5.03 1 1 5.03 1 10V21L3.5 18.5L6 21L8.5 18.5L10 20L11.5 18.5L14 21L16.5 18.5L19 21V10C19 5.03 14.97 1 10 1Z"
          fill="#f472b6"
        />
        <circle cx="7" cy="11" r="1.8" fill="#0a0a0a" />
        <circle cx="13" cy="11" r="1.8" fill="#0a0a0a" />
      </svg>
    </div>,
    { ...size },
  );
}
