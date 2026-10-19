export const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as string;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as string;
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532);
export const AAVE_POOL_ADDRESS = "0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b";

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

// Escrow states
export enum EscrowState {
  Created = 0,
  Funded = 1,
  InProgress = 2,
  Released = 3,
  Refunded = 4,
  Disputed = 5,
}

export const ESCROW_STATE_LABELS: Record<EscrowState, string> = {
  [EscrowState.Created]: "Created",
  [EscrowState.Funded]: "Funded",
  [EscrowState.InProgress]: "In Progress",
  [EscrowState.Released]: "Released",
  [EscrowState.Refunded]: "Refunded",
  [EscrowState.Disputed]: "Disputed",
};

export const ESCROW_STATE_COLORS: Record<EscrowState, string> = {
  [EscrowState.Created]: "bg-gray-800 text-gray-300 border border-gray-700",
  [EscrowState.Funded]:
    "bg-yellow-950/50 text-yellow-300 border border-yellow-900/50",
  [EscrowState.InProgress]:
    "bg-blue-950/50 text-blue-300 border border-blue-900/50",
  [EscrowState.Released]:
    "bg-green-950/50 text-green-300 border border-green-900/50",
  [EscrowState.Refunded]:
    "bg-purple-950/50 text-purple-300 border border-purple-900/50",
  [EscrowState.Disputed]: "bg-red-950/50 text-red-300 border border-red-900/50",
};
