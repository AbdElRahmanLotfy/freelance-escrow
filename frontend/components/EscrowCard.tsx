"use client";

import { useState, useEffect } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { Contract, MaxUint256 } from "ethers";
import toast from "react-hot-toast";
import { getBrowserProvider } from "@/lib/contract";

import { ESCROW_ADDRESS, USDC_ADDRESS } from "@/lib/constants";
import { formatUSDC } from "@/lib/format";
import {
  EscrowState,
  ESCROW_STATE_LABELS,
  ESCROW_STATE_COLORS,
} from "@/lib/constants";
import EscrowABI from "@/abi/EscrowWithYield.json";
import AddressDisplay from "./AddressDisplay";

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

interface EscrowCardProps {
  id: number;
  client: string;
  freelancer: string;
  arbitrator: string;
  amount: bigint;
  yieldEarned: bigint;
  duration: bigint; // Added
  state: number;
  yieldActive: boolean;
  apyBps: number; // Added
  onRefresh: () => void;
}

export default function EscrowCard({
  id,
  client,
  freelancer,
  arbitrator,
  amount,
  yieldEarned,
  duration, // Added
  state,
  yieldActive,
  apyBps, // Added
  onRefresh,
}: EscrowCardProps) {
  const { address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState("10");
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);

  const isClient = address?.toLowerCase() === client.toLowerCase();
  const isFreelancer = address?.toLowerCase() === freelancer.toLowerCase();
  const isArbitrator = address?.toLowerCase() === arbitrator.toLowerCase();

  useEffect(() => {
    async function fetchAllowance() {
      if (!walletProvider || !address || state !== EscrowState.Created) return;

      try {
        const provider = getBrowserProvider(walletProvider);
        const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, provider);

        const [allow, bal] = await Promise.all([
          usdc.allowance(address, ESCROW_ADDRESS),
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

      const tx = await usdc.approve(ESCROW_ADDRESS, MaxUint256);
      await tx.wait();

      const newAllowance = await usdc.allowance(address, ESCROW_ADDRESS);
      setAllowance(newAllowance);

      toast.success("USDC approved!", { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error(error.reason || error.message || "Approval failed", {
        id: toastId,
      });
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  async function handleFund() {
    if (!walletProvider) return;
    const toastId = toast.loading("Funding escrow...");

    try {
      setLoading(true);
      setLoadingAction("fund");
      const signer = await getSigner();
      const escrow = new Contract(ESCROW_ADDRESS, EscrowABI.abi, signer);

      const amountWei = BigInt(Math.floor(parseFloat(fundAmount) * 10 ** 6));

      const tx = await escrow.fundEscrow(id, amountWei);
      await tx.wait();

      toast.success(`${fundAmount} USDC funded!`, { id: toastId });
      onRefresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.reason || error.message || "Fund failed", {
        id: toastId,
      });
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  async function executeAction(action: string) {
    if (!walletProvider) return;
    const toastId = toast.loading("Processing transaction...");

    try {
      setLoading(true);
      setLoadingAction(action);
      const signer = await getSigner();
      const escrow = new Contract(ESCROW_ADDRESS, EscrowABI.abi, signer);

      let tx;
      let successMessage = "Transaction successful!";

      switch (action) {
        case "startWork":
          tx = await escrow.startWork(id);
          successMessage = "Work started!";
          break;
        case "release":
          tx = await escrow.releasePayment(id);
          successMessage = "Payment released!";
          break;
        case "refund":
          tx = await escrow.refundClient(id);
          successMessage = "Client refunded!";
          break;
        case "dispute":
          tx = await escrow.raiseDispute(id);
          successMessage = "Dispute raised!";
          break;
        case "resolveDisputeForFreelancer":
          tx = await escrow.resolveDispute(id, freelancer);
          successMessage = "Dispute resolved for freelancer!";
          break;
        case "resolveDisputeForClient":
          tx = await escrow.resolveDispute(id, client);
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
    } catch (error: any) {
      console.error(error);
      toast.error(error.reason || error.message || "Transaction failed", {
        id: toastId,
      });
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  const canFund = isClient && state === EscrowState.Created;
  const hasEnoughAllowance =
    allowance >= BigInt(Math.floor(parseFloat(fundAmount || "0") * 10 ** 6));
  const canStartWork = isClient && state === EscrowState.Funded;
  const canRelease = isClient && state === EscrowState.InProgress;
  const canRefund = isClient && state === EscrowState.InProgress;
  const canDispute =
    (isClient || isFreelancer) && state === EscrowState.InProgress;
  const canResolve = isArbitrator && state === EscrowState.Disputed;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-md p-6 hover:shadow-lg transition">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Escrow #{id}</h3>
          <span
            className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
              ESCROW_STATE_COLORS[state as EscrowState]
            }`}
          >
            {ESCROW_STATE_LABELS[state as EscrowState]}
          </span>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{formatUSDC(amount)}</p>
          <p className="text-xs text-gray-400">USDC</p>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1 mb-4 text-sm">
        <p>
          <span className="text-gray-400">Client:</span>{" "}
          <AddressDisplay address={client} isYou={isClient} />
        </p>
        <p>
          <span className="text-gray-400">Freelancer:</span>{" "}
          <AddressDisplay address={freelancer} isYou={isFreelancer} />
        </p>
        <p>
          <span className="text-gray-400">Arbitrator:</span>{" "}
          <AddressDisplay address={arbitrator} isYou={isArbitrator} />
        </p>
      </div>

      {/* Yield Info (Updated with APY and Split) */}
      {yieldActive && (
        <div className="bg-green-950/40 border border-green-900/50 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-medium text-green-400 flex items-center gap-1">
              🧑‍🌾 Earning Yield via Aave V3
            </p>
            <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full font-mono">
              {apyBps > 0 ? (apyBps / 100).toFixed(2) : "0.00"}% APY
            </span>
          </div>

          {yieldEarned > 0n && (
            <p className="text-sm font-semibold text-green-300 mb-3">
              +{formatUSDC(yieldEarned, 6)} USDC total earned
            </p>
          )}

          {/* Estimated Split */}
          {amount > 0n && apyBps > 0 && (
            <div className="grid grid-cols-2 gap-2 text-xs mt-2 pt-2 border-t border-green-900/50">
              <div>
                <p className="text-gray-400">Est. Freelancer (70%)</p>
                <p className="text-green-300 font-mono">
                  +
                  {(
                    (Number(amount) *
                      (apyBps / 10000) *
                      (Number(duration) / 31536000) *
                      0.7) /
                    1e6
                  ).toFixed(6)}{" "}
                  USDC
                </p>
              </div>
              <div>
                <p className="text-gray-400">Est. Client (30%)</p>
                <p className="text-green-300 font-mono">
                  +
                  {(
                    (Number(amount) *
                      (apyBps / 10000) *
                      (Number(duration) / 31536000) *
                      0.3) /
                    1e6
                  ).toFixed(6)}{" "}
                  USDC
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fund Section */}
      {canFund && (
        <div className="border-t border-gray-800 pt-4 mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Amount to fund (USDC)
            </label>
            <input
              type="number"
              min="0.000001"
              step="0.000001"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Balance: {formatUSDC(usdcBalance)} USDC
            </p>
          </div>

          {!hasEnoughAllowance ? (
            <button
              onClick={handleApprove}
              disabled={loading}
              className="w-full py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingAction === "approve" ? (
                <>
                  <Spinner />
                  Approving...
                </>
              ) : (
                `Approve ${fundAmount} USDC`
              )}
            </button>
          ) : (
            <button
              onClick={handleFund}
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingAction === "fund" ? (
                <>
                  <Spinner />
                  Funding...
                </>
              ) : (
                `Fund with ${fundAmount} USDC`
              )}
            </button>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mt-4">
        {canStartWork && (
          <button
            onClick={() => executeAction("startWork")}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loadingAction === "startWork" && <Spinner />}
            Start Work
          </button>
        )}
        {canRelease && (
          <button
            onClick={() => executeAction("release")}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loadingAction === "release" && <Spinner />}
            Release Payment
          </button>
        )}
        {canRefund && (
          <button
            onClick={() => executeAction("refund")}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loadingAction === "refund" && <Spinner />}
            Refund
          </button>
        )}
        {canDispute && (
          <button
            onClick={() => executeAction("dispute")}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loadingAction === "dispute" && <Spinner />}
            Raise Dispute
          </button>
        )}
        {canResolve && (
          <>
            <button
              onClick={() => executeAction("resolveDisputeForFreelancer")}
              disabled={loading}
              className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition disabled:opacity-50 flex items-center gap-2"
            >
              {loadingAction === "resolveDisputeForFreelancer" && <Spinner />}
              Resolve for Freelancer
            </button>
            <button
              onClick={() => executeAction("resolveDisputeForClient")}
              disabled={loading}
              className="px-4 py-2 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 transition disabled:opacity-50 flex items-center gap-2"
            >
              {loadingAction === "resolveDisputeForClient" && <Spinner />}
              Resolve for Client
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
