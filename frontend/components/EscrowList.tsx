"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { Contract } from "ethers";
import { getBrowserProvider } from "@/lib/contract";

import { ESCROW_ADDRESS } from "@/lib/constants";
import EscrowABI from "@/abi/EscrowWithYield.json";
import EscrowCard from "./EscrowCard";

interface EscrowData {
  id: number;
  client: string;
  freelancer: string;
  arbitrator: string;
  amount: bigint;
  yieldEarned: bigint;
  state: number;
  yieldActive: boolean;
}

export default function EscrowList() {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [escrows, setEscrows] = useState<EscrowData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEscrows = useCallback(async () => {
    if (!isConnected || !walletProvider || !address) return;

    try {
      setLoading(true);
      const provider = getBrowserProvider(walletProvider);

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
  }, [fetchEscrows]);

  if (!isConnected) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
        Connect your wallet to view your escrows
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
        Loading escrows...
      </div>
    );
  }

  if (escrows.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
        No escrows found. Create your first escrow above!
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {escrows.map((escrow) => (
        <EscrowCard key={escrow.id} {...escrow} onRefresh={fetchEscrows} />
      ))}
    </div>
  );
}
