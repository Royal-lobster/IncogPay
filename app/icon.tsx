import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#0a0a0a",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Ghost SVG */}
        <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
          <path
            d="M10 1C5.03 1 1 5.03 1 10V21L3.5 18.5L6 21L8.5 18.5L10 20L11.5 18.5L14 21L16.5 18.5L19 21V10C19 5.03 14.97 1 10 1Z"
            fill="#f472b6"
          />
          <circle cx="7" cy="11" r="1.8" fill="#0a0a0a" />
          <circle cx="13" cy="11" r="1.8" fill="#0a0a0a" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
