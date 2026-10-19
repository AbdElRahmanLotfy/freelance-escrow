"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { Contract } from "ethers";
import { getBrowserProvider } from "@/lib/contract";

import {
  ESCROW_ADDRESS,
  EscrowState,
  USDC_ADDRESS,
  AAVE_POOL_ADDRESS,
} from "@/lib/constants";
import EscrowABI from "@/abi/EscrowWithYield.json";
import EscrowCard from "./EscrowCard";
import EscrowSkeleton from "./EscrowSkeleton";

interface EscrowData {
  id: number;
  client: string;
  freelancer: string;
  arbitrator: string;
  amount: bigint;
  yieldEarned: bigint;
  duration: bigint;
  state: number;
  yieldActive: boolean;
}

export default function EscrowList() {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [escrows, setEscrows] = useState<EscrowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentApyBps, setCurrentApyBps] = useState<number>(0);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "amount">("newest");

  const fetchEscrows = useCallback(async () => {
    if (!isConnected || !walletProvider || !address) return;

    try {
      setLoading(true);
      const provider = getBrowserProvider(walletProvider);

      // 1. Fetch APY directly from Aave Pool
      try {
        const aavePool = new Contract(
          AAVE_POOL_ADDRESS,
          [
            "function getReserveData(address asset) view returns (uint256, uint128, uint128 currentLiquidityRate, uint128, uint128, uint40, uint16, address, address, address, address)",
          ],
          provider,
        );
        const data = await aavePool.getReserveData(USDC_ADDRESS);
        // Aave returns APY in Ray (1e27). We divide by 1e25 to get human-readable % (e.g., 500 = 5.00%)
        const apyPercentage = Number(data[2]) / 1e25;
        setCurrentApyBps(Math.round(apyPercentage * 100));
      } catch (err) {
        console.error("Failed to fetch APY directly from Aave", err);
        setCurrentApyBps(0);
      }

      // 2. Fetch Escrows from our contract
      const escrow = new Contract(ESCROW_ADDRESS, EscrowABI.abi, provider);
      const counter = await escrow.escrowCounter();
      const userEscrows: EscrowData[] = [];

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
            amount: details.amount as bigint,
            yieldEarned: details.yieldEarned as bigint,
            duration: details.duration as bigint, // <-- Added
            state: Number(details.state),
            yieldActive: details.yieldActive as boolean,
          });
        }
      }

      setEscrows(userEscrows.reverse());
    } catch (error) {
      console.error("Failed to fetch escrows:", error);
    } finally {
      setLoading(false);
    }
  }, [isConnected, walletProvider, address]);

  useEffect(() => {
    fetchEscrows();

    const interval = setInterval(() => {
      fetchEscrows();
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchEscrows]);

  if (!isConnected) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-8 text-center text-gray-400">
        Connect your wallet to view your escrows
      </div>
    );
  }

  if (loading && escrows.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <EscrowSkeleton key={i} />
        ))}
      </div>
    );
  }

  const processedEscrows = escrows
    .filter((e) => {
      if (filter === "active") {
        return [
          EscrowState.Funded,
          EscrowState.InProgress,
          EscrowState.Disputed,
        ].includes(e.state);
      }
      if (filter === "completed") {
        return [EscrowState.Released, EscrowState.Refunded].includes(e.state);
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "newest") return b.id - a.id;
      if (sort === "oldest") return a.id - b.id;
      if (sort === "amount") return Number(b.amount - a.amount);
      return 0;
    });

  if (processedEscrows.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-12 text-center">
        <div className="text-6xl mb-4">🏗️</div>
        <h3 className="text-xl font-semibold text-white mb-2">
          {escrows.length === 0 ? "No escrows yet" : `No ${filter} escrows`}
        </h3>
        <p className="text-gray-400 mb-6">
          {escrows.length === 0
            ? "Create your first escrow to start earning yield on locked funds."
            : "Try switching to a different filter."}
        </p>
        {escrows.length === 0 ? (
          <a
            href="#create"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Create Escrow
          </a>
        ) : (
          <button
            onClick={() => setFilter("all")}
            className="inline-block px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            Show All
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 text-sm rounded-lg transition ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
            }`}
          >
            All ({escrows.length})
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`px-3 py-1 text-sm rounded-lg transition ${
              filter === "active"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`px-3 py-1 text-sm rounded-lg transition ${
              filter === "completed"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
            }`}
          >
            Completed
          </button>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="px-3 py-1 text-sm bg-gray-800 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount">Highest amount</option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {processedEscrows.map((escrow) => (
          <EscrowCard
            key={escrow.id}
            {...escrow}
            apyBps={currentApyBps}
            onRefresh={fetchEscrows}
          />
        ))}
      </div>
    </>
  );
}
