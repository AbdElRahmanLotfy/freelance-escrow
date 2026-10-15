"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { shortenAddress } from "@/lib/format";

interface AddressDisplayProps {
  address: string;
  isYou?: boolean;
  chars?: number;
}

export default function AddressDisplay({
  address,
  isYou = false,
  chars = 4,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied!", { duration: 1500 });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <button
      onClick={handleCopy}
      title={`Click to copy: ${address}`}
      className="group inline-flex items-center gap-1.5 font-mono text-sm hover:text-blue-400 transition-colors"
    >
      <span>{shortenAddress(address, chars)}</span>
      {isYou && <span className="text-blue-400 text-xs">(you)</span>}
      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? (
          <svg
            className="w-3.5 h-3.5 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
