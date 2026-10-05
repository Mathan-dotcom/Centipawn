# PRD — EvalStake Chess
## Evaluation-Based Proportional-Payout Chess Wagering
**Version 2.1 · Build-ready specification for Antigravity**  
**Status:** Locked for Base-first hackathon implementation

---

## 1. Product Summary

EvalStake Chess is an online two-player chess platform where both players stake an equal amount of **USDC** into an on-chain escrow before the game begins.

Standard chess rules remain unchanged.

The product's core differentiator is the settlement mechanism:

- **Checkmate:** winner receives 100% of the pot.
- **Timeout:** winner receives 100%, subject to standard insufficient-mating-material rules.
- **Draw:** 50/50.
- **Resignation:** the pot is split according to the Stockfish evaluation of the final position.

This makes resignation economically proportional to the position rather than automatically converting the entire stake into a winner-takes-all outcome.

The hackathon implementation is **Base-first**. Hyperliquid HyperEVM and Solana remain documented extension targets and are not required for the live demo.

---

# 2. Locked Decisions

These values are authoritative for V2.1. The implementation must not silently substitute different values.

| Parameter | Locked value |
|---|---|
| Primary network | **Base** |
| Stake asset | **USDC (ERC-20)** |
| Stake model | Both players deposit equal USDC |
| Hackathon platform fee | **0%** |
| Time controls | **3+2, 5+3, 10+0** |
| Default time control | **5+3** |
| Join timeout | **10 minutes** |
| Minimum activity before proportional resignation | **20 plies** |
| Stockfish execution | Server-side |
| Stockfish threads | **1** |
| Stockfish search | **Fixed deterministic search configuration** |
| Evaluation perspective | White-centric centipawns |
| Resignation clamp | **5%–95%** |
| Resignation formula | `1 / (1 + e^(-0.004 * evalForA))` |
| Oracle model | One trusted signer for V1 |
| Settlement | Exactly once per game |
| HyperEVM | Future extension |
| Solana | Future extension |

### 2.1 Official Deployed Addresses (Base Sepolia)

