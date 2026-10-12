import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  transpilePackages: ["@coinbase/cdp-sdk", "@x402/core"],
};

export default nextConfig;
