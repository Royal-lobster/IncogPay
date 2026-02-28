import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // The @railgun-community/engine package's "exports" field only exposes ".",
      // but we need the key-derivation subpath for lightweight address derivation
      // without engine initialization (used by the receive page).
      "@railgun-community/engine/dist/key-derivation":
        "./node_modules/@railgun-community/engine/dist/key-derivation/index.js",
    },
  },
};

export default nextConfig;