| Role / Contract | Address | Verification / Explorer |
|---|---|---|
| **EvalStakeEscrow Contract** | `0x0451c13fadBF8Fd8A6f1311d5d125778FC2ca5C0` | [BaseScan Contract](https://sepolia.basescan.org/address/0x0451c13fadBF8Fd8A6f1311d5d125778FC2ca5C0) |
| **Trusted Oracle Signer** | `0x410F8184bDdC5A98e7A45c2e695c6AF7D106A3a9` | [BaseScan Account](https://sepolia.basescan.org/address/0x410F8184bDdC5A98e7A45c2e695c6AF7D106A3a9) |
| **Testnet USDC (Base Sepolia)** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | [BaseScan Token](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |

### Important implementation rule

If an implementation detail is not explicitly specified here, the agent may choose a reasonable implementation. However, it **must not change a locked decision above** without explicitly flagging the change.

---

# 3. Goals

1. Allow two players to play standard chess while staking real USDC.
2. Hold both stakes in an on-chain escrow.
3. Provide live Stockfish evaluation throughout the game.
4. Use the final evaluation to determine proportional payout when a player resigns.
5. Settle the result automatically through a smart contract.
6. Make the settlement calculation transparent and independently verifiable.
7. Deliver a complete, live Base testnet demonstration.
8. Keep the architecture extensible to HyperEVM and Solana without allowing those chains to delay the Base demo.

---

# 4. Non-Goals

The V1/V2.1 hackathon build does **not** include:

- Chess variants.
- Tournament brackets.
- Spectator betting or trading.
- Native mobile applications.
- Fiat on/off ramps.
- Public matchmaking pools as a required feature.
- Multi-oracle consensus.
- Automated identity/personhood verification.
- Production-grade anti-collusion enforcement.
- Production-grade regulatory/compliance infrastructure.
- Full production mainnet launch.

---

# 5. Game Rules

The game uses standard chess rules.

Supported game-ending states:

### 5.1 Checkmate

Winner receives:

- Player A: 100% or 0%
- Player B: 0% or 100%

No Stockfish proportional formula is used.

### 5.2 Resignation

If the resigning player has completed the minimum activity requirement of **20 plies**, the final board position is evaluated by Stockfish.

The payout is calculated from that evaluation.

If fewer than 20 plies have been played, the resignation is treated as a normal binary loss:

- Resigning player: 0%
- Opponent: 100%

This minimum-activity rule exists to reduce trivial early-game sandbagging/manipulation.

### 5.3 Timeout

A player who loses on time loses the game.

The opponent receives 100%, unless the flagged player has insufficient mating material under standard chess rules, in which case the result is a draw and the pot is split 50/50.

### 5.4 Draw

Draws pay:

- Player A: 50%
- Player B: 50%

Applicable draw conditions include:

- Stalemate.
- Threefold repetition.
- Fifty-move rule.
- Insufficient material.
- Draw agreement.

### 5.5 Disconnect / abandonment

A temporary disconnect enters the configured reconnect/grace mechanism.

If the player does not recover within the allowed period, the game is treated as a timeout against that player.

---

# 6. Stake & Escrow Specification

## 6.1 Currency

The only staking asset in the Base V1 implementation is:

**USDC ERC-20**

Do not implement native ETH staking for V1.

The frontend must clearly display:

- Stake amount.
- USDC symbol.
- Required approval.
- Deposit transaction.
- Escrowed amount.
- Expected payout.

## 6.2 Equal stake

Both players must stake the same USDC amount.

Example:

- Player A stakes 10 USDC.
- Player B must stake 10 USDC.
- Total pot = 20 USDC.

The contract must reject a mismatched second stake.

## 6.3 Platform fee

The hackathon version has a **0% platform fee**.

Therefore:

`totalPayout = totalEscrow`

No percentage is removed from the pot.

The contract architecture may expose a configurable fee field for future use, but the deployed hackathon configuration must remain 0%.

## 6.4 Escrow lifecycle

```text
CREATED
   ↓
PLAYER_A_STAKED
   ↓
PLAYER_B_JOINED + MATCHING_STAKE
   ↓
ACTIVE
   ↓
GAME_ENDED
   ↓
ORACLE_ATTESTED
   ↓
SETTLED
```

---

# 7. Match Creation and Join Timeout

A match creator:

1. Connects a wallet.
2. Selects a supported time control.
3. Enters a USDC stake amount.
4. Approves the escrow contract to spend USDC.
5. Deposits the stake.
6. Receives a unique match ID.

The second player must join and deposit the matching stake within **10 minutes**.

## 7.1 Unjoined match cancellation

If Player B does not join within 10 minutes:

- Player A can cancel the match.
- The contract returns Player A's full stake.
- The match becomes `CANCELLED`.
- The match can never be joined afterward.

The frontend must show a countdown to the join deadline.

This prevents a creator's funds from remaining permanently locked in an abandoned match.

---

# 8. Core User Flow

### Player A

1. Connect wallet.
2. Select 3+2, 5+3, or 10+0.
3. Enter USDC stake.
4. Approve USDC.
5. Create match.
6. Deposit USDC.
7. Share match ID/link.
8. Wait for Player B.

### Player B

1. Open match.
2. Review:
   - Stake amount.
   - Time control.
   - Join deadline.
3. Approve USDC.
4. Deposit matching stake.
5. Game starts.

### During game

- Both players make legal chess moves.
- Server validates every move.
- Clock is authoritative.
- Stockfish continuously evaluates the position.
- UI displays the live evaluation bar.

### Game end

1. Server determines end state.
2. Final board/FEN is frozen.
3. Final state hash is generated.
4. Stockfish produces the final evaluation when required.
5. Backend calculates payout.
6. Oracle signs the settlement payload.
7. Smart contract verifies the signature.
8. Contract releases USDC.
9. UI displays settlement confirmation and transaction hash.

---

# 9. Chess Engine Architecture

Chess legality must be server-authoritative.

The client is responsible for UI interaction only.

The server must:

- Maintain authoritative board state.
- Validate every submitted move.
- Reject illegal moves.
- Track clocks.
- Detect game-ending conditions.
- Generate the final FEN.
- Record the complete move list.

A suitable production implementation can use a standard chess rules library such as `chess.js` or an equivalent server-side rules engine.

---

# 10. Stockfish Configuration

Stockfish runs on the server.

The same server-side engine configuration must be used for:

- Live evaluation.
- Final resignation evaluation.

## 10.1 Determinism

V2.1 deliberately does **not** use evaluation smoothing.

The engine must use:

- **Threads = 1**
- A fixed search configuration.
- A fixed Stockfish version/build for the deployment.
- The same configuration for all games.

The exact fixed search limit must be defined in implementation configuration before deployment, using either a fixed depth or a fixed node limit.

Do not dynamically change search strength from game to game.

## 10.2 Evaluation

Stockfish evaluation is represented as centipawns from White's perspective.

For payout:

```text
evalForA =
    playerAIsWhite ? stockfishEval : -stockfishEval
```

Positive `evalForA` means the position favors Player A.

Negative `evalForA` means it favors Player B.

---

# 11. Resignation Payout Formula

Only resignation after the minimum 20-ply requirement uses the proportional formula.

```text
winProbA = 1 / (1 + e^(-0.004 * evalForA))
```

Then:

```text
winProbA = clamp(winProbA, 0.05, 0.95)
```

Finally:

```text
payoutBpsToA = round(winProbA * 10000)
payoutBpsToB = 10000 - payoutBpsToA
```

Example:

```text
evalForA ≈ +320

raw probability ≈ 78%

Player A ≈ 78%
Player B ≈ 22%
```

The formula is a settlement rule, not a claim that Stockfish's centipawn score represents a literal statistical probability of winning.

---

# 12. Payout Rules Table

| End reason | Player A | Player B |
|---|---:|---:|
| A checkmates B | 100% | 0% |
| B checkmates A | 0% | 100% |
| A resigns after ≥20 plies | Formula | Formula |
| B resigns after ≥20 plies | Formula | Formula |
| A resigns before 20 plies | 0% | 100% |
| B resigns before 20 plies | 100% | 0% |
| A times out | 0% | 100% |
| B times out | 100% | 0% |
| Timeout with insufficient mating material | 50% | 50% |
| Draw | 50% | 50% |

---

# 13. Resignation Confirmation UX

When a player presses **Resign**, do not immediately submit the resignation.

Show a confirmation modal containing:

- Current Stockfish evaluation.
- Estimated payout percentage.
- Estimated USDC payout for both players.
- Clear statement that the payout is based on the final position.
- Confirmation button.

Example:

```text
Current position: +3.2

If you resign now:

You receive: 7.80 USDC
Opponent receives: 12.20 USDC

[ Cancel ]     [ Confirm Resignation ]
```

For a resignation before 20 plies:

```text
Resigning before the minimum activity threshold results
in a 100% payout to your opponent.
```

---

# 14. Oracle Architecture

V1 uses **one trusted oracle signer**.

The oracle is responsible for attesting that the backend's final game result corresponds to a specific final game state.

The signed payload should include at minimum:

```text
gameId
playerA
playerB
finalStateHash
finalFEN
endReason
stockfishEval
payoutBpsToA
payoutBpsToB
timestamp
```

The smart contract must verify:

1. Authorized oracle signature.
2. Correct game ID.
3. Correct participants.
4. Valid payout basis points.
5. Payout sum equals 10,000 bps.
6. Game has not already been settled.

---

# 15. Final State Integrity

The final game state must be reproducible.

The backend should derive a deterministic state hash from the canonical final game data.

Recommended canonical components:

```text
gameId
moveCount
finalFEN
endReason
playerA
playerB
```

The exact serialization must be deterministic and shared between the backend and verification logic.

The oracle signs the resulting hash.

This prevents a settlement from being detached from the actual completed chess game.

---

# 16. Smart Contract Requirements

The Base contract must support:

### Match creation

```solidity
createMatch(
    uint256 stakeAmount,
    uint8 timeControl
)
```

### Joining

```solidity
joinMatch(bytes32 gameId)
```

### Creator cancellation after join timeout

```solidity
cancelUnjoinedMatch(bytes32 gameId)
```

### Settlement

```solidity
settle(
    bytes32 gameId,
    SettlementData calldata data,
    bytes calldata oracleSignature
)
```

The exact Solidity signatures may be adjusted for implementation quality, but the semantics above are mandatory.

## Contract invariants

The contract must guarantee:

- Player B cannot join with a different stake.
- A cancelled match cannot be joined.
- A settled game cannot be settled again.
- A game cannot be settled by an unauthorized oracle.
- Payout percentages sum to 100%.
- Contract never pays more than the escrowed amount.
- USDC is transferred directly according to the verified settlement.
- A creator cannot cancel after the match has started.
- Settlement cannot modify player identities or stake amounts.

---

# 17. Must-Demo vs Must-Exist Code

To prevent scope explosion, requirements are divided into two levels.

## 17.1 MUST DEMO LIVE

The hackathon demo must successfully demonstrate:

1. Base testnet wallet connection.
2. Real USDC testnet token.
3. Real USDC approval.
4. Real escrow deposit.
5. Two-player game.
6. Server-authoritative legal chess.
7. Live Stockfish evaluation.
8. Resignation payout calculation.
9. Oracle signature.
10. On-chain settlement.
11. Real payout transaction.
12. Game receipt / settlement proof.
13. Join-timeout cancellation and refund.

## 17.2 MUST EXIST IN CODE

The codebase must include:

- Contract unit tests for critical invariants.
- Replay-protection logic.
- Signature verification.
- Payout arithmetic tests.
- Minimum-activity rule.
- Timeout handling.
- Draw handling.
- Disconnect handling.
- State transition validation.

These do not all need to become separate polished UI demo flows.

## 17.3 NOT REQUIRED FOR V1 DEMO

The following are explicitly not allowed to consume core demo time:

- Multi-oracle consensus.
- Full collusion detection.
- Identity verification.
- Complex matchmaking.
- Cross-chain live deployment.
- Production-grade monitoring.
- Advanced anti-sandbagging heuristics.

---

# 18. Anti-Abuse Strategy

## 18.1 Sandbagging

The primary V1 mitigation is:

**Minimum 20 plies before proportional resignation is allowed.**

Before 20 plies, resignation is a normal 100/0 loss.

No additional evaluation smoothing is required.

## 18.2 Collusion

Full collusion prevention is outside V1.

The system may record telemetry such as:

- Wallet reuse.
- Repeated opponent pairing.
- Extremely short games.
- Repeated unusual resignation patterns.

However, telemetry must **not automatically block settlement in V1** unless a separately specified security rule exists.

## 18.3 Oracle centralization

One trusted oracle is acceptable for the hackathon.

The architecture should leave a clear upgrade path toward:

- Multi-oracle signatures.
- Threshold verification.
- Dispute windows.

---

# 19. Game Reliability

The backend is authoritative for:

- Move order.
- Legal moves.
- Clocks.
- Game status.
- Final result.

A client reconnecting must receive the current authoritative game state from the server.

The server must prevent:

- Duplicate moves.
- Out-of-order moves.
- Moves after game end.
- Moves from the wrong player.
- Settlement before a valid game end.

---

# 20. Game Receipt

After settlement, both players should receive a readable game receipt containing:

```text
Game ID
Network
Stake: X USDC each
Time control
Player A
Player B
Result
End reason
Final FEN
Final Stockfish evaluation
Player A payout
Player B payout
Settlement transaction hash
```

The receipt should make the payout understandable without requiring the user to inspect contract calldata.

---

# 21. Frontend Requirements

The UI should prioritize the chess experience.

Required screens:

### Landing

- Product explanation.
- Create match.
- Join match.
- Wallet connection.

#### Required Landing States (PRD Addendum §21):

1. **Wallet not connected:**
   - Show a single primary "Connect Wallet" action.
   - Per §6 (locked decisions), this must use Base-native onboarding (Coinbase Smart Wallet via OnchainKit) so a first-time player can create a wallet with a passkey/Google/Apple login — no seed phrase required.
2. **Wallet connected, wrong network:**
   - Show a blocking prompt with a single "Switch to Base" action before allowing any further flow.
   - Do not allow match creation or joining while on the wrong network.
3. **Wallet connected, correct network, zero USDC balance:**
   - Show a "Get testnet USDC" prompt linking to the official Base Sepolia faucet and/or Circle's testnet USDC faucet.
   - This state must be reachable without leaving the app, since a judge or new player with an empty fresh wallet is the expected common case, not an edge case.
4. **Wallet connected, correct network, non-zero USDC balance:**
   - Proceed to the existing Landing flow (Create Match / Join Match) as already specified.

#### Non-Functional Requirement (§21):
- "The zero-balance faucet-prompt state must be demonstrated as part of the live demo path (§28), not left as a MUST-EXIST-ONLY code path, since it is the actual entry point a judge will hit on first use."

### Create Match

- Stake amount in USDC.
- Time control.
- Estimated total pot.
- Create button.
- Wallet transaction state.

### Waiting Room

- Match ID/share link.
- Player A stake.
- Join countdown.
- Cancel/refund after timeout.

### Game

- Chessboard.
- Player information.
- Clocks.
- Live Stockfish evaluation bar.
- Current stake/pot.
- Resign button.
- Connection status.

### Settlement

- End reason.
- Final evaluation when applicable.
- Payout split.
- USDC amounts.
- Transaction hash.
- Game receipt.

---

# 22. Real Data Policy

No mock data or fake settlement responses may appear in the shipped demo.

The following must be real:

- Stockfish evaluation.
- Chess legality.
- Wallet balances.
- USDC transfers.
- Base RPC state.
- Oracle signature.
- Contract settlement.
- Transaction confirmation.

If a required credential, RPC URL, deployed contract address, oracle key, wallet provider key, or Stockfish dependency is missing, the implementation must **stop and request the required configuration rather than silently substituting a mock**.

---

# 23. Base-First Scope

The live implementation target is Base testnet.

The build order is:

```text
1. Chess engine + game server
2. Stockfish integration
3. USDC escrow contract
4. Wallet integration
5. Oracle signing
6. Settlement
7. Full end-to-end Base flow
8. Tests + security verification
9. UI polish
10. Document HyperEVM/Solana extension
```

HyperEVM and Solana must not block the Base demo.

---

# 24. Multi-Chain Architecture Direction

The shared components are:

- Chess UI.
- Game server.
- Chess rules engine.
- Stockfish evaluation.
- Payout calculation.
- Game receipt format.

The chain-specific layer contains:

- Escrow.
- Token transfer.
- Settlement verification.
- Oracle verification.
- Transaction submission.

### HyperEVM

Reuse the EVM contract architecture with network-specific configuration.

### Solana

Use the existing Anchor/Rust direction as a future chain adapter.

These integrations are extension work, not Base V1 acceptance criteria.

---

# 25. Security Test Requirements

At minimum, automated tests must cover:

### Escrow

- Correct initial deposit.
- Matching second stake.
- Mismatched stake rejection.
- Unauthorized withdrawal rejection.

### Join timeout

- Join before deadline succeeds.
- Join after deadline fails.
- Creator cancellation before deadline fails.
- Creator cancellation after deadline refunds exactly the original stake.
- Cancelled match cannot be joined.

### Settlement

- Valid oracle signature succeeds.
- Invalid signature fails.
- Wrong game ID fails.
- Wrong participants fail.
- Replay settlement fails.
- Invalid payout sum fails.
- Payout greater than escrow fails.

### Payout

- Checkmate = 100/0.
- Draw = 50/50.
- Timeout = 100/0 unless insufficient mating material.
- Resignation before 20 plies = 100/0.
- Resignation after 20 plies follows the formula.
- Payout never exceeds the 5–95% resignation clamp.

---

# 26. Business Model

The hackathon deployment uses:

**0% platform fee.**

This is intentional to keep the demonstration simple and transparent.

A future production model may introduce a configurable fee, but that is not part of the V1 settlement economics.

Do not implement a hidden or implicit fee.

---

# 27. Competitive Positioning

The product should be described as:

> **A chess wagering platform where the value of an unfinished game is determined by the strength of the position, not just by who technically wins.**

The key differentiation is not simply blockchain escrow.

The differentiator is:

```text
Chess position
      ↓
Stockfish evaluation
      ↓
Deterministic payout calculation
      ↓
Oracle attestation
      ↓
On-chain settlement
```

This makes the financial settlement directly connected to the game's final chess state.

---

# 28. Demo Scenario

The recommended live demonstration:

### Setup

- Player A: 10 USDC
- Player B: 10 USDC
- Time control: 5+3
- Network: Base testnet
- Platform fee: 0%

### Game

Play a real game until one player reaches a clearly winning position.

The losing-side player chooses **Resign**.

The confirmation modal displays the current Stockfish evaluation and projected payout.

Example:

```text
Final evaluation: +3.2

Player A: 78%
Player B: 22%

Pot: 20 USDC

Player A: 15.60 USDC
Player B: 4.40 USDC
```

The oracle signs the result.

The contract verifies it.

USDC is distributed.

The transaction hash and game receipt are displayed.

### Second micro-demo

Create another match and leave it unjoined for 10 minutes, or use a controlled test configuration that exercises the timeout path.

Show:

```text
Join deadline reached
→ Creator cancels
→ Original USDC returned
```

---

# 29. Acceptance Criteria

The implementation is considered complete for the hackathon when all of the following are true:

- [ ] Base testnet deployment exists.
- [ ] USDC ERC-20 is the only staking asset.
- [ ] Platform fee is 0%.
- [ ] Two wallets can stake equal amounts.
- [ ] Unjoined matches expire after 10 minutes.
- [ ] Creator can recover the original stake after expiry.
- [ ] A real two-player chess game can be played.
- [ ] Server validates all moves.
- [ ] Clocks work.
- [ ] Stockfish runs server-side.
- [ ] Stockfish configuration is deterministic.
- [ ] Live evaluation is visible.
- [ ] Minimum 20-ply rule is enforced.
- [ ] Resignation payout follows the locked formula.
- [ ] Checkmate/timeout/draw rules work.
- [ ] Oracle signature is real.
- [ ] Smart contract verifies the oracle.
- [ ] Settlement can happen only once.
- [ ] USDC payout is real.
- [ ] Game receipt is generated.
- [ ] Critical security tests pass.
- [ ] No mock/fake settlement path exists in the shipped demo.

---

# 30. Implementation Guardrails for Antigravity

Before writing implementation code, the agent must treat the following as fixed product decisions:

```text
STAKE_ASSET = USDC
NETWORK = BASE
PLATFORM_FEE_BPS = 0
JOIN_TIMEOUT = 10 minutes
MIN_RESIGN_PLIES = 20
STOCKFISH_THREADS = 1
RESIGNATION_K = 0.004
RESIGNATION_MIN = 0.05
RESIGNATION_MAX = 0.95
ORACLE_COUNT = 1
```

The agent must not:

- Replace USDC with ETH.
- Add a platform fee.
- Remove the 20-ply threshold.
- Add evaluation smoothing.
- Treat HyperEVM/Solana as required for the live demo.
- Use fake Stockfish values.
- Use fake transaction hashes.
- Use mocked wallet balances in the final demo.
- Create a second payout formula without explicit approval.

If a required value is missing and is not covered by this PRD, ask for clarification rather than inventing a value that changes economic behavior.

---

# 31. Recommended Build Phases

## Phase 1 — Foundation

- Repository structure.
- Environment configuration.
- Chess rules engine.
- Game state model.
- WebSocket/game transport.

**Checkpoint:** Two browser clients can play a legal local/server-authoritative chess game.

## Phase 2 — Stockfish

- Install/pin Stockfish.
- Server-side analysis.
- Fixed configuration.
- Live eval stream.
- Final evaluation.

**Checkpoint:** Same position produces consistent evaluation under the pinned configuration.

## Phase 3 — Base Escrow

- USDC interface.
- Match creation.
- Equal-stake join.
- Join timeout.
- Creator refund.

**Checkpoint:** Real testnet USDC enters and leaves escrow correctly.

## Phase 4 — Oracle + Settlement

- Canonical state hash.
- Settlement payload.
- Oracle signing.
- Contract signature verification.
- Replay protection.

**Checkpoint:** A completed game produces one valid on-chain settlement.

## Phase 5 — Full Game Integration

- Game result → payout.
- Resignation modal.
- 20-ply enforcement.
- Timeout/draw/checkmate mapping.
- Receipt.

**Checkpoint:** Full end-to-end Base flow works with real funds on testnet.

## Phase 6 — Verification + Polish

- Security tests.
- Failure handling.
- Transaction states.
- UI polish.
- Demo preparation.

**Checkpoint:** Acceptance criteria pass.

---

# 32. Final Product Principle

EvalStake Chess should not feel like a crypto casino with a chessboard attached.

The chess game is the primary experience.

Blockchain should solve:

- Escrow.
- Settlement.
- Transparency.
- Verifiability.

Stockfish should solve:

- Position evaluation.
- Transparent proportional settlement.

The product's central idea is simple:

> **If you resign a chess game, you should not necessarily lose the entire stake when the position itself shows that the game was already close, winning, or losing by a measurable amount.**

That mechanism is the reason to build EvalStake Chess.
