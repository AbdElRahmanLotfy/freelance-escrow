export const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as string;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as string;
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532);

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
  [EscrowState.Created]: "bg-gray-100 text-gray-800",
  [EscrowState.Funded]: "bg-yellow-100 text-yellow-800",
  [EscrowState.InProgress]: "bg-blue-100 text-blue-800",
  [EscrowState.Released]: "bg-green-100 text-green-800",
  [EscrowState.Refunded]: "bg-purple-100 text-purple-800",
  [EscrowState.Disputed]: "bg-red-100 text-red-800",
};
