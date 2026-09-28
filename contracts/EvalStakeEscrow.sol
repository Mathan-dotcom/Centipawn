// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC20 Minimal Interface for USDC on Base
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title EvalStakeEscrow — Base-First Evaluation-Based Proportional-Payout Chess Wagering
 * @notice Specification from EvalStake Chess PRD v2.1
 * Locked rules:
 * - Network: Base
 * - Stake Asset: USDC (ERC-20)
 * - Both players deposit equal USDC
 * - Platform fee: 0%
 * - Join timeout: 10 minutes
 * - Settlement: Exactly once per game with authorized oracle attestation
 * - Resignation clamped to 500 - 9500 bps (5% - 95%) after 20 plies
 */
contract EvalStakeEscrow {
    // -------------------------------------------------------------
    // CONSTANTS & IMMUTABLES
    // -------------------------------------------------------------
    uint256 public constant BPS_TOTAL = 10000;
    uint256 public constant JOIN_TIMEOUT = 10 minutes;
    uint256 public constant PLATFORM_FEE_BPS = 0; // Hackathon locked decision: 0%

    IERC20 public immutable usdcToken;
    address public immutable trustedOracle;
    address public owner;

    // -------------------------------------------------------------
    // DATA STRUCTURES
    // -------------------------------------------------------------
    enum GameStatus {
        None,
        Created,       // Player A staked, awaiting Player B
        Active,        // Player B joined with matching stake, game underway
        Settled,       // Result signed by oracle and funds disbursed
        Cancelled      // Player B timed out after 10m, Player A refunded
    }

    struct Match {
        bytes32 gameId;
        address playerA;
        address playerB;
        uint256 stakeAmount;   // Equal USDC per player
        uint256 totalPot;      // stakeAmount * 2
        uint8 timeControl;     // 0: 3+2, 1: 5+3, 2: 10+0
        uint256 createdAt;     // Timestamp when created
        GameStatus status;
    }

    struct SettlementData {
        bytes32 gameId;
        address playerA;
        address playerB;
        bytes32 finalStateHash;
        string finalFEN;
        string endReason;
        int32 stockfishEval;
        uint256 payoutBpsToA;
        uint256 payoutBpsToB;
        uint256 timestamp;
    }

    // -------------------------------------------------------------
    // STORAGE
    // -------------------------------------------------------------
    mapping(bytes32 => Match) public matches;
    mapping(bytes32 => bool) public isGameSettled;

    // -------------------------------------------------------------
    // EVENTS
    // -------------------------------------------------------------
    event MatchCreated(bytes32 indexed gameId, address indexed playerA, uint256 stakeAmount, uint8 timeControl, uint256 deadline);
    event MatchJoined(bytes32 indexed gameId, address indexed playerB, uint256 matchingStake);
    event MatchCancelled(bytes32 indexed gameId, address indexed playerA, uint256 refundedStake);
    event MatchSettled(
        bytes32 indexed gameId,
        address indexed playerA,
        address indexed playerB,
        uint256 payoutA,
        uint256 payoutB,
        string endReason,
        int32 stockfishEval
    );

    // -------------------------------------------------------------
    // ERRORS
    // -------------------------------------------------------------
    error InvalidStake();
    error MatchAlreadyExists();
    error MatchNotFound();
    error InvalidMatchStatus();
    error JoinTimeoutExpired();
    error JoinTimeoutNotExpired();
    error OnlyCreatorCanCancel();
    error OnlyParticipants();
    error InvalidPayoutSum();
    error InvalidOracleSignature();
    error GameAlreadySettled();
    error TransferFailed();

    constructor(address _usdcToken, address _trustedOracle) {
        require(_usdcToken != address(0), "Invalid USDC");
        require(_trustedOracle != address(0), "Invalid Oracle");
        usdcToken = IERC20(_usdcToken);
        trustedOracle = _trustedOracle;
        owner = msg.sender;
    }

    // -------------------------------------------------------------
    // 1. CREATE MATCH (Player A stakes USDC)
    // -------------------------------------------------------------
    function createMatch(
        bytes32 gameId,
        uint256 stakeAmount,
        uint8 timeControl
    ) external returns (bytes32) {
        if (stakeAmount == 0) revert InvalidStake();
        if (matches[gameId].status != GameStatus.None) revert MatchAlreadyExists();

        // Transfer stake from Player A to this escrow contract
        bool success = usdcToken.transferFrom(msg.sender, address(this), stakeAmount);
        if (!success) revert TransferFailed();

        matches[gameId] = Match({
            gameId: gameId,
            playerA: msg.sender,
            playerB: address(0),
            stakeAmount: stakeAmount,
            totalPot: stakeAmount,
            timeControl: timeControl,
            createdAt: block.timestamp,
            status: GameStatus.Created
        });

        emit MatchCreated(gameId, msg.sender, stakeAmount, timeControl, block.timestamp + JOIN_TIMEOUT);
        return gameId;
    }

    // -------------------------------------------------------------
    // 2. JOIN MATCH (Player B deposits matching USDC stake)
    // -------------------------------------------------------------
    function joinMatch(bytes32 gameId) external {
        Match storage m = matches[gameId];
        if (m.status != GameStatus.Created) revert InvalidMatchStatus();
        if (block.timestamp > m.createdAt + JOIN_TIMEOUT) revert JoinTimeoutExpired();
        if (msg.sender == m.playerA) revert OnlyParticipants();

        // Player B must deposit the EXACT matching stake
        bool success = usdcToken.transferFrom(msg.sender, address(this), m.stakeAmount);
        if (!success) revert TransferFailed();

        m.playerB = msg.sender;
        m.totalPot = m.stakeAmount * 2;
        m.status = GameStatus.Active;

        emit MatchJoined(gameId, msg.sender, m.stakeAmount);
    }

    // -------------------------------------------------------------
    // 3. CANCEL UNJOINED MATCH (Creator refunds stake after 10m)
    // -------------------------------------------------------------
    function cancelUnjoinedMatch(bytes32 gameId) external {
        Match storage m = matches[gameId];
        if (m.status != GameStatus.Created) revert InvalidMatchStatus();
        if (msg.sender != m.playerA) revert OnlyCreatorCanCancel();
        if (block.timestamp <= m.createdAt + JOIN_TIMEOUT) revert JoinTimeoutNotExpired();

        m.status = GameStatus.Cancelled;
        uint256 refundAmount = m.stakeAmount;
        m.totalPot = 0;

        bool success = usdcToken.transfer(m.playerA, refundAmount);
        if (!success) revert TransferFailed();

        emit MatchCancelled(gameId, m.playerA, refundAmount);
    }

    // -------------------------------------------------------------
    // 4. SETTLE GAME (Oracle attestation verification + payout)
    // -------------------------------------------------------------
    function settle(
        bytes32 gameId,
        SettlementData calldata data,
        bytes calldata oracleSignature
    ) external {
        Match storage m = matches[gameId];
        if (m.status != GameStatus.Active) revert InvalidMatchStatus();
        if (isGameSettled[gameId]) revert GameAlreadySettled();
        if (data.gameId != gameId) revert MatchNotFound();
        if (data.playerA != m.playerA || data.playerB != m.playerB) revert OnlyParticipants();
        if (data.payoutBpsToA + data.payoutBpsToB != BPS_TOTAL) revert InvalidPayoutSum();

        // Verify oracle signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(
                    abi.encode(
                        data.gameId,
                        data.playerA,
                        data.playerB,
                        data.finalStateHash,
                        keccak256(bytes(data.finalFEN)),
                        keccak256(bytes(data.endReason)),
                        data.stockfishEval,
                        data.payoutBpsToA,
                        data.payoutBpsToB,
                        data.timestamp
                    )
                )
            )
        );

        address recovered = recoverSigner(messageHash, oracleSignature);
        if (recovered != trustedOracle) revert InvalidOracleSignature();

        // Mark settled to prevent replay
        m.status = GameStatus.Settled;
        isGameSettled[gameId] = true;

        uint256 pot = m.totalPot;
        uint256 payoutA = (pot * data.payoutBpsToA) / BPS_TOTAL;
        uint256 payoutB = pot - payoutA; // Guarantee zero dust remains

        m.totalPot = 0;

        if (payoutA > 0) {
            bool successA = usdcToken.transfer(m.playerA, payoutA);
            if (!successA) revert TransferFailed();
        }

        if (payoutB > 0) {
            bool successB = usdcToken.transfer(m.playerB, payoutB);
            if (!successB) revert TransferFailed();
        }

        emit MatchSettled(
            gameId,
            m.playerA,
            m.playerB,
            payoutA,
            payoutB,
            data.endReason,
            data.stockfishEval
        );
    }

    // -------------------------------------------------------------
    // INTERNAL HELPERS
    // -------------------------------------------------------------
    function recoverSigner(bytes32 ethSignedMessageHash, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(ethSignedMessageHash, v, r, s);
    }
}
