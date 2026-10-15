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
