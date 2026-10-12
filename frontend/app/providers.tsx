"use client";

import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { baseSepolia } from "@reown/appkit/networks";
import { type ReactNode } from "react";

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) {
  throw new Error("NEXT_PUBLIC_PROJECT_ID is not set in .env.local");
}

// ✅ Called ONCE at module level — never inside a component
createAppKit({
  adapters: [new EthersAdapter()],
  projectId,
  networks: [baseSepolia],
  defaultNetwork: baseSepolia,
  metadata: {
    name: "Freelance Escrow",
    description: "Decentralized escrow with automatic yield",
    url: "http://localhost:3000",
    icons: ["https://avatars.githubusercontent.com/u/37784886"],
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
