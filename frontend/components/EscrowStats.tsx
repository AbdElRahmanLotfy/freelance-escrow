"use client";

import { useEffect, useState } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { Contract } from "ethers";
import { getBrowserProvider } from "@/lib/contract";
import { ESCROW_ADDRESS, USDC_ADDRESS } from "@/lib/constants";
import { formatUSDC } from "@/lib/format";
import EscrowABI from "@/abi/EscrowWithYield.json";

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

export default function EscrowStats() {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);
  const [escrowCount, setEscrowCount] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      if (!isConnected || !walletProvider || !address) return;

      try {
        setLoading(true);
        const provider = getBrowserProvider(walletProvider);

        const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, provider);
        const escrow = new Contract(ESCROW_ADDRESS, EscrowABI.abi, provider);

        const [balance, count] = await Promise.all([
          usdc.balanceOf(address),
          escrow.escrowCounter(),
        ]);

        setUsdcBalance(balance);
        setEscrowCount(count);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [isConnected, walletProvider, address]);

  if (!isConnected) return null;

  return (
    <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4 mb-8">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-6">
        <p className="text-sm text-gray-400 mb-1">Your USDC Balance</p>
        <p className="text-2xl font-bold text-white">
          {loading ? "..." : formatUSDC(usdcBalance)} USDC
        </p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-6">
        <p className="text-sm text-gray-400 mb-1">Total Escrows</p>
        <p className="text-2xl font-bold text-white">
          {loading ? "..." : escrowCount.toString()}
        </p>
      </div>
    </div>
  );
}
