import {
  BrowserProvider,
  Contract,
  JsonRpcSigner,
  type Eip1193Provider,
} from "ethers";
import EscrowABI from "@/abi/EscrowWithYield.json";
import { ESCROW_ADDRESS } from "./constants";

/**
 * Get a read-only contract instance (for viewing data)
 */
export function getReadOnlyContract(provider: BrowserProvider): Contract {
  return new Contract(ESCROW_ADDRESS, EscrowABI.abi, provider);
}

/**
 * Cast Reown's walletProvider to ethers-compatible provider
 */
export function getBrowserProvider(walletProvider: unknown): BrowserProvider {
  return new BrowserProvider(walletProvider as Eip1193Provider);
}

/**
 * Get a writable contract instance (for sending transactions)
 */
export function getWritableContract(signer: JsonRpcSigner): Contract {
  return new Contract(ESCROW_ADDRESS, EscrowABI.abi, signer);
}

/**
 * Escrow details interface matching the Solidity struct
 */
export interface EscrowDetails {
  client: string;
  freelancer: string;
  arbitrator: string;
  amount: bigint;
  yieldEarned: bigint;
  startTime: bigint;
  duration: bigint;
  state: number;
  clientDisputed: boolean;
  freelancerDisputed: boolean;
  yieldActive: boolean;
}
