"use client";

import { useState } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { Contract } from "ethers";
import { getBrowserProvider } from "@/lib/contract";

import { ESCROW_ADDRESS } from "@/lib/constants";
import EscrowABI from "@/abi/EscrowWithYield.json";

interface CreateEscrowFormProps {
  onCreated: () => void;
}

export default function CreateEscrowForm({ onCreated }: CreateEscrowFormProps) {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    freelancer: "",
    arbitrator: "",
    duration: "7",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletProvider || !address) return;

    try {
      setLoading(true);
      const provider = getBrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const escrow = new Contract(ESCROW_ADDRESS, EscrowABI.abi, signer);

      const durationSeconds = BigInt(
        parseInt(formData.duration) * 24 * 60 * 60,
      );

      const tx = await escrow.createEscrow(
        formData.freelancer,
        formData.arbitrator,
        durationSeconds,
      );

      await tx.wait();
      alert("Escrow created successfully!");

      setFormData({ freelancer: "", arbitrator: "", duration: "7" });
      onCreated();
    } catch (error: any) {
      console.error(error);
      alert(error.reason || error.message || "Failed to create escrow");
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
        Connect your wallet to create an escrow
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          Freelancer Address
        </label>
        <input
          type="text"
          required
          value={formData.freelancer}
          onChange={(e) =>
            setFormData({ ...formData, freelancer: e.target.value })
          }
          placeholder="0x..."
          className="w-full px-4 py-2 text-black border border-gray-300 rounded-lg  focus:ring-0  focus:border-transparent font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          Arbitrator Address
        </label>
        <input
          type="text"
          required
          value={formData.arbitrator}
          onChange={(e) =>
            setFormData({ ...formData, arbitrator: e.target.value })
          }
          placeholder="0x..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg  focus:ring-0 focus:border-transparent font-medium text-black text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          Duration (days)
        </label>
        <input
          type="number"
          required
          min="1"
          max="365"
          value={formData.duration}
          onChange={(e) =>
            setFormData({ ...formData, duration: e.target.value })
          }
          className="w-full px-4 text-black py-2 border border-gray-300 rounded-lg  focus:ring-0  focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating..." : "Create Escrow"}
      </button>
    </form>
  );
}
