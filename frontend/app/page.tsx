"use client";

import { useRef, useCallback } from "react";
import ConnectButton from "@/components/ConnectButton";
import EscrowStats from "@/components/EscrowStats";
import CreateEscrowForm from "@/components/CreateEscrowForm";
import EscrowList from "@/components/EscrowList";

export default function Home() {
  const refreshRef = useRef<(() => void) | null>(null);

  const handleCreated = useCallback(() => {
    refreshRef.current?.();
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="bg-blue-950/50 border border-blue-900/50 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-300">
          <strong>First time?</strong> Make sure you're on{" "}
          <strong>Base Sepolia</strong> network in MetaMask. Get free test ETH
          from{" "}
          <a
            href="https://portal.cdp.coinbase.com/entity_4b079a88-e819-5645-b80b-cfa9e1a38a5f/onchain-tools/faucet"
            className="underline"
            target="_blank"
          >
            Coin Base Faucet
          </a>{" "}
          and test USDC from{" "}
          <a
            href="https://faucet.circle.com/"
            className="underline"
            target="_blank"
          >
            Circle Faucet
          </a>
          .
        </p>
      </div>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">
              🏗️ Freelance Escrow
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Decentralized escrow with automatic yield
            </p>
          </div>
          <ConnectButton />
        </div>

        {/* Stats */}
        <EscrowStats />

        {/* Create form */}
        <section id="create" className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Create New Escrow
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-6">
            <CreateEscrowForm onCreated={handleCreated} />
          </div>
        </section>

        {/* Escrow list */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">
            Your Escrows
          </h2>
          <EscrowList />
        </section>
      </div>
    </main>
  );
}
