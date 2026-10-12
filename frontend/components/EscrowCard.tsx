"use client";

import { useState, useEffect } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { BrowserProvider, Contract, MaxUint256 } from "ethers";
import { ESCROW_ADDRESS, USDC_ADDRESS } from "@/lib/constants";
import { formatUSDC, shortenAddress } from "@/lib/format";
import {
  EscrowState,
  ESCROW_STATE_LABELS,
  ESCROW_STATE_COLORS,
} from "@/lib/constants";
import EscrowABI from "@/abi/EscrowWithYield.json";

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
  state: number;
  yieldActive: boolean;
  onRefresh: () => void;
}

export default function EscrowCard({
  id,
  client,
  freelancer,
  arbitrator,
  amount,
  yieldEarned,
  state,
  yieldActive,
  onRefresh,
}: EscrowCardProps) {
  const { address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [loading, setLoading] = useState(false);
  const [fundAmount, setFundAmount] = useState("10");
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);

  const isClient = address?.toLowerCase() === client.toLowerCase();
  const isFreelancer = address?.toLowerCase() === freelancer.toLowerCase();

  // Fetch allowance & balance when the state is "Created"
  useEffect(() => {
    async function fetchAllowance() {
      if (!walletProvider || !address || state !== EscrowState.Created) return;

      try {
        const provider = new BrowserProvider(walletProvider as any);
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
    const provider = new BrowserProvider(walletProvider as any);
    return await provider.getSigner();
  }

  async function handleApprove() {
    if (!walletProvider) return;
    try {
      setLoading(true);
      const signer = await getSigner();
      const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, signer);

      // Approve max to avoid re-approving every time
      const tx = await usdc.approve(ESCROW_ADDRESS, MaxUint256);
      await tx.wait();

      // Refresh allowance
      const newAllowance = await usdc.allowance(address, ESCROW_ADDRESS);
      setAllowance(newAllowance);
    } catch (error: any) {
      console.error(error);
      alert(error.reason || error.message || "Approval failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleFund() {
    if (!walletProvider) return;
    try {
      setLoading(true);
      const signer = await getSigner();
      const escrow = new Contract(ESCROW_ADDRESS, EscrowABI.abi, signer);

      const amountWei = BigInt(Math.floor(parseFloat(fundAmount) * 10 ** 6));

      const tx = await escrow.fundEscrow(id, amountWei);
      await tx.wait();
      onRefresh();
    } catch (error: any) {
      console.error(error);
      alert(error.reason || error.message || "Fund failed");
    } finally {
      setLoading(false);
    }
  }

  async function executeAction(action: string) {
    if (!walletProvider) return;

    try {
      setLoading(true);
      const signer = await getSigner();
      const escrow = new Contract(ESCROW_ADDRESS, EscrowABI.abi, signer);

      let tx;
      switch (action) {
        case "startWork":
          tx = await escrow.startWork(id);
          break;
        case "release":
          tx = await escrow.releasePayment(id);
          break;
        case "refund":
          tx = await escrow.refundClient(id);
          break;
        case "dispute":
          tx = await escrow.raiseDispute(id);
          break;
      }

      if (tx) {
        await tx.wait();
        onRefresh();
      }
    } catch (error: any) {
      console.error(error);
      alert(error.reason || error.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  }

  // Action availability
  const canFund = isClient && state === EscrowState.Created;
  const hasEnoughAllowance =
    allowance >= BigInt(Math.floor(parseFloat(fundAmount || "0") * 10 ** 6));
  const canStartWork = isClient && state === EscrowState.Funded;
  const canRelease = isClient && state === EscrowState.InProgress;
  const canRefund = isClient && state === EscrowState.InProgress;
  const canDispute =
    (isClient || isFreelancer) && state === EscrowState.InProgress;

  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Escrow #{id}</h3>
          <span
            className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
              ESCROW_STATE_COLORS[state as EscrowState]
            }`}
          >
            {ESCROW_STATE_LABELS[state as EscrowState]}
          </span>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-black">{formatUSDC(amount)}</p>
          <p className="text-xs text-black font-medium">USDC</p>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1 mb-4 text-sm">
        <p>
          <span className="text-gray-500">Client:</span>{" "}
          <span className="font-mono text-black">
            {shortenAddress(client)}
            {isClient && <span className="ml-2 text-blue-600">(you)</span>}
          </span>
        </p>
        <p>
          <span className="text-gray-500">Freelancer:</span>{" "}
          <span className="font-mono text-black">
            {shortenAddress(freelancer)}
            {isFreelancer && <span className="ml-2 text-blue-600">(you)</span>}
          </span>
        </p>
        <p>
          <span className="text-gray-500">Arbitrator:</span>{" "}
          <span className="font-mono text-black">
            {shortenAddress(arbitrator)}
          </span>
        </p>
      </div>

      {/* Yield Info */}
      {yieldActive && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-green-800">🧑‍🌾 Earning yield via Aave V3</p>
          {yieldEarned > 0n && (
            <p className="text-sm font-semibold text-green-900 mt-1">
              +{formatUSDC(yieldEarned, 6)} USDC earned
            </p>
          )}
        </div>
      )}

      {/* Fund Section */}
      {canFund && (
        <div className="border-t pt-4 mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Amount to fund (USDC)
            </label>
            <input
              type="number"
              min="0.000001"
              step="0.000001"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg text-sm focus:ring-0 focus:border-transparent"
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
              className="w-full py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition disabled:opacity-50"
            >
              {loading ? "Approving..." : `Approve ${fundAmount} USDC`}
            </button>
          ) : (
            <button
              onClick={handleFund}
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? "Funding..." : `Fund with ${fundAmount} USDC`}
            </button>
          )}
        </div>
      )}

      {/* Other Actions */}
      <div className="flex flex-wrap gap-2 mt-4">
        {canStartWork && (
          <button
            onClick={() => executeAction("startWork")}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "..." : "Start Work"}
          </button>
        )}
        {canRelease && (
          <button
            onClick={() => executeAction("release")}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "..." : "Release Payment"}
          </button>
        )}
        {canRefund && (
          <button
            onClick={() => executeAction("refund")}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          >
            {loading ? "..." : "Refund"}
          </button>
        )}
        {canDispute && (
          <button
            onClick={() => executeAction("dispute")}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition disabled:opacity-50"
          >
            {loading ? "..." : "Raise Dispute"}
          </button>
        )}
      </div>
    </div>
  );
}
