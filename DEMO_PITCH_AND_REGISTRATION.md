# Centipawn — 60–90s Demo Pitch Script & Colosseum Hackathon Listing

---

## Part 1: Live Demo Pitch Script (60–90 Seconds)

### **The Hook (0:00 – 0:15)**
> *"In traditional chess wagering, if you make one mistake in a tight game and resign, you lose 100% of your money. It's binary, punishing, and leads to griefing, stall tactics, and rage-quits. We built **Centipawn** to fix this. Centipawn is the first online chess platform with **evaluation-based proportional payouts** powered by smart contracts on Base."*

### **The Headline Mechanic & Why Base (0:15 – 0:35)**
> *"Here’s how it works: both players stake equal USDC into an on-chain non-custodial escrow contract. If someone checkmates, they take the pot. But if a player resigns after move 10 (20 plies), our server-side Stockfish oracle evaluates the exact centipawn advantage and splits the pot proportionally using a logistic curve clamped between 5% and 95%. If you fought hard and resign down a pawn or in an endgame, you get your fair share of the pot back!*
>
> *We chose **Base** because chess requires instant responsiveness: Base gives us 2-second block times, sub-cent gas fees, and native USDC liquidity without making players wait."*

### **Step-by-Step Live Clickthrough (0:35 – 0:75)**
| Timestamp | Action on Screen | Spoken Cue |
|---|---|---|
| **0:35** | Click **"ENTER CENTIPAWN CHESS"** on the 3D Genesis Certificate landing page. | *"We arrive at the game launcher. The UI displays our Base Sepolia network connection, wallet balance, and contract links."* |
| **0:45** | Click **"ENTER LIVE ARENA"** (or connect wallet / ready). | *"Both players deposit their USDC stakes directly into our verified Escrow contract on Base Sepolia."* |
| **0:52** | Move pieces on the board (`e4`, `Nf3`, `Bc4`...). Observe the live evaluation bar responding on the left. | *"Standard chess rules apply. Notice our real-time Stockfish engine continuously evaluating the position in centipawns and tracking the 20-ply threshold."* |
| **0:62** | Click **"🏳️ Resign (Proportional)"** and confirm resignation on the modal. | *"At move 12, Black resigns down an exchange. Instead of a total wipeout, our trusted oracle cryptographically signs the final FEN and centipawn score."* |
| **0:72** | View the **Game Settlement Receipt** popup showing proportional pot payout (e.g. 36.8% / 63.2%) and click the **BaseScan Transaction Hash**. | *"The smart contract instantly disburses the USDC: Player A receives 7.36 USDC, Player B receives 12.64 USDC. The transaction is verified on BaseScan in real time."* |

### **Closing Wrap (0:75 – 0:90)**
> *"Centipawn transforms chess wagering from a toxic all-or-nothing gamble into an authentic, skill-aligned sporting asset on Base. Zero platform fee during hackathon, 100% on-chain escrow transparency. Thank you!"*

---

## Part 2: Colosseum Hackathon Registration Listing

### **Project Name**
**Centipawn** *(EvalStake Chess)*

### **Tagline**
**Evaluation-based proportional-payout chess wagering with on-chain USDC escrow on Base.**

### **Category**
DeFi / Gaming / Consumer Crypto

### **Short Summary (150 words)**
Centipawn is an online chess wagering platform where both players deposit equal USDC into an on-chain escrow contract on Base before the match starts. Unlike traditional all-or-nothing betting where resigning forfeits 100% of the deposit, Centipawn introduces **evaluation-based proportional payouts**.

When a player resigns after the 20-ply activity threshold, a deterministic server-side Stockfish evaluation engine computes the position's exact centipawn advantage. A cryptographically signed oracle attestation is submitted to the `EvalStakeEscrow` smart contract, which distributes the pot proportionally between 5% and 95% via a logistic curve:
$$\text{Payout}_A = \frac{1}{1 + e^{-0.004 \times \text{eval}_{A}}}$$

Featuring 0% hackathon platform fees, sub-second Base L2 settlements, and non-custodial smart contracts, Centipawn eliminates griefing and aligns chess wagering economics with true competitive skill.

### **Detailed Description & Technical Architecture**

#### 1. The Problem
Online chess wagering has historically suffered from broken economic incentives:
- **Winner-Take-All Injustice**: Losing by a single blunder after 40 brilliant moves results in the exact same 100% loss as abandoning on move 2.
- **Stall & Grief Tactics**: Players down material often refuse to resign, running down their clock in hopes of an opponent disconnection.
- **Custodial Risk**: Centralized chess betting sites control deposits and delay payouts.

#### 2. The Centipawn Solution
Centipawn introduces fair, continuous-stakes chess:
- **Checkmate / Timeout**: 100% winner payout (subject to FIDE insufficient material rules).
- **Draw**: 50/50 split.
- **Resignation (≥ 20 plies)**: Proportional pot split based on Stockfish centipawn evaluation, calculated as $P(A) = \frac{1}{1 + e^{-0.004 \cdot \text{eval}}}$, clamped between 5% and 95%.

#### 3. Smart Contract & Tech Stack
- **Escrow Contract**: `0x0451c13fadBF8Fd8A6f1311d5d125778FC2ca5C0` deployed on Base Sepolia.
- **Trusted Oracle**: `0x410F8184bDdC5A98e7A45c2e695c6AF7D106A3a9` producing ECDSA signed settlement attestations with replay protection (`gameId`, `finalStateHash`, `payoutBps`).
- **Stake Token**: Circle official testnet USDC on Base Sepolia (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`).
- **Engine**: Single-threaded deterministic server-side Stockfish engine ensuring reproducible evaluation.
- **Frontend**: High-FPS WebGL/Three.js interactive landing page, vanilla CSS/JS responsive chessboard, and MetaMask/EIP-1193 integration.

---

### Base Sepolia Verified Contract References
- **Escrow Contract**: [0x0451c13fadBF8Fd8A6f1311d5d125778FC2ca5C0](https://sepolia.basescan.org/address/0x0451c13fadBF8Fd8A6f1311d5d125778FC2ca5C0)
- **Live Settlement Tx**: [0xb895b6f25ffdb476cd7d0cd498e160f2a63657048a75a40646cb0597f308e813](https://sepolia.basescan.org/tx/0xb895b6f25ffdb476cd7d0cd498e160f2a63657048a75a40646cb0597f308e813)
- **GitHub Repository**: [https://github.com/Mathan-dotcom/Centipawn](https://github.com/Mathan-dotcom/Centipawn)
