# Centipawn Chess (EvalStake Chess PRD v2.1)

> **Base-First Evaluation-Based Proportional-Payout Chess Wagering on Base Sepolia**

Centipawn Chess replaces binary winner-take-all wagering with a continuous, evaluation-based payout mechanism. Players stake equal amounts of testnet USDC into a smart contract escrow on Base Sepolia. At match conclusion, an authorized oracle calculates the evaluation score via Stockfish, signs the attestation, and settles the escrow on-chain according to the PRD §11 proportional payout formula.

---

## Verified Deployments & On-Chain Addresses (Base Sepolia — Chain ID: 84532)

| Component | Address / Identifier | BaseScan Link |
| :--- | :--- | :--- |
| **EvalStakeEscrow Contract** | `0x0451c13fadBF8Fd8A6f1311d5d125778FC2ca5C0` | [View on BaseScan](https://sepolia.basescan.org/address/0x0451c13fadBF8Fd8A6f1311d5d125778FC2ca5C0) |
| **Circle Testnet USDC** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | [View on BaseScan](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |
| **Trusted Oracle Signer** | `0x410F8184bDdC5A98e7A45c2e695c6AF7D106A3a9` | [View on BaseScan](https://sepolia.basescan.org/address/0x410F8184bDdC5A98e7A45c2e695c6AF7D106A3a9) |

---

## Live Verified Match Lifecycle Transactions

The full on-chain wagering and settlement lifecycle has been executed and confirmed on Base Sepolia:

1. **Escrow Contract Deployment**:  
   [`0x8bd6d6e1fa32f7e80b131fd79730980725fad09e98e0b5d60c6d9f715494b4cf`](https://sepolia.basescan.org/tx/0x8bd6d6e1fa32f7e80b131fd79730980725fad09e98e0b5d60c6d9f715494b4cf)
2. **Player A Match Creation & USDC Stake Deposit (`createMatch`)**:  
   [`0xe739785725e8a87f06a5d839503d43ccd4c31f5654f576a2149091b8e1f598b8`](https://sepolia.basescan.org/tx/0xe739785725e8a87f06a5d839503d43ccd4c31f5654f576a2149091b8e1f598b8)
3. **Player B Matching Stake Deposit (`joinMatch`)**:  
   [`0xc232f0ea87ae41eb1539e770f84701157e57e0e24db04d67d10d3b628e45b66f`](https://sepolia.basescan.org/tx/0xc232f0ea87ae41eb1539e770f84701157e57e0e24db04d67d10d3b628e45b66f)
4. **Oracle Live Settlement & USDC Payout Disbursement (`settle`)**:  
   [`0x1963398edfef7f103efa80c8cd3f8922d550f26b6c88a287e34712464c1cb605`](https://sepolia.basescan.org/tx/0x1963398edfef7f103efa80c8cd3f8922d550f26b6c88a287e34712464c1cb605)  
   - Status: **1 (SUCCESS)** (Block `47496728`)  
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

---

## Deploying to Vercel

Centipawn is pre-configured for 1-click deployment to **Vercel** with static edge hosting for the frontend and serverless execution for the API/Oracle backend.

### Option 1: Deploy via Vercel CLI (Recommended)
From the project root directory, run:
```bash
npx vercel
```
Follow the interactive prompts (Accept defaults). To deploy to production:
```bash
npx vercel --prod
```

### Option 2: Deploy via GitHub / Vercel Dashboard
1. Commit and push your changes to your GitHub repository:
   ```bash
   git add .
   git commit -m "feat: Vercel serverless deployment setup"
   git push origin main
   ```
2. Go to [vercel.com](https://vercel.com) -> **Add New Project** -> Import your **Centipawn** repository.
3. Configure the following **Environment Variables** in the Vercel Dashboard (Project Settings -> Environment Variables):
   - `NETWORK`: `Base Sepolia`
   - `CHAIN_ID`: `84532`
   - `USDC_ADDRESS`: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
   - `ESCROW_CONTRACT`: `0x0451c13fadBF8Fd8A6f1311d5d125778FC2ca5C0`
   - `ORACLE_KEY`: `<YOUR_ORACLE_PRIVATE_KEY>` (or use the provided Base Sepolia testnet oracle key)
4. Click **Deploy**!

