"use client";

import { useRef, useCallback } from "react";
import Link from "next/link";
import ConnectButton from "@/components/ConnectButton";
import CreateMilestoneForm from "@/components/CreateMilestoneForm";
import MilestoneList from "@/components/MilestoneList";

export default function MilestonesPage() {
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
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">
                🏗️ Milestone Escrow
              </h1>
              <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full">
                For BIM & Construction
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Multi-stage project escrow with automatic yield
            </p>
            <Link
              href="/"
              className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
            >
              ← Back to Freelance Escrow
            </Link>
          </div>
          <ConnectButton />
        </div>

        {/* Create Form */}
        <section id="create" className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Create New Milestone Escrow
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-6">
            <CreateMilestoneForm onCreated={handleCreated} />
          </div>
        </section>

        {/* Escrow List */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">
            Active Milestone Escrows
          </h2>
          <MilestoneList />
        </section>
      </div>
    </main>
  );
}
