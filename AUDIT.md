# Security Audit Readiness

This document summarizes the security posture of the `EscrowWithYield` smart contract to assist third-party auditors.

## 1. Scope

The audit scope is limited to the following contract:

- `contracts/EscrowWithYield.sol`

_Note: The `contracts/mocks/` folder contains mock contracts used strictly for local Hardhat testing and is excluded from the audit scope._

## 2. Architecture Summary

The contract acts as an escrow for two parties (Client and Freelancer) mediated by a third party (Arbitrator).

- **Yield Generation:** Instead of sitting idle, the escrowed stablecoin (USDC) is supplied to Aave V3.
- **Accounting:** The contract tracks ownership using Aave's `scaledBalanceOf`. This ensures that even if multiple escrows share the same Aave position, yield is calculated fairly and proportionally.
- **State Machine:** The escrow progresses through: `Created` -> `Funded` -> `InProgress` -> `Released` | `Refunded` | `Disputed`.

## 3. Trust Assumptions & Privileged Roles

- **Aave V3:** The contract assumes the Aave V3 Pool is secure and behaves as documented. If Aave pauses or fails, the escrow falls back to holding the funds without yield (`yieldActive = false`).
- **Arbitrator:** In the event of a dispute, the designated `arbitrator` address has the authority to resolve the funds to either the client or the freelancer. In the current MVP, this is a trusted role.
- **Owner:** The owner can pause/unpause the protocol in case of emergencies, but cannot access user funds.

## 4. Invariants

The following must always hold true:

1.  The sum of all active `scaledATokenShares` for individual escrows must equal `totalScaledATokenShares`.
2.  A user can only withdraw the principal + yield if the state is strictly `Funded` (via refund) or `InProgress` (via release).
3.  The arbitrator fee is strictly capped at 10% of the _yield_, never the principal.

## 5. Automated Analysis (Slither)

The project includes a `slither.config.json` file. To reproduce the static analysis:

```bash
slither .
```
