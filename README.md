# 🏗️ Freelance Escrow with Yield

**A decentralized escrow protocol that turns idle locked funds into productive capital using Aave V3.**

Traditional freelance escrow locks client deposits for weeks or months earning nothing. This protocol solves that by automatically supplying USDC to Aave V3, where it generates real yield throughout the project duration. When work is released, the yield is split 70/30 between freelancer and client.

[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-blue)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-3.18-yellow)](https://hardhat.org/)
[![Base Sepolia](https://img.shields.io/badge/Network-Base%20Sepolia-blue)](https://sepolia.basescan.org/)
[![Aave V3](https://img.shields.io/badge/Aave-V3-purple)](https://aave.com/)
[![Tests](https://img.shields.io/badge/Tests-21%20passing-green)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Why It Matters](#-why-it-matters)
- [How It Works](#-how-it-works)
- [Live Deployment](#-live-deployment)
- [Architecture](#-architecture)
- [The Yield Mechanism](#-the-yield-mechanism)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Full Lifecycle Walkthrough](#-full-lifecycle-walkthrough)
- [Dispute Resolution — Real On-Chain Proof](#-dispute-resolution--real-on-chain-proof)
- [On-Chain Transaction Reference](#-on-chain-transaction-reference)
- [Testing](#-testing)
- [Security](#-security)
- [Roadmap](#-roadmap)
- [Connect](#-connect)
- [License](#-license)

---

## 🎯 Overview

**Freelance Escrow with Yield** is a blockchain-based escrow protocol that solves two problems simultaneously:

1. **Trust** — Funds are locked securely until work is complete
2. **Opportunity Cost** — Idle funds earn real yield through Aave V3

Instead of sitting dormant, deposited USDC is automatically supplied to Aave V3. The yield earned is split between freelancer and client when the work is released.

### Core Features

- 🔒 **Secure Escrow** — Funds locked until work is verified
- 💰 **Automatic Yield** — USDC deposited into Aave V3
- 🤝 **Fair Yield Split** — 70% freelancer bonus, 30% client discount
- ⚖️ **Dispute Resolution** — Arbitrator-mediated with yield-funded fees
- 🔄 **Multi-Escrow Support** — Multiple escrows share one Aave position
- ⏸️ **Emergency Pause** — Owner-controlled circuit breaker
- ✅ **Triple Verified** — BaseScan + Blockscout + Sourcify
- 🧪 **21 Passing Tests** — Comprehensive lifecycle coverage

---

## ❌ Why It Matters

Traditional freelance platforms lock client deposits without generating any value:

| Platform          | Funds Earn Yield?    | Freelancer Bonus? | Client Discount?    |
| ----------------- | -------------------- | ----------------- | ------------------- |
| Upwork Escrow     | ❌ No                | ❌ No             | ❌ No               |
| Fiverr            | ❌ No                | ❌ No             | ❌ No               |
| Traditional Banks | ⚠️ Only to the bank  | ❌ No             | ❌ No               |
| **This Protocol** | ✅ **Yes (Aave V3)** | ✅ **70% bonus**  | ✅ **30% discount** |

### Real Numbers

| Escrow Amount | Duration | APY | Yield Earned | Freelancer (+70%) | Client (+30%) |
| ------------- | -------- | --- | ------------ | ----------------- | ------------- |
| $1,000        | 2 weeks  | 5%  | $1.92        | $1.34             | $0.58         |
| $5,000        | 1 month  | 5%  | $20.83       | $14.58            | $6.25         |
| $20,000       | 3 months | 5%  | $250.00      | $175.00           | $75.00        |

**For small fast projects**, the yield is a bonus. **For large long-term projects**, it's a legitimate economic advantage.

---

## 🔄 How It Works

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. createEscrow(freelancer, arbitrator, duration)
       │ 2. fundEscrow(escrowId, amount)
       ▼
┌─────────────────────────┐
│   EscrowWithYield       │
│   (Smart Contract)      │
└──────────┬──────────────┘
           │ 3. supply(USDC, amount)
           ▼
┌─────────────────────────┐
│   Aave V3 Pool          │
│   (Yield Generation)    │
└──────────┬──────────────┘
           │ 4. aTokens minted to escrow
           │ 5. yield accrues over time
           ▼
┌─────────────────────────┐
│   Work Period           │
│   (Duration)            │
└──────────┬──────────────┘
           │ 6. releasePayment() / refundClient()
           ▼
┌─────────────────────────┐
│   Yield Split           │
│   70% → Freelancer      │
│   30% → Client          │
└─────────────────────────┘
```

### Escrow States

| State          | Description                             |
| -------------- | --------------------------------------- |
| **Created**    | Escrow initialized, awaiting funding    |
| **Funded**     | USDC deposited, earning yield in Aave   |
| **InProgress** | Work timer started                      |
| **Released**   | Payment sent to freelancer (with bonus) |
| **Refunded**   | Client refunded (with compensation)     |
| **Disputed**   | Under arbitration                       |

---

## 📍 Live Deployment

### Base Sepolia Testnet (Chain ID: 84532)

| Contract                | Address                                                                                                                         | Explorer |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **EscrowWithYield**     | [`0x7Ac175B1CC95c7b62F25405EA03Ab1FA8C3fc9C6`](https://sepolia.basescan.org/address/0x7Ac175B1CC95c7b62F25405EA03Ab1FA8C3fc9C6) | BaseScan |
| **USDC (Circle)**       | [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) | BaseScan |
| **Aave V3 Pool**        | [`0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b`](https://sepolia.basescan.org/address/0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b) | BaseScan |
| **aUSDC (aBasSepUSDC)** | [`0xf53B60F4006cab2b3C4688ce41fD5362427A2A66`](https://sepolia.basescan.org/address/0xf53B60F4006cab2b3C4688ce41fD5362427A2A66) | BaseScan |

### Verified On

- ✅ [BaseScan](https://sepolia.basescan.org/address/0x7Ac175B1CC95c7b62F25405EA03Ab1FA8C3fc9C6#code)
- ✅ [Blockscout](https://base-sepolia.blockscout.com/address/0x7Ac175B1CC95c7b62F25405EA03Ab1FA8C3fc9C6#code)
- ✅ [Sourcify](https://sourcify.dev/server/repo-ui/84532/0x7Ac175B1CC95c7b62F25405EA03Ab1FA8C3fc9C6)

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Frontend (Next.js)                  │
│         Reown AppKit + ethers v6 + Tailwind          │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│              EscrowWithYield.sol                     │
│  ┌────────────────────────────────────────────────┐  │
│  │ • createEscrow()                               │  │
│  │ • fundEscrow()     → Aave.supply()             │  │
│  │ • startWork()                                  │  │
│  │ • releasePayment() → Aave.withdraw()           │  │
│  │ • refundClient()                               │  │
│  │ • raiseDispute() / resolveDispute()            │  │
│  │ • pause() / unpause()                          │  │
│  └────────────────────────────────────────────────┘  │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│            Aave V3 Pool (Base Sepolia)               │
│        Real yield generation on USDC                 │
└──────────────────────────────────────────────────────┘
```

### Key Design Decisions

**1. Scaled aToken Share Accounting**

Multiple escrows share **one** Aave position. Each escrow tracks its `scaledATokenShares` — Aave's internal representation of ownership that stays constant while the underlying value grows.

```solidity
// When funding:
uint256 scaledBefore = aToken.scaledBalanceOf(address(this));
// ... supply to Aave ...
uint256 scaledAfter = aToken.scaledBalanceOf(address(this));
escrow.scaledATokenShares = scaledAfter - scaledBefore;
totalScaledATokenShares += escrow.scaledATokenShares;

// When releasing:
uint256 escrowValue = (aToken.balanceOf(address(this)) * escrow.scaledATokenShares)
                    / totalScaledATokenShares;
```

**2. Yield-Funded Arbitration**

During disputes, funds **keep earning yield** in Aave. The arbitrator's fee comes from the yield, never from the principal.

**3. Duration Enforcement**

`releasePayment()` requires the work period to have elapsed:

```solidity
require(block.timestamp >= escrow.startTime + escrow.duration, "Work period not finished");
```

**4. Multi-Token Safety**

Uses OpenZeppelin's `SafeERC20` with `forceApprove()` for compatibility with non-standard tokens.

**5. Emergency Pause**

Owner can `pause()` / `unpause()` to halt new escrows during an exploit or upstream failure.

---

## 💰 The Yield Mechanism

### How Aave aTokens Work

Aave aTokens have **two balances**:

- **`balanceOf(user)`** — current value (grows with yield)
- **`scaledBalanceOf(user)`** — share count (stays constant)

Example with 10% APY:
| Time | scaledBalanceOf | balanceOf |
|------|-----------------|-----------|
| Day 0 | 100 | 100 |
| Day 365 | 100 | 110 |

The **scaled balance** is your ownership share. The **actual balance** includes accrued yield.

### Our Accounting

Every escrow stores its `scaledATokenShares`. When releasing:

```
escrowValue = (totalATokenBalance × escrow.scaledATokenShares) / totalScaledATokenShares
```

This gives each escrow **exactly its proportional share** of the pool's yield — even when 100+ escrows share the same position.

### Yield Distribution

| Recipient      | Share                           | Rationale                  |
| -------------- | ------------------------------- | -------------------------- |
| **Freelancer** | 70%                             | Bonus for completing work  |
| **Client**     | 30%                             | Discount on service        |
| **Arbitrator** | 10% of yield (only on disputes) | Fee for dispute resolution |

### Rounding Edge Cases

Solidity truncates integer division. Our 21 tests verify:

- **1 wei yield:** `(1 * 70) / 100 = 0` → freelancer gets 0, client gets 1
- **10 wei yield:** `(10 * 70) / 100 = 7` → freelancer gets 7, client gets 3
- **No funds stuck:** Total distributed always equals total received

---

## 🛠️ Tech Stack

| Layer               | Technology        | Purpose                 |
| ------------------- | ----------------- | ----------------------- |
| **Smart Contracts** | Solidity 0.8.28   | Contract language       |
| **Framework**       | Hardhat 3.18      | Development environment |
| **Interactions**    | Viem 2.57         | Ethereum client         |
| **Security**        | OpenZeppelin 5.6  | Standards               |
| **Yield Protocol**  | Aave V3           | Real yield              |
| **Network**         | Base Sepolia (L2) | Deployment              |
| **Testing**         | node:test         | Built-in runner         |
| **Frontend**        | Next.js 16        | React framework         |
| **Wallet**          | Reown AppKit      | Connection              |
| **Frontend Web3**   | ethers v6         | Contract calls          |
| **Styling**         | Tailwind CSS 4    | UI                      |

---

## 📁 Project Structure

```
freelance-escrow/
├── contracts/
│   ├── EscrowWithYield.sol          # Main contract
│   └── mocks/
│       ├── MockAavePool.sol         # Aave V3 mock
│       ├── MockAToken.sol           # aUSDC mock
│       └── MockERC20.sol            # USDC mock
├── test/
│   └── Escrow.test.ts               # 21 passing tests
├── ignition/
│   └── modules/
│       └── EscrowBase.ts            # Base Sepolia deployment
├── scripts/
│   ├── approve-usdc.ts
│   ├── check-balance.ts
│   ├── check-escrow.ts
│   ├── check-escrow-config.ts
│   ├── create-escrow.ts
│   ├── find-resolves.ts
│   ├── fund-escrow.ts
│   ├── get-ausdc.ts
│   ├── release-payment.ts
│   ├── start-work.ts
│   ├── test-aave.ts
│   └── test-ai-atoken.ts
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Dashboard
│   │   ├── layout.tsx
│   │   └── providers.tsx            # AppKit
│   ├── components/
│   │   ├── ConnectButton.tsx
│   │   ├── EscrowStats.tsx
│   │   ├── CreateEscrowForm.tsx
│   │   ├── EscrowList.tsx
│   │   └── EscrowCard.tsx
│   ├── lib/
│   │   ├── constants.ts
│   │   ├── contract.ts
│   │   └── format.ts
│   └── abi/
│       └── EscrowWithYield.json
├── hardhat.config.ts
├── tsconfig.json
├── package.json
├── .env.example
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v22.13.0+
- **pnpm** (recommended) or npm
- **MetaMask** or any Web3 wallet
- **Testnet tokens**: Base Sepolia ETH + USDC

### 1. Clone the Repository

```bash
git clone https://github.com/AbdElRahmanLotfy/freelance-escrow.git
cd freelance-escrow
```

### 2. Install Dependencies

```bash
# Backend
pnpm install

# Frontend
cd frontend
pnpm install
cd ..
```

### 3. Configure Environment

Create `.env`:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# RPC URLs
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# Wallet
SEPOLIA_PRIVATE_KEY=0xyour_private_key

# Etherscan
ETHERSCAN_API_KEY=your_etherscan_key

# Deployed contract
ESCROW_ADDRESS=0x7Ac175B1CC95c7b62F25405EA03Ab1FA8C3fc9C6
```

Create `frontend/.env.local`:

```env
# WalletConnect Project ID (get from https://cloud.walletconnect.com/)
NEXT_PUBLIC_PROJECT_ID=your_walletconnect_project_id

# Deployed escrow contract
NEXT_PUBLIC_ESCROW_ADDRESS=0x7Ac175B1CC95c7b62F25405EA03Ab1FA8C3fc9C6

# USDC on Base Sepolia (Circle)
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Chain ID (84532 = Base Sepolia)
NEXT_PUBLIC_CHAIN_ID=84532
```

### 4. Get Test Tokens

You'll need two things on Base Sepolia:

- **SepoliaETH** for gas
- **USDC** for escrow funding

#### SepoliaETH (Gas)

Base Sepolia faucets typically require either a **mainnet ETH balance** or **proof of work**:

| Faucet                      | Requirement                          | Link                                                                             |
| --------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| Coinbase Developer Platform | CDP account + mainnet ETH balance ⚠️ | [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com/products/faucet)       |
| Sepolia PoW Faucet          | Browser mining (no mainnet ETH)      | [sepolia-faucet.pk910.de](https://sepolia-faucet.pk910.de/)                      |
| Alchemy                     | Alchemy account + mainnet ETH        | [alchemy.com/faucets/base-sepolia](https://www.alchemy.com/faucets/base-sepolia) |

> ⚠️ **Common blocker:** Most Base Sepolia faucets require a **mainnet ETH balance** (typically ≥ 0.001 ETH) to prevent bot abuse. If you don't have mainnet ETH, use the **PoW Faucet** (browser mining) or bridge from Ethereum Sepolia.

#### USDC (Escrow Funding)

| Faucet                | Requirement    | Link                                            |
| --------------------- | -------------- | ----------------------------------------------- |
| Circle Testnet Faucet | Circle account | [faucet.circle.com](https://faucet.circle.com/) |

> ⚠️ **Limit:** One request per asset/network every **2 hours**. Verify the USDC address matches `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

#### Network Bridges (Fallback)

If faucets fail, bridge from Ethereum Sepolia:

| Bridge          | Purpose                          | Link                                              |
| --------------- | -------------------------------- | ------------------------------------------------- |
| Superbridge     | Bridge SepoliaETH → Base Sepolia | [superbridge.app](https://superbridge.app/)       |
| Arbitrum Portal | Cross-chain transfers            | [portal.arbitrum.io](https://portal.arbitrum.io/) |

#### Recommended Flow

1. **Get Ethereum Sepolia ETH** from [Sepolia PoW Faucet](https://sepolia-faucet.pk910.de/) (no mainnet ETH needed)
2. **Bridge to Base Sepolia** using [Superbridge](https://superbridge.app/)
3. **Get USDC** from [Circle Faucet](https://faucet.circle.com/)
4. **Fund your escrow**

This flow avoids the mainnet ETH requirement entirely.

### 5. Add Base Sepolia to MetaMask

| Setting      | Value                          |
| ------------ | ------------------------------ |
| Network Name | Base Sepolia                   |
| RPC URL      | `https://sepolia.base.org`     |
| Chain ID     | `84532`                        |
| Symbol       | `ETH`                          |
| Explorer     | `https://sepolia.basescan.org` |

### 6. Run the Frontend

```bash
cd frontend
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🔄 Full Lifecycle Walkthrough

The complete flow has been tested end-to-end on Base Sepolia. Here's how it works.

### Step 1: Deploy the Contract

```bash
pnpm hardhat ignition deploy ignition/modules/EscrowBase.ts --network baseSepolia
```

**Deployed at:** `0x7Ac175B1CC95c7b62F25405EA03Ab1FA8C3fc9C6`

### Step 2: Create Escrow

The client calls `createEscrow(freelancer, arbitrator, duration)`.

**State:** `Created`

### Step 3: Fund Escrow

The client approves USDC, then calls `fundEscrow(escrowId, amount)`.

**What happens:**

1. USDC transferred from client → escrow contract
2. Escrow approves Aave to spend USDC
3. Escrow calls `AavePool.supply()` → aTokens minted to escrow
4. Escrow records `scaledATokenShares` for this specific escrow
5. `totalScaledATokenShares` and `totalYieldPrincipal` updated

**State:** `Funded` with `yieldActive: true` ✅

### Step 4: Start Work

The client calls `startWork(escrowId)`. This records `startTime`.

**State:** `InProgress`

### Step 5: Yield Accrues

While the escrow is `InProgress`, USDC sits in Aave V3 earning yield. The yield is proportional to:

- The principal amount
- The time elapsed
- The Aave V3 supply APY

### Step 6: Complete Work (3 paths)

**Path A — Release Payment**
Client calls `releasePayment(escrowId)`. Requires duration to have passed.

- Escrow withdraws from Aave
- Principal + 70% yield → freelancer
- 30% yield → client

**Path B — Refund**
Client calls `refundClient(escrowId)`.

- Escrow withdraws from Aave
- Principal + 100% yield → client

**Path C — Dispute**
Either party calls `raiseDispute(escrowId)`.

- Funds **stay in Aave** (still earning yield)
- Arbitrator calls `resolveDispute(escrowId, winner)`
- Principal + 90% yield → winner
- 10% yield → arbitrator

---

## ⚖️ Dispute Resolution — Real On-Chain Proof

The dispute flow has been executed end-to-end on Base Sepolia with both outcomes verified.

### Case 1: Freelancer Wins (Escrow #2)

| Field                | Value                                                     |
| -------------------- | --------------------------------------------------------- |
| Escrow               | #2 (10 USDC principal)                                    |
| Winner               | `0x1B9c6612F602AF4221295c0C085a676B74597746` (freelancer) |
| Winner received      | **10.00001 USDC** (principal + 90% of yield)              |
| Arbitrator fee       | **0.000001 USDC** (10% of yield)                          |
| Principal preserved  | ✅ 10 USDC returned to winner                             |
| Yield from principal | ❌ Never charged                                          |

**Transactions:**

- **Raise dispute:** [`0xcd4bef824e1e65cf7f90518c250aabfd503b9a817f5b32069ca347b8a085fbcc`](https://sepolia.basescan.org/tx/0xcd4bef824e1e65cf7f90518c250aabfd503b9a817f5b32069ca347b8a085fbcc)
- **Resolve for freelancer:** [`0x9d12d176382453b5728ced4751bf820e4534bc22e8c72ee4d6e8e129bd5515af`](https://sepolia.basescan.org/tx/0x9d12d176382453b5728ced4751bf820e4534bc22e8c72ee4d6e8e129bd5515af)

### Case 2: Client Wins (Escrow #3)

| Field                | Value                                                 |
| -------------------- | ----------------------------------------------------- |
| Escrow               | #3 (10 USDC principal)                                |
| Winner               | `0x98B7a3b289a20E5Fb382e309E830DB6DFa7D530E` (client) |
| Winner received      | **10.000007 USDC** (principal + 90% of yield)         |
| Arbitrator fee       | **0 USDC** (10% of 0.000007 rounds to 0)              |
| Principal preserved  | ✅ 10 USDC returned to winner                         |
| Yield from principal | ❌ Never charged                                      |

**Transactions:**

- **Raise dispute:** [`0x23ee3d44234da7d20d698e904a03ee2a2dcdcdbfe3b6db79bcd3ae0538404a07`](https://sepolia.basescan.org/tx/0x23ee3d44234da7d20d698e904a03ee2a2dcdcdbfe3b6db79bcd3ae0538404a07)
- **Resolve for client:** [`0xed597ebbea32aaf393d16c06f0935aa9df14729ce6e8c96609a9d5a745978098`](https://sepolia.basescan.org/tx/0xed597ebbea32aaf393d16c06f0935aa9df14729ce6e8c96609a9d5a745978098)

### Key Guarantees Verified

| Guarantee                          | Verified By                                     |
| ---------------------------------- | ----------------------------------------------- |
| Freelancer can win disputes        | Escrow #2 resolution                            |
| Client can win disputes            | Escrow #3 resolution                            |
| Arbitrator never charges principal | Both cases — fee was 10% of yield only          |
| Principal fully preserved          | Winner received ≥ 10 USDC in both cases         |
| Rounding to zero is safe           | Escrow #3 fee rounded to 0, no funds stuck      |
| Both parties can trigger disputes  | `raiseDispute` callable by client or freelancer |

---

## 📜 On-Chain Transaction Reference

All operations verified on Base Sepolia. Each hash links to BaseScan.

### Deployment

| Operation         | Transaction                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract creation | [`0x76b9e2c5344a4ee927b7653d8f4d39fa3cbbd5c340b39d83569b44882320f171`](https://sepolia.basescan.org/tx/0x76b9e2c5344a4ee927b7653d8f4d39fa3cbbd5c340b39d83569b44882320f171) |

### Dispute Lifecycle

| Operation             | Escrow | Transaction                                                                                                                                                                |
| --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dispute raised        | #2     | [`0xcd4bef824e1e65cf7f90518c250aabfd503b9a817f5b32069ca347b8a085fbcc`](https://sepolia.basescan.org/tx/0xcd4bef824e1e65cf7f90518c250aabfd503b9a817f5b32069ca347b8a085fbcc) |
| Resolved (freelancer) | #2     | [`0x9d12d176382453b5728ced4751bf820e4534bc22e8c72ee4d6e8e129bd5515af`](https://sepolia.basescan.org/tx/0x9d12d176382453b5728ced4751bf820e4534bc22e8c72ee4d6e8e129bd5515af) |
| Dispute raised        | #3     | [`0x23ee3d44234da7d20d698e904a03ee2a2dcdcdbfe3b6db79bcd3ae0538404a07`](https://sepolia.basescan.org/tx/0x23ee3d44234da7d20d698e904a03ee2a2dcdcdbfe3b6db79bcd3ae0538404a07) |
| Resolved (client)     | #3     | [`0xed597ebbea32aaf393d16c06f0935aa9df14729ce6e8c96609a9d5a745978098`](https://sepolia.basescan.org/tx/0xed597ebbea32aaf393d16c06f0935aa9df14729ce6e8c96609a9d5a745978098) |

### Deployed Contracts

| Contract        | Address                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| EscrowWithYield | [`0x7Ac175B1CC95c7b62F25405EA03Ab1FA8C3fc9C6`](https://sepolia.basescan.org/address/0x7Ac175B1CC95c7b62F25405EA03Ab1FA8C3fc9C6) |
| Aave V3 Pool    | [`0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b`](https://sepolia.basescan.org/address/0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b) |
| aUSDC           | [`0xf53B60F4006cab2b3C4688ce41fD5362427A2A66`](https://sepolia.basescan.org/address/0xf53B60F4006cab2b3C4688ce41fD5362427A2A66) |
| USDC            | [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |

---

## 🧪 Testing

### Run All Tests

```bash
pnpm hardhat test
```

**Expected Output:**

```
Running node:test tests

  EscrowWithYield
    ✔ Should create an escrow
    ✔ Should fund an escrow and record Aave shares
    ✔ Should calculate accrued yield correctly
    ✔ Should start work
    ✔ Should distribute yield 70/30 on release
    ✔ Should release principal when no yield is earned
    ✔ Should return principal and all yield on refund
    ✔ Should refund principal when no yield is earned
    ✔ Should allow the client to raise a dispute
    ✔ Should distribute dispute yield correctly
    ✔ Should allow the client to win a dispute
    ✔ Should account for multiple escrows sharing Aave
    ✔ Should preserve remaining escrow accounting after withdrawal
    ✔ Should reject release before the duration expires
    ✔ Should prevent a non-client from funding an escrow
    ✔ Should prevent an unrelated account from raising a dispute
    ✔ Should prevent a non-arbitrator from resolving a dispute
    ✔ Should pause and unpause the protocol
    ✔ Should prevent creating escrows while paused
    ✔ Should handle 1 wei of yield without losing funds
    ✔ Should split yield correctly when 70/30 is exact

21 passing
```

### What Each Test Verifies

| #   | Test                        | What It Proves                          |
| --- | --------------------------- | --------------------------------------- |
| 1   | Create escrow               | Client/freelancer/arbitrator assignment |
| 2   | Fund escrow                 | USDC transfer + aToken shares recorded  |
| 3   | Calculate yield             | Proportional share math is correct      |
| 4   | Start work                  | Timer starts, state transitions         |
| 5   | Release 70/30               | Freelancer gets 70%, client 30%         |
| 6   | Release no yield            | Principal returned exactly              |
| 7   | Refund with yield           | Client gets principal + 100% yield      |
| 8   | Refund no yield             | Principal returned exactly              |
| 9   | Raise dispute               | Unilateral dispute triggers state       |
| 10  | Dispute yield split         | Arbitrator 10%, winner 90% + principal  |
| 11  | Dispute won by client       | Symmetric case verified                 |
| 12  | Multiple escrows share Aave | Proportional accounting correct         |
| 13  | Withdraw doesn't corrupt    | Remaining escrow's shares intact        |
| 14  | Release before duration     | Reverts correctly                       |
| 15  | Non-client fund             | Access control enforced                 |
| 16  | Unrelated dispute           | Access control enforced                 |
| 17  | Non-arbitrator resolve      | Access control enforced                 |
| 18  | Pause/unpause               | Owner control works                     |
| 19  | Paused creation             | Cannot create new escrows               |
| 20  | 1 wei yield                 | No funds lost on tiny yields            |
| 21  | Exact 70/30 split           | Integer math correct                    |

---

## 🔒 Security

### Security Features

- ✅ **ReentrancyGuard** on all state-changing functions with external calls
- ✅ **Ownable2Step** — two-step ownership transfer prevents accidental lockout
- ✅ **SafeERC20** — handles non-standard ERC20 tokens
- ✅ **Access control** — client/freelancer/arbitrator modifiers
- ✅ **State validation** — `inState` modifier prevents invalid transitions
- ✅ **Emergency pause** — owner-controlled circuit breaker
- ✅ **Duration enforcement** — work must complete before release
- ✅ **Atomic yield split** — 70/30 verified by 21 tests
- ✅ **Proportional share accounting** — no rounding exploits

### Known Limitations

- ⚠️ **Single arbitrator** — no decentralized arbitration (Kleros integration planned)
- ⚠️ **No time-lock auto-release** — if client disappears, freelancer can't force release
- ⚠️ **Testnet only** — not audited for mainnet
- ⚠️ **Testnet APY is inflated** — real APY on Base Mainnet is ~4-8%

### Recommended Improvements

- [ ] **Kleros integration** — decentralized arbitration
- [ ] **14-day time-lock auto-release** — prevent deadlock
- [ ] **Multi-signature arbitration** — for high-value escrows
- [ ] **Reputation system** — track successful completions
- [ ] **Milestone-based payments** — release in stages
- [ ] **Multi-token support** — ETH, DAI, USDT

---

## 🗺️ Roadmap

### Phase 1: Backend ✅ Complete

- [x] Smart contract with Aave V3 integration
- [x] Scaled aToken share accounting
- [x] 21 passing tests
- [x] Base Sepolia deployment
- [x] Triple-verified on explorers (BaseScan, Blockscout, Sourcify)
- [x] Full lifecycle tested
- [x] Real yield accrual confirmed
- [x] Dispute resolution tested with real on-chain proof

### Phase 2: Frontend ✅ Complete

- [x] Next.js 16 dashboard
- [x] Reown AppKit wallet connection
- [x] Create escrow UI
- [x] Fund escrow with USDC approval flow
- [x] Escrow cards with real-time state
- [x] Yield display with Aave V3 indicator
- [x] Dispute resolution buttons (both outcomes)
- [x] Dark mode — full app dark theme
- [x] Copyable addresses — click-to-copy with toast confirmation

### Phase 3: Polish ✅ Complete

- [x] Toast notifications — replaced all `alert()` calls with `react-hot-toast`
- [x] Auto-refresh — polling every 15s + refresh after transactions
- [x] Loading skeletons — animated placeholder cards during load
- [x] Per-action loading states — spinners on approve/fund/release/dispute buttons
- [x] Multi-escrow dashboard with filters — All / Active / Completed
- [x] Sort options — Newest, Oldest, Highest amount
- [x] Empty states — friendly UI when no escrows exist or filter returns nothing

### Phase 4: Production 🚀 In Progress

- [x] Frontend deployed to Vercel — live at [freelance-escrow-rose.vercel.app](https://freelance-escrow-rose.vercel.app)
- [x] Reown domain allowlist configured — production wallet connect working
- [x] Alchemy RPC — migrated from Infura for multi-chain support
- [ ] Base Mainnet deployment
- [ ] Security audit
- [ ] Gas optimization report

### Phase 5: Advanced 🔮 Planned

- [ ] Kleros integration — decentralized arbitration
- [ ] Time-lock auto-release — 14-day fallback if client disappears
- [ ] Real-time yield ticker — live-updating yield display
- [ ] Mobile responsive design — optimized for phones/tablets
- [ ] Multi-token support — ETH, DAI, USDT
- [ ] Reputation system — track successful completions
- [ ] Milestone-based payments — release funds in stages
- [ ] DAO governance — community-driven protocol upgrades

---

## Key Milestones Achieved

| Milestone                                 | Proof                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Contract deployed to Base Sepolia         | [BaseScan](https://sepolia.basescan.org/address/0x7Ac175B1CC95c7b62F25405EA03Ab1FA8C3fc9C6) |
| 21 tests passing                          | Local test suite                                                                            |
| First successful fund with Aave V3        | On-chain transaction                                                                        |
| Dispute resolution tested (both outcomes) | 4 verified transactions                                                                     |
| **Frontend live on Vercel**               | [freelance-escrow-rose.vercel.app](https://freelance-escrow-rose.vercel.app)                |

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Aave](https://aave.com/) — Yield protocol
- [OpenZeppelin](https://openzeppelin.com/) — Security standards
- [Hardhat](https://hardhat.org/) — Development environment
- [Viem](https://viem.sh/) — Ethereum interaction
- [Base](https://base.org/) — L2 network
- [Circle](https://circle.com/) — USDC
- [Reown](https://reown.com/) — Wallet connection

---

## 📞 Connect

**Abdelrahman Lotfy**

- 🐙 **GitHub:** [@AbdElRahmanLotfy](https://github.com/AbdElRahmanLotfy)
- 💼 **LinkedIn:** [abdelrahmanlotfy](https://www.linkedin.com/in/abdelrahmanlotfy-a051bb174)
- 📧 **Email:** [abdelrahmannnn11@gmail.com](mailto:abdelrahmannnn11@gmail.com)
- 🎵 **SoundCloud:** [Abdelrahman Lotfy](https://soundcloud.com/abdelrahman-lotfy-650305495)
- 🎮 **Overwatch:** [Career Profile](https://overwatch.blizzard.com/en-us/career/d35ca8afbf4393a0e8fe26a1c903a50b4d%7Ce0f041b6b275376214d42347cd250362/)

---

**Built with ❤️ on Base Sepolia by Abdelrahman Lotfy**
