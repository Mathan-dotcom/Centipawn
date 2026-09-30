# Centipawn Chess (EvalStake Chess PRD v2.1)

> **Base-First Evaluation-Based Proportional-Payout Chess Wagering on Base Sepolia**

Centipawn Chess replaces binary winner-take-all wagering with a continuous, evaluation-based payout mechanism. Players stake equal amounts of testnet USDC into a smart contract escrow on Base Sepolia. At match conclusion, an authorized oracle calculates the evaluation score via Stockfish, signs the attestation, and settles the escrow on-chain according to the PRD §11 proportional payout formula.

---

## Verified Deployments & On-Chain Addresses (Base Sepolia — Chain ID: 84532)

| Component | Address / Identifier | BaseScan Link |
| :--- | :--- | :--- |
| **EvalStakeEscrow Contract** | `0xBe5cD1b1c18e1aAb2360C9333eE9b941A2EA7eAc` | [View on BaseScan](https://sepolia.basescan.org/address/0xBe5cD1b1c18e1aAb2360C9333eE9b941A2EA7eAc) |
| **Circle Testnet USDC** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | [View on BaseScan](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |
| **Trusted Oracle Signer** | `0x0BB6F08D2bf966b87CFBdCBce81efBF1a3F661a6` | [View on BaseScan](https://sepolia.basescan.org/address/0x0BB6F08D2bf966b87CFBdCBce81efBF1a3F661a6) |

---

## Live Verified Match Lifecycle Transactions

The full on-chain wagering and settlement lifecycle has been executed and confirmed on Base Sepolia:

1. **Escrow Contract Deployment**:  
   [`0x6b44b75301ed2217c2d2c980a001aa59d68240512a8c38f3dd3706eeed78aa64`](https://sepolia.basescan.org/tx/0x6b44b75301ed2217c2d2c980a001aa59d68240512a8c38f3dd3706eeed78aa64)
2. **Player A Match Creation & USDC Stake Deposit (`createMatch`)**:  
   [`0x482e677c3220a103306c3963bc60e6b670ac234eb4ef3b059a618b1317a0b49b`](https://sepolia.basescan.org/tx/0x482e677c3220a103306c3963bc60e6b670ac234eb4ef3b059a618b1317a0b49b)
3. **Player B Matching Stake Deposit (`joinMatch`)**:  
   [`0x2ccacd59d745fc2e154f97bd61524c225e6e100ebbf9cf482f2fa45e43acb79e`](https://sepolia.basescan.org/tx/0x2ccacd59d745fc2e154f97bd61524c225e6e100ebbf9cf482f2fa45e43acb79e)
4. **Oracle Live Settlement & USDC Payout Disbursement (`settle`)**:  
   [`0xaaa92064aa5e611b663d50cffd0a7c51ab0a6f450cadcc766ac7dade0931073f`](https://sepolia.basescan.org/tx/0xaaa92064aa5e611b663d50cffd0a7c51ab0a6f450cadcc766ac7dade0931073f)  
   - Status: **1 (SUCCESS)** (Block `47496161`)  
   - Disbursed exact payouts on-chain: `0.07178 USDC` to Player A and `0.12822 USDC` to Player B (Sum = `0.20000 USDC`, 0 dust).

---

## Core Specification & Rules (PRD v2.1)

- **Network:** Base Sepolia (Chain ID: `84532`)
- **Staking Asset:** Official Circle Testnet USDC (6 decimals)
- **Equal Stakes:** Both players deposit identical USDC amounts into escrow.
- **Platform Fee:** `0%` (0 BPS).
- **Minimum Resignation Threshold:** 20 plies (10 full moves). Resignations prior to 20 plies forfeit 100% of the pot.
- **Proportional Payout Formula:**  
  $$P(\text{Win}_A) = \frac{1}{1 + e^{-0.004 \times \text{eval}_{cp}}}$$
  Clamped between 5% and 95% ($500 \le \text{BPS} \le 9500$).
- **Oracle Attestation:** EIP-191 signed cryptographic receipt produced server-side and validated on-chain in `EvalStakeEscrow.sol`.

---

## Project Structure

```
├── contracts/
│   └── EvalStakeEscrow.sol    # Base Sepolia smart contract escrow
├── artifacts/
│   └── EvalStakeEscrow.json   # Compiled contract ABI & bytecode (viaIR: true)
├── scripts/
│   ├── compile.js             # Solidity compiler script
│   ├── deploy.js              # Base Sepolia contract deployer script
│   └── run_e2e_match.js       # Live on-chain E2E match verification suite
├── server.js                  # Node.js backend & trusted Oracle service
├── app.js                     # Frontend interactive chess board & Web3 provider
├── PlayerRegistration.jsx     # PRD §21 Web3 wallet onboarding component
└── app.css                    # Modern UI styles & theme
```

---

## Quickstart

### 1. Installation
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure your keys:
```bash
cp .env.example .env
```
Ensure `.env` contains:
```ini
PORT=3000
NETWORK=Base Sepolia
CHAIN_ID=84532
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
ESCROW_CONTRACT=0xBe5cD1b1c18e1aAb2360C9333eE9b941A2EA7eAc
ORACLE_KEY=<YOUR_ORACLE_PRIVATE_KEY>
DEPLOYER_KEY=<YOUR_DEPLOYER_PRIVATE_KEY>
```
*(Note: `.env` is ignored by git and never committed).*

### 3. Run Backend Server
```bash
node server.js
```
Endpoint available at `http://localhost:3000`.

### 4. Run End-to-End On-Chain Test
```bash
node scripts/run_e2e_match.js
```
Runs the full cycle: wallet verification, match creation on Base Sepolia, matching stake deposit, 20 chess moves, resignation, on-chain oracle settlement, and token balance verification.
