# 🏗️ Freelance Escrow with Yield

A decentralized freelance escrow service that automatically generates yield on deposited funds, benefiting both clients and freelancers.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
- [Yield Distribution](#yield-distribution)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Smart Contract](#smart-contract)
- [Testing](#testing)
- [Deployment](#deployment)
- [Frontend](#frontend)
- [Scripts](#scripts)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**Freelance Escrow with Yield** is a blockchain-based escrow service that solves two common problems:

1. **Trust issues** between clients and freelancers
2. **Idle funds** during the work period

Instead of locking funds in a dormant contract, this protocol automatically generates yield on deposited USDC, creating value for all parties involved.

---

## Features

### 🔒 Secure Escrow

- Client deposits USDC into the contract
- Funds are locked until work is completed
- Dispute resolution mechanism with arbitrator

### 💰 Automatic Yield Generation

- Deposited funds earn yield while freelancer works
- Yield is split between client and freelancer
- No manual staking required

### ⚖️ Dispute Resolution

- Both parties must agree to raise a dispute
- Arbitrator resolves disputes
- Arbitrator fee paid from generated yield

### 🎯 Multiple Escrow States

- **Created** - Escrow is initialized
- **Funded** - Client deposited USDC
- **In Progress** - Work is ongoing
- **Released** - Payment sent to freelancer
- **Refunded** - Client received refund
- **Disputed** - Under arbitration

---

## How It Works

### 1. Create Escrow
