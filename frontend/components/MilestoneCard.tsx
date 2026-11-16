"use client";

import { useState, useEffect } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { Contract, MaxUint256 } from "ethers";
import toast from "react-hot-toast";
import { getBrowserProvider } from "@/lib/contract";
import { MILESTONE_ESCROW_ADDRESS, USDC_ADDRESS } from "@/lib/constants";
import { formatUSDC } from "@/lib/format";
import AddressDisplay from "./AddressDisplay";
import MilestoneEscrowABI from "@/abi/MilestoneEscrow.json";

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

interface Milestone {
  amount: bigint;
  isReleased: boolean;
  workSubmittedAt: bigint;
  isDisputed: boolean;
}

interface MilestoneCardProps {
  id: number;
  client: string;
  freelancer: string;
  arbitrator: string;
  totalAmount: bigint;
  state: number;
  yieldActive: boolean;
  milestones: Milestone[];
  onRefresh: () => void;
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

export default function MilestoneCard({
  id,
  client,
  freelancer,
  arbitrator,
  totalAmount,
  state,
  yieldActive,
  milestones,
  onRefresh,
}: MilestoneCardProps) {
  const { address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);

  const isClient = address?.toLowerCase() === client.toLowerCase();
  const isFreelancer = address?.toLowerCase() === freelancer.toLowerCase();
  const isArbitrator = address?.toLowerCase() === arbitrator.toLowerCase();

  useEffect(() => {
    async function fetchAllowance() {
      if (!walletProvider || !address || state !== 0) return;

      try {
        const provider = getBrowserProvider(walletProvider);
        const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, provider);

        const [allow, bal] = await Promise.all([
          usdc.allowance(address, MILESTONE_ESCROW_ADDRESS),
          usdc.balanceOf(address),
        ]);

        setAllowance(allow);
        setUsdcBalance(bal);
      } catch (err) {
        console.error("Failed to fetch allowance:", err);
      }
    }

    fetchAllowance();
  }, [walletProvider, address, state]);

  async function getSigner() {
    if (!walletProvider) throw new Error("Wallet not connected");
    const provider = getBrowserProvider(walletProvider);
    return await provider.getSigner();
  }

