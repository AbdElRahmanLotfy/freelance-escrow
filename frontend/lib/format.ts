import { formatUnits, parseUnits } from "ethers";
import { USDC_DECIMALS } from "./constants";

/**
 * Format USDC amount (bigint → string)
 * e.g., 10000000n → "10.00"
 */
export function formatUSDC(amount: bigint, decimals = 2): string {
  const formatted = formatUnits(amount, USDC_DECIMALS);
  return Number(formatted).toFixed(decimals);
}

/**
 * Parse USDC amount (string → bigint)
 * e.g., "10" → 10000000n
 */
export function parseUSDC(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}

/**
 * Shorten address for display
 * e.g., 0x1234...5678
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format a timestamp as a relative time
 */
export function formatRelativeTime(timestamp: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(timestamp);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
