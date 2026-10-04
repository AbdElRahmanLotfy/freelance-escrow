# 🏗️ Freelance Escrow with Yield

A decentralized freelance escrow service that automatically generates yield on deposited USDC through Aave V3, benefiting both clients and freelancers.

[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-blue)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-3.x-yellow)](https://hardhat.org/)
[![Base Sepolia](https://img.shields.io/badge/Network-Base%20Sepolia-blue)](https://sepolia.basescan.org/)
[![Aave V3](https://img.shields.io/badge/Aave-V3-purple)](https://aave.com/)
[![Tests](https://img.shields.io/badge/Tests-4%20passing-green)]()

---

## 📋 Table of Contents

- [Overview](#-overview)
- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [How It Works](#-how-it-works)
- [Yield Distribution](#-yield-distribution)
- [Architecture](#-architecture)
- [Deployed Contracts](#-deployed-contracts)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Smart Contract](#-smart-contract)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Scripts](#-scripts)
- [Full Lifecycle Walkthrough](#-full-lifecycle-walkthrough)
- [Real Yield Example](#-real-yield-example)
- [Security](#-security)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🎯 Overview

**Freelance Escrow with Yield** is a blockchain-based escrow protocol that solves two problems simultaneously:

1. **Trust** — Funds are locked securely until work is complete
2. **Opportunity Cost** — Idle funds earn real yield through Aave V3

Instead of sitting dormant in a contract, deposited USDC is automatically supplied to Aave V3. The yield earned is split between freelancer and client when the work is released.

---

## ❌ The Problem

Traditional freelance escrow has a critical flaw: **money sits idle**.

- Client deposits $5,000 for a 1-month project
- Funds are locked in escrow, earning nothing
- Freelancer waits for payment
- Neither party benefits from the deposited capital

**Opportunity cost:** At 5% APY, that $5,000 could have earned ~$20.83 in a month.

---

## ✅ The Solution

**Auto-yield escrow using Aave V3:**

1. Client deposits USDC
2. Contract supplies USDC to Aave V3
3. Yield accrues automatically
4. On release: **70% freelancer bonus, 30% client discount**
5. Both parties win

---

## 🔄 How It Works

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. createEscrow()
       │ 2. fundEscrow(amount)
       ▼
┌─────────────────────────┐
│   EscrowWithYield       │
│   (Smart Contract)      │
└──────────┬──────────────┘
           │ 3. supply(amount)
           ▼
┌─────────────────────────┐
│   Aave V3 Pool          │
│   (Yield Generation)    │
└──────────┬──────────────┘
           │ 4. yield accrues over time
           │ 5. withdraw(principal + yield)
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

## 💰 Yield Distribution

| Party          | Share        | Rationale                  |
| -------------- | ------------ | -------------------------- |
| **Freelancer** | 70%          | Bonus for completing work  |
| **Client**     | 30%          | Discount on service        |
| **Arbitrator** | 10% of yield | Fee for dispute resolution |

### Real Example

| Scenario         | Amount  | Duration | APY | Total Yield | Freelancer | Client |
| ---------------- | ------- | -------- | --- | ----------- | ---------- | ------ |
| Small project    | $1,000  | 2 weeks  | 5%  | $1.92       | $1.34      | $0.58  |
| Medium project   | $5,000  | 1 month  | 5%  | $20.83      | $14.58     | $6.25  |
| Large enterprise | $20,000 | 3 months | 5%  | $250.00     | $175.00    | $75.00 |

**Takeaway:** For small fast projects, yield is a bonus. For large long-term projects, it's a **legitimate economic advantage** over Web2 platforms.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────┐
│                  Frontend (TBD)                  │
│        Next.js 14 + Reown AppKit + ethers        │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│              EscrowWithYield.sol                 │
│  ┌────────────────────────────────────────────┐  │
│  │ • createEscrow()                           │  │
│  │ • fundEscrow() → Aave.supply()             │  │
│  │ • startWork()                              │  │
│  │ • releasePayment() → Aave.withdraw()       │  │
│  │ • refundClient()                           │  │
│  │ • raiseDispute() / resolveDispute()        │  │
│  │ • pause() / unpause()                      │  │
│  └────────────────────────────────────────────┘  │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│            Aave V3 Pool (Base Sepolia)           │
│        Real yield generation on USDC             │
└──────────────────────────────────────────────────┘
```

---

## 📍 Deployed Contracts

### Base Sepolia Testnet (Chain ID: 84532)

| Contract            | Address                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **EscrowWithYield** | [`0x96266591403b08e7ccF01500fbc74547fD6F4E13`](https://sepolia.basescan.org/address/0x96266591403b08e7ccF01500fbc74547fD6F4E13) |
| **USDC (Circle)**   | [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |
| **Aave V3 Pool**    | [`0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b`](https://sepolia.basescan.org/address/0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b) |

### Verified On

- ✅ [BaseScan](https://sepolia.basescan.org/address/0x96266591403b08e7ccF01500fbc74547fD6F4E13#code)
- ✅ [Blockscout](https://base-sepolia.blockscout.com/address/0x96266591403b08e7ccF01500fbc74547fD6F4E13#code)
- ✅ [Sourcify](https://sourcify.dev/server/repo-ui/84532/0x96266591403b08e7ccF01500fbc74547fD6F4E13)

---

## 🛠️ Technology Stack

### Smart Contracts

| Technology   | Version | Purpose                 |
| ------------ | ------- | ----------------------- |
| Solidity     | 0.8.28  | Contract language       |
| Hardhat      | 3.15+   | Development environment |
| Viem         | 2.55+   | Ethereum interaction    |
| OpenZeppelin | 5.6+    | Security standards      |
| Aave V3      | -       | Yield protocol          |

### Testing

| Technology      | Version  | Purpose             |
| --------------- | -------- | ------------------- |
| node:test       | Built-in | Test runner         |
| Viem Assertions | -        | Contract assertions |

### Deployment

| Technology                    | Purpose                  |
| ----------------------------- | ------------------------ |
| Hardhat Ignition              | Deployment orchestration |
| Etherscan/Blockscout/Sourcify | Contract verification    |

---

## 📁 Project Structure

```
freelance-escrow/
├── contracts/
│   ├── EscrowWithYield.sol          # Main escrow contract
│   └── mocks/
│       ├── MockERC20.sol            # Test USDC
│       └── MockYieldStrategy.sol    # Aave V3 mock for testing
├── ignition/
│   └── modules/
│       ├── Escrow.ts                # Sepolia deployment
│       └── EscrowBase.ts            # Base Sepolia deployment
├── test/
│   └── Escrow.test.ts               # 4 passing tests
├── scripts/
│   ├── approve-usdc.ts              # Approve USDC spending
│   ├── check-balance.ts             # Check USDC balance
│   ├── check-balances.ts            # Check both parties' balances
│   ├── check-escrow.ts              # View escrow state
│   ├── create-escrow.ts             # Create new escrow
│   ├── fund-escrow.ts               # Fund escrow
│   ├── start-work.ts                # Start work timer
│   ├── release-payment.ts           # Release with yield split
│   └── test-aave.ts                 # Direct Aave test
├── hardhat.config.ts                # Hardhat 3 configuration
├── tsconfig.json                    # TypeScript configuration
├── .env                             # Environment variables
├── .env.example                     # Environment template
├── package.json                     # Dependencies
└── README.md                        # This file
```

---

## 📋 Prerequisites

### Required Software

- **Node.js** v22.13.0 or higher
- **npm** or **pnpm**
- **Git**
- **MetaMask** (or any Web3 wallet)
- **VS Code** (recommended)

### Required Accounts

- **Infura** or **Alchemy** (RPC URL)
- **Etherscan** (contract verification)
- **Circle Faucet** (test USDC)
- **Base Sepolia Faucet** (test ETH)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/freelance-escrow.git
cd freelance-escrow
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# RPC URLs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
BASE_SEPOLIA_RPC_URL=https://base-sepolia.infura.io/v3/YOUR_KEY

# Wallet
SEPOLIA_PRIVATE_KEY=0xyour_private_key_here

# Etherscan
ETHERSCAN_API_KEY=your_etherscan_api_key

# Deployed contract (fill after deployment)
ESCROW_ADDRESS=0x96266591403b08e7ccF01500fbc74547fD6F4E13
```

### 4. Get Test Funds

- **SepoliaETH**: [Coinbase Faucet](https://www.coinbase.com/faucets/base-sepolia-faucet) or [Alchemy Faucet](https://www.alchemy.com/faucets/base-sepolia)
- **USDC**: [Circle Faucet](https://faucet.circle.com/)

### 5. Add Base Sepolia to MetaMask

| Setting      | Value                          |
| ------------ | ------------------------------ |
| Network Name | Base Sepolia                   |
| RPC URL      | `https://sepolia.base.org`     |
| Chain ID     | `84532`                        |
| Symbol       | `ETH`                          |
| Explorer     | `https://sepolia.basescan.org` |

---

## ⚙️ Configuration

### Hardhat Configuration (`hardhat.config.ts`)

```typescript
import { defineConfig, configVariable } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";

export default defineConfig({
  plugins: [hardhatToolboxViem, hardhatNetworkHelpers],
  solidity: {
    profiles: {
      default: { version: "0.8.28" },
      production: {
        version: "0.8.28",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    },
  },
  networks: {
    hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
    hardhatOp: { type: "edr-simulated", chainType: "op" },
    baseSepolia: {
      type: "http",
      chainType: "op",
      url: configVariable("BASE_SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
      gasMultiplier: 1.2,
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
  verify: {
    etherscan: { apiKey: configVariable("ETHERSCAN_API_KEY") },
  },
});
```

---

## 📜 Smart Contract

### Key Functions

| Function                                         | Access            | Description                    |
| ------------------------------------------------ | ----------------- | ------------------------------ |
| `createEscrow(freelancer, arbitrator, duration)` | Client            | Create new escrow              |
| `fundEscrow(id, amount)`                         | Client            | Deposit USDC → Aave V3         |
| `startWork(id)`                                  | Client            | Start work timer               |
| `releasePayment(id)`                             | Client            | Release payment + yield split  |
| `refundClient(id)`                               | Client            | Refund with yield compensation |
| `raiseDispute(id)`                               | Client/Freelancer | Raise dispute                  |
| `resolveDispute(id, winner)`                     | Arbitrator        | Resolve dispute                |
| `pause()` / `unpause()`                          | Owner             | Emergency pause                |
| `getEscrow(id)`                                  | Anyone            | View escrow details            |

### Events

```solidity
event EscrowCreated(uint256 indexed escrowId, address client, address freelancer, uint256 duration);
event EscrowFunded(uint256 indexed escrowId, uint256 amount, bool yieldActive);
event EscrowStarted(uint256 indexed escrowId, uint256 startTime);
event EscrowReleased(uint256 indexed escrowId, address freelancer, uint256 amount, uint256 yieldBonus);
event EscrowRefunded(uint256 indexed escrowId, address client, uint256 amount, uint256 yieldCompensation);
event DisputeRaised(uint256 indexed escrowId, address raisedBy);
event DisputeResolved(uint256 indexed escrowId, address winner, uint256 amount, uint256 arbitratorFee);
event Paused();
event Unpaused();
```

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

**Expected output:**

```
Running node:test tests

  EscrowWithYield
    ✔ Should create an escrow
    ✔ Should fund an escrow
    ✔ Should release payment with yield bonus
    ✔ Should refund client with yield compensation

4 passing
```

### Test Coverage

| Test                | What It Validates                          |
| ------------------- | ------------------------------------------ |
| **Create Escrow**   | Client, freelancer, arbitrator assignments |
| **Fund Escrow**     | USDC transfer + Aave supply                |
| **Release Payment** | Yield split + freelancer payment           |
| **Refund Client**   | Yield compensation + state transition      |

---

## 🚢 Deployment

### Deploy to Base Sepolia

```bash
npm run deploy:base
```

**Output:**

```
Hardhat Ignition 🚀

Deploying [ EscrowBaseModule ]

Batch #1
  Executed EscrowBaseModule#EscrowWithYield

[ EscrowBaseModule ] successfully deployed 🚀

Deployed Addresses
EscrowBaseModule#EscrowWithYield - 0x96266591403b08e7ccF01500fbc74547fD6F4E13
```

### Verify Contract

```bash
npx hardhat ignition verify chain-84532 --network baseSepolia
```

**Verified on:**

- BaseScan
- Blockscout
- Sourcify

---

## 📜 Scripts

### Available Commands

| Script              | Command                  | Description                  |
| ------------------- | ------------------------ | ---------------------------- |
| Check Balance       | `npm run check-balance`  | Get USDC balance             |
| Check Both Balances | `npm run check-balances` | Client + freelancer balances |
| Check Escrow        | `npm run check-escrow`   | View escrow state            |
| Approve USDC        | `npm run approve`        | Approve escrow spending      |
| Create Escrow       | `npm run create-escrow`  | Create new escrow            |
| Fund Escrow         | `npm run fund`           | Fund escrow → Aave           |
| Start Work          | `npm run start-work`     | Start work timer             |
| Release             | `npm run release`        | Release payment              |

---

## 🔄 Full Lifecycle Walkthrough

### Real Test on Base Sepolia

Here's the complete lifecycle with **actual transaction hashes** from the test run:

#### 1. Deploy Contract

```bash
npm run deploy:base
```

**Contract:** `0x96266591403b08e7ccF01500fbc74547fD6F4E13`

#### 2. Approve USDC Spending

```bash
npm run approve
```

**Transaction:** [`0x43451a641a108ad311e8d7a81e902e36de08b75b1c32ce48d7dd3b6268485787`](https://sepolia.basescan.org/tx/0x43451a641a108ad311e8d7a81e902e36de08b75b1c32ce48d7dd3b6268485787)

#### 3. Create Escrow #0

```bash
npm run create-escrow
```

**Transaction:** [`0xb89f6753bbd92fb8ca23a88d443f6839e2d6652dfa6d6080e2175a1d5f243150`](https://sepolia.basescan.org/tx/0xb89f6753bbd92fb8ca23a88d443f6839e2d6652dfa6d6080e2175a1d5f243150)

| Field      | Value                                        |
| ---------- | -------------------------------------------- |
| Client     | `0x98b7a3b289a20e5fb382e309e830db6dfa7d530e` |
| Freelancer | `0x1B9c6612F602AF4221295c0C085a676B74597746` |
| Arbitrator | `0x98b7a3b289a20e5fb382e309e830db6dfa7d530e` |
| Duration   | 7 days                                       |

#### 4. Fund Escrow with 10 USDC

```bash
npm run fund
```

**Transaction:** [`0xea1514a086cb6e030e583ade0d2c4ba1f8c75c9d4309c9be1de02d40699b9e26`](https://sepolia.basescan.org/tx/0xea1514a086cb6e030e583ade0d2c4ba1f8c75c9d4309c9be1de02d40699b9e26)

**Result:** `Yield Active: true` — USDC now earning yield in Aave V3 ✅

#### 5. Start Work

```bash
npm run start-work
```

**Transaction:** [`0x4a036e85d25b908afad2d4bc269847b78bff7dc407f2ddbab0e6ed7a15303895`](https://sepolia.basescan.org/tx/0x4a036e85d25b908afad2d4bc269847b78bff7dc407f2ddbab0e6ed7a15303895)

#### 6. Release Payment

```bash
npm run release
```

**Transaction:** [`0x5a22da6011f09e11362f414ad03de3cbdce3f993212ba802929f1ef7a94d8716`](https://sepolia.basescan.org/tx/0x5a22da6011f09e11362f414ad03de3cbdce3f993212ba802929f1ef7a94d8716)

#### 7. Verify Yield Split

```bash
npm run check-balances
```

**Before vs After:**

| Account    | Before     | After          | Change          |
| ---------- | ---------- | -------------- | --------------- |
| Client     | 39.00 USDC | 39.000304 USDC | +0.000304 USDC  |
| Freelancer | 30.00 USDC | 40.000708 USDC | +10.000708 USDC |

**Yield Breakdown:**

- Total yield: **0.001012 USDC**
- Freelancer bonus (70%): **0.000708 USDC**
- Client discount (30%): **0.000304 USDC**

**Math verified:** ✅

---

## 💵 Real Yield Example

### Why the Yield is Small in the Demo

The yield was tiny because the escrow was funded and released in **~30 seconds**. The yield formula is:

```
Yield = Amount × APY × (Time / 365 days)
```

With:

- Amount = 10 USDC
- APY = 107% (testnet rate)
- Time = 30 seconds

**Result:** 0.001012 USDC

### Mainnet Projection (5% APY)

| Escrow  | Duration | Freelancer Bonus | Client Discount |
| ------- | -------- | ---------------- | --------------- |
| $100    | 1 week   | $0.067           | $0.029          |
| $500    | 2 weeks  | $0.67            | $0.29           |
| $5,000  | 1 month  | $14.58           | $6.25           |
| $20,000 | 3 months | $175.00          | $75.00          |

**On mainnet, this is a legitimate economic advantage.**

---

## 🔒 Security

### Security Features

- ✅ **ReentrancyGuard** — Prevents reentrancy attacks
- ✅ **Ownable** — Administrative functions protected
- ✅ **Role-based access** — Client / Freelancer / Arbitrator modifiers
- ✅ **State validation** — `inState` modifier
- ✅ **Emergency pause** — `pause()` / `unpause()`
- ✅ **Safe math** — Solidity 0.8.x overflow protection
- ✅ **Event logging** — All state changes logged
- ✅ **Aave V3** — Battle-tested yield protocol

### Known Limitations

- ⚠️ Simplified arbitration (no Kleros integration yet)
- ⚠️ No time-lock auto-release (in case of client disappearance)
- ⚠️ Testnet APY is inflated (107% vs 4-8% mainnet)

### Recommended Improvements

- [ ] Kleros integration for decentralized arbitration
- [ ] 14-day time-lock auto-release
- [ ] Multi-signature arbitration
- [ ] Reputation system
- [ ] Milestone-based payments

---

## 🗺️ Roadmap

### Phase 1: Backend ✅

- [x] Smart contract with Aave V3
- [x] Hardhat 3 + Viem setup
- [x] 4 passing tests
- [x] Base Sepolia deployment
- [x] Triple-verified on explorers
- [x] Full lifecycle tested
- [x] Real yield generation confirmed

### Phase 2: Frontend 🚧

- [ ] Next.js 14 app
- [ ] Reown AppKit wallet connection
- [ ] Create escrow UI
- [ ] Escrow dashboard
- [ ] Release / refund actions

### Phase 3: Production 📦

- [ ] Base Mainnet deployment
- [ ] Real Aave V3 on mainnet
- [ ] Security audit
- [ ] Gas optimization

### Phase 4: Advanced 🚀

- [ ] Kleros arbitration
- [ ] Time-lock auto-release
- [ ] Reputation system
- [ ] Multi-token support
- [ ] DAO governance

---

## 📄 License

MIT License — see [https://github.com/AbdElRahmanLotfy/freelance-escrow?tab=MIT-1-ov-file](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Aave](https://aave.com/) — Yield protocol
- [OpenZeppelin](https://openzeppelin.com/) — Security standards
- [Hardhat](https://hardhat.org/) — Development environment
- [Viem](https://viem.sh/) — Ethereum interaction
- [Base](https://base.org/) — L2 network
- [Circle](https://circle.com/) — USDC

---

**Built with ❤️ on Base Sepolia**
