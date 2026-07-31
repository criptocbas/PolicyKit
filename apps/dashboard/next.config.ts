import type { NextConfig } from "next";
import path from "path";

const empty = path.resolve(__dirname, "src/lib/empty-module.ts");
const mobileStub = path.resolve(__dirname, "src/lib/empty-mobile-adapter.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@policykit/sdk"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@policykit/sdk": path.resolve(__dirname, "../../packages/sdk/src"),
      // Mobile wallet adapter pulls @solana/kit versions that break webpack.
      "@solana-mobile/wallet-adapter-mobile": mobileStub,
      "@solana-mobile/mobile-wallet-adapter-protocol": empty,
      "@solana-mobile/mobile-wallet-adapter-protocol-web3js": empty,
    };
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      "pino-pretty",
      "lokijs",
      "encoding",
    ];
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