  async function handleApprove() {
    if (!walletProvider) return;
    const toastId = toast.loading("Approving USDC...");

    try {
      setLoading(true);
      setLoadingAction("approve");
      const signer = await getSigner();
      const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, signer);

      const tx = await usdc.approve(MILESTONE_ESCROW_ADDRESS, MaxUint256);
      await tx.wait();

      const newAllowance = await usdc.allowance(
        address,
        MILESTONE_ESCROW_ADDRESS,
      );
      setAllowance(newAllowance);

      toast.success("USDC approved!", { id: toastId });
    } catch (error: unknown) {
      console.error("Approval failed:", error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  async function handleFund() {
    if (!walletProvider) return;
    const toastId = toast.loading("Funding milestone escrow...");

    try {
      setLoading(true);
      setLoadingAction("fund");
      const signer = await getSigner();
      const escrow = new Contract(
        MILESTONE_ESCROW_ADDRESS,
        MilestoneEscrowABI.abi,
        signer,
      );

      const tx = await escrow.fundEscrow(id, totalAmount);
      await tx.wait();

      toast.success(`Escrow funded!`, { id: toastId });
      onRefresh();
    } catch (error: unknown) {
      console.error("Fund failed:", error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  async function executeAction(action: string, milestoneIndex?: number) {
    if (!walletProvider) return;
    const toastId = toast.loading("Processing transaction...");

    try {
      setLoading(true);
      setLoadingAction(action);
      const signer = await getSigner();
      const escrow = new Contract(
        MILESTONE_ESCROW_ADDRESS,
        MilestoneEscrowABI.abi,
        signer,
      );

      let tx;
      let successMessage = "Transaction successful!";

      switch (action) {
        case "submitWork":
          tx = await escrow.submitMilestone(id, milestoneIndex);
          successMessage = "Work submitted! Client has 14 days to review.";
          break;
        case "release":
          tx = await escrow.releaseMilestone(id, milestoneIndex);
          successMessage = "Milestone released!";
          break;
        case "autoRelease":
          tx = await escrow.autoReleaseMilestone(id, milestoneIndex);
          successMessage = "Auto-release successful!";
          break;
        case "dispute":
          tx = await escrow.raiseDispute(id, milestoneIndex);
          successMessage = "Dispute raised for milestone!";
          break;
        case "resolveForFreelancer":
          tx = await escrow.resolveDispute(id, milestoneIndex, freelancer);
          successMessage = "Dispute resolved for freelancer!";
          break;
        case "resolveForClient":
          tx = await escrow.resolveDispute(id, milestoneIndex, client);
          successMessage = "Dispute resolved for client!";
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      if (tx) {
        await tx.wait();
        toast.success(successMessage, { id: toastId });
        onRefresh();
      }
    } catch (error: unknown) {
      console.error("Transaction failed:", error);
      toast.error(getErrorMessage(error), {
        id: toastId,
      });
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  const canFund = isClient && state === 0;
  const hasEnoughAllowance = allowance >= totalAmount;
  const isActive = state === 1;
  const isReleased = state === 2;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Milestone Escrow #{id}
          </h3>
          <span
            className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
              isReleased
                ? "bg-green-950/50 text-green-300"
                : isActive
                  ? "bg-blue-950/50 text-blue-300"
                  : "bg-yellow-950/50 text-yellow-300"
            }`}
          >
            {isReleased ? "Released" : isActive ? "In Progress" : "Created"}
          </span>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">
            {formatUSDC(totalAmount)}
          </p>
          <p className="text-xs text-gray-400">Total USDC</p>
        </div>
      </div>

      {/* Parties */}
      <div className="space-y-1 mb-4 text-sm">
        <p>
          <span className="text-gray-400">Client:</span>{" "}
          <AddressDisplay address={client} isYou={isClient} />
        </p>
        <p>
          <span className="text-gray-400">Contractor:</span>{" "}
          <AddressDisplay address={freelancer} isYou={isFreelancer} />
        </p>
        <p>
          <span className="text-gray-400">Arbitrator:</span>{" "}
          <AddressDisplay address={arbitrator} isYou={isArbitrator} />
        </p>
      </div>

      {/* Yield Info */}
      {yieldActive && (
        <div className="bg-green-950/40 border border-green-900/50 rounded-lg p-3 mb-4">
          <p className="text-xs text-green-300">🌱 Earning yield via Aave V3</p>
        </div>
      )}

      {/* Milestones List */}
      <div className="space-y-3 mb-4">
        {milestones.map((m, i) => {
          const canSubmit =
            isFreelancer &&
            isActive &&
            !m.isReleased &&
            !m.isDisputed &&
            m.workSubmittedAt === 0n;
          const canRelease =
            isClient &&
            isActive &&
            !m.isReleased &&
            !m.isDisputed &&
            m.workSubmittedAt > 0n;
          const canDispute =
            (isClient || isFreelancer) &&
            isActive &&
            !m.isReleased &&
            !m.isDisputed;
          const canResolve = isArbitrator && m.isDisputed;

          return (
            <div
              key={i}
              className="bg-gray-950/50 border border-gray-800 rounded-lg p-3"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-white">
                  Milestone {i + 1}
                </span>
                <span className="text-sm font-mono text-blue-300">
                  {formatUSDC(m.amount)} USDC
                </span>
              </div>
              <div className="text-xs text-gray-400 mb-2">
                Status:{" "}
                {m.isReleased
                  ? "✅ Released"
                  : m.isDisputed
                    ? "⚠️ Disputed"
                    : m.workSubmittedAt > 0n
                      ? "⏳ In Review"
                      : "⏸️ Pending"}
              </div>
              <div className="flex flex-wrap gap-2">
                {canSubmit && (
                  <button
                    onClick={() => executeAction("submitWork", i)}
                    disabled={loading}
                    className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                  >
                    Submit Work
                  </button>
                )}
                {canRelease && (
                  <button
                    onClick={() => executeAction("release", i)}
                    disabled={loading}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Release
                  </button>
                )}
                {canDispute && (
                  <button
                    onClick={() => executeAction("dispute", i)}
                    disabled={loading}
                    className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Raise Dispute
                  </button>
                )}
                {canResolve && (
                  <>
                    <button
                      onClick={() => executeAction("resolveForFreelancer", i)}
                      disabled={loading}
                      className="px-3 py-1 text-xs bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50"
                    >
                      Resolve for Contractor
                    </button>
                    <button
                      onClick={() => executeAction("resolveForClient", i)}
                      disabled={loading}
                      className="px-3 py-1 text-xs bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50"
                    >
                      Resolve for Client
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fund Section */}
      {canFund && (
        <div className="border-t border-gray-800 pt-4 space-y-3">
          <p className="text-sm text-gray-300">
            Total required:{" "}
            <span className="font-mono text-white">
              {formatUSDC(totalAmount)} USDC
            </span>
          </p>
          <p className="text-xs text-gray-500">
            Balance: {formatUSDC(usdcBalance)} USDC
          </p>
          {!hasEnoughAllowance ? (
            <button
              onClick={handleApprove}
              disabled={loading}
              className="w-full py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            >
              {loadingAction === "approve" ? "Approving..." : "Approve USDC"}
            </button>
          ) : (
            <button
              onClick={handleFund}
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loadingAction === "fund"
                ? "Funding..."
                : `Fund Escrow (${formatUSDC(totalAmount)} USDC)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
