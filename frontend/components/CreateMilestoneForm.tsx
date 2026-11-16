"use client";

import { useState } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { Contract } from "ethers";
import toast from "react-hot-toast";
import { getBrowserProvider } from "@/lib/contract";
import { MILESTONE_ESCROW_ADDRESS } from "@/lib/constants";
import MilestoneEscrowABI from "@/abi/MilestoneEscrow.json";

interface CreateMilestoneFormProps {
  onCreated: () => void;
}

interface EthersError {
  reason?: string;
  shortMessage?: string;
  message?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const ethersError = error as Error & EthersError;

    return (
      ethersError.reason ||
      ethersError.shortMessage ||
      ethersError.message ||
      "Failed to create milestone escrow"
    );
  }

  if (error && typeof error === "object") {
    const ethersError = error as EthersError;

    return (
      ethersError.reason ||
      ethersError.shortMessage ||
      ethersError.message ||
      "Failed to create milestone escrow"
    );
  }

  return "Failed to create milestone escrow";
}

export default function CreateMilestoneForm({
  onCreated,
}: CreateMilestoneFormProps) {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");

  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    freelancer: "",
    arbitrator: "",
  });

  const [milestones, setMilestones] = useState<{ amount: string }[]>([
    { amount: "" },
  ]);

  const addMilestone = () => {
    setMilestones((prev) => [...prev, { amount: "" }]);
  };

  const removeMilestone = (index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, amount: string) => {
    setMilestones((prev) =>
      prev.map((milestone, i) =>
        i === index ? { ...milestone, amount } : milestone,
      ),
    );
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!walletProvider || !address) {
      toast.error("Please connect your wallet");
      return;
    }

    const toastId = toast.loading("Creating milestone escrow...");

    try {
      setLoading(true);

      const provider = getBrowserProvider(walletProvider);
      const signer = await provider.getSigner();

      const escrow = new Contract(
        MILESTONE_ESCROW_ADDRESS,
        MilestoneEscrowABI.abi,
        signer,
      );

      const milestoneAmounts = milestones.map((m) => {
        const amount = Number(m.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("Please enter valid milestone amounts");
        }

        return BigInt(Math.round(amount * 1_000_000));
      });

      const tx = await escrow.createEscrow(
        formData.freelancer,
        formData.arbitrator,
        milestoneAmounts,
      );

      await tx.wait();

      toast.success("Milestone escrow created!", { id: toastId });

      setFormData({
        freelancer: "",
        arbitrator: "",
      });

      setMilestones([{ amount: "" }]);

      onCreated();
    } catch (error: unknown) {
      console.error("Failed to create milestone escrow:", error);

      toast.error(getErrorMessage(error), {
        id: toastId,
      });
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="text-center py-8 text-gray-400">
        Connect your wallet to create a milestone escrow
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Freelancer / Contractor Address
        </label>

        <input
          type="text"
          required
          value={formData.freelancer}
          onChange={(e) =>
            setFormData({ ...formData, freelancer: e.target.value })
          }
          placeholder="0x..."
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
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
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
        />
      </div>

      <div className="border-t border-gray-800 pt-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          Milestones (USDC)
        </h3>

        {milestones.map((m, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="number"
              min="0.000001"
              step="0.000001"
              required
              value={m.amount}
              onChange={(e) => updateMilestone(i, e.target.value)}
              placeholder={`Milestone ${i + 1} amount`}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {milestones.length > 1 && (
              <button
                type="button"
                onClick={() => removeMilestone(i)}
                className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addMilestone}
          className="mt-2 text-sm text-blue-400 hover:text-blue-300"
        >
          + Add another milestone
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating..." : "Create Milestone Escrow"}
      </button>
    </form>
  );
}
