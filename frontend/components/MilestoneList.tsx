"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { Contract } from "ethers";
import { getBrowserProvider } from "@/lib/contract";
import { MILESTONE_ESCROW_ADDRESS } from "@/lib/constants";
import MilestoneEscrowABI from "@/abi/MilestoneEscrow.json";
import MilestoneCard from "./MilestoneCard";
import EscrowSkeleton from "./EscrowSkeleton";

interface Milestone {
  amount: bigint;
  isReleased: boolean;
  workSubmittedAt: bigint;
  isDisputed: boolean;
}

interface MilestoneEscrowData {
  id: number;
  client: string;
  freelancer: string;
  arbitrator: string;
  totalAmount: bigint;
  state: number;
  yieldActive: boolean;
  milestones: Milestone[];
}

export default function MilestoneList() {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");

  const [escrows, setEscrows] = useState<MilestoneEscrowData[]>([]);
  const [loading, setLoading] = useState(true);

  const isFetching = useRef(false);

  const fetchEscrows = useCallback(async () => {
    if (!isConnected || !walletProvider || !address) {
      setLoading(false);
      return;
    }

    // Prevent overlapping requests
    if (isFetching.current) return;

    isFetching.current = true;

    try {
      const provider = getBrowserProvider(walletProvider);

      const escrow = new Contract(
        MILESTONE_ESCROW_ADDRESS,
        MilestoneEscrowABI.abi,
        provider,
      );

      const counter = await escrow.getEscrowCount();

      const userEscrows: MilestoneEscrowData[] = [];

      for (let i = 0; i < Number(counter); i++) {
        const details = await escrow.getEscrow(i);

        const client = details.client as string;
        const freelancer = details.freelancer as string;

        if (
          client.toLowerCase() === address.toLowerCase() ||
          freelancer.toLowerCase() === address.toLowerCase()
        ) {
          userEscrows.push({
            id: i,
            client,
            freelancer,
            arbitrator: details.arbitrator as string,
            totalAmount: details.totalAmount as bigint,
            state: Number(details.state),
            yieldActive: details.yieldActive as boolean,
            milestones: details.milestones as Milestone[],
          });
        }
      }

      setEscrows(userEscrows.reverse());
    } catch (error: unknown) {
      console.error("Failed to fetch milestone escrows:", error);
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  }, [isConnected, walletProvider, address]);

  // Initial fetch + automatic polling
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchEscrows();
    }, 0);

    const intervalId = setInterval(() => {
      void fetchEscrows();
    }, 15000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [fetchEscrows]);

  // Wallet disconnected
  if (!isConnected) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-8 text-center text-gray-400">
        Connect your wallet to view milestone escrows
      </div>
    );
  }

  // Loading skeleton
  if (loading && escrows.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <EscrowSkeleton key={i} />
        ))}
      </div>
    );
  }

  // No escrows found
  if (escrows.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-12 text-center">
        <div className="text-6xl mb-4">🏗️</div>

        <h3 className="text-xl font-semibold text-white mb-2">
          No milestone escrows yet
        </h3>

        <p className="text-gray-400 mb-6">
          Create your first milestone escrow to manage a multi-stage project.
        </p>

        <a
          href="#create"
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Create Milestone Escrow
        </a>
      </div>
    );
  }

  // Display escrows
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {escrows.map((escrow) => (
        <MilestoneCard key={escrow.id} {...escrow} onRefresh={fetchEscrows} />
      ))}
    </div>
  );
}
