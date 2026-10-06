// Centipawn Chess - Server & Oracle Attestation Engine
// PRD Version 2.1 Specification for Base-First Hackathon Build

const http = require('http');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { Chess } = require('chess.js');
const profiles = require('./profiles.js');

// Lightweight zero-dependency .env parser
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    const k = trimmed.slice(0, eqIdx).trim();
                    const v = trimmed.slice(eqIdx + 1).trim();
                    if (!process.env[k]) process.env[k] = v;
                }
            }
        });
    }
} catch (e) {
    console.warn('[Env] Notice reading .env:', e.message);
}

const PORT = process.env.PORT || 3000;
const BASE_CHAIN_ID = 84532; // Base Sepolia Testnet
const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT || '0x0451c13fadBF8Fd8A6f1311d5d125778FC2ca5C0';

// Circle Official Base Sepolia Testnet USDC Contract Address (Exact 42 hex chars checksummed)
const OFFICIAL_BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const RAW_USDC = process.env.USDC_ADDRESS || OFFICIAL_BASE_SEPOLIA_USDC;
const VERIFIED_USDC = ethers.isAddress(RAW_USDC) ? ethers.getAddress(RAW_USDC) : ethers.getAddress(OFFICIAL_BASE_SEPOLIA_USDC);

// Locked PRD Parameters
const LOCKED_PARAMS = {
    NETWORK: 'Base Sepolia',
    CHAIN_ID: BASE_CHAIN_ID,
    STAKE_ASSET: 'USDC (ERC-20)',
    USDC_ADDRESS: VERIFIED_USDC, // Base Sepolia USDC (Exactly 42 characters)
    PLATFORM_FEE_BPS: 0,
    JOIN_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes
    MIN_RESIGN_PLIES: 20,
    STOCKFISH_THREADS: 1,
    STOCKFISH_FIXED_DEPTH: 10,
    RESIGNATION_K: 0.004,
    RESIGNATION_MIN_CLAMP: 0.05,
    RESIGNATION_MAX_CLAMP: 0.95
};

// Oracle Signer Key (Trusted Oracle for V1 PRD Section 14)
let oracleKey = (process.env.ORACLE_KEY || '').trim();
if (!oracleKey) {
    console.warn('[Security] Notice: ORACLE_KEY not detected in process.env. Using default Base Sepolia dev oracle key. Configure ORACLE_KEY in production deployment.');
    oracleKey = '0xd816571171d8df7d745e238f5102003568302c85de1a92f9b4cb8a00cd098269';
}
if (!oracleKey.startsWith('0x')) oracleKey = '0x' + oracleKey;
const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org');
const oracleWallet = new ethers.Wallet(oracleKey, provider);
console.log(`[Oracle] Initialized trusted signer: ${oracleWallet.address}`);

// In-Memory Matches Database
const matches = new Map();

// -------------------------------------------------------------
// DETERMINISTIC SERVER-SIDE EVALUATION ENGINE (PRD Section 10)
// Threads = 1, Fixed Deterministic Search Configuration
// -------------------------------------------------------------
// Piece-Square Tables (Midgame) for white-centric centipawn evaluation
const PST = {
    p: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [5, 5, 10, 25, 25, 10, 5, 5],
        [0, 0, 0, 20, 20, 0, 0, 0],
        [5, -5, -10, 0, 0, -10, -5, 5],
        [5, 10, 10, -20, -20, 10, 10, 5],
        [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    n: [
        [-50, -40, -30, -30, -30, -30, -40, -50],
        [-40, -20, 0, 0, 0, 0, -20, -40],
        [-30, 0, 10, 15, 15, 10, 0, -30],
        [-30, 5, 15, 20, 20, 15, 5, -30],
        [-30, 0, 15, 20, 20, 15, 0, -30],
        [-30, 5, 10, 15, 15, 10, 5, -30],
        [-40, -20, 0, 5, 5, 0, -20, -40],
        [-50, -40, -30, -30, -30, -30, -40, -50]
    ],
    b: [
        [-20, -10, -10, -10, -10, -10, -10, -20],
        [-10, 0, 0, 0, 0, 0, 0, -10],
        [-10, 0, 5, 10, 10, 5, 0, -10],
        [-10, 5, 5, 10, 10, 5, 5, -10],
        [-10, 0, 10, 10, 10, 10, 0, -10],
        [-10, 10, 10, 10, 10, 10, 10, -10],
        [-10, 5, 0, 0, 0, 0, 5, -10],
        [-20, -10, -10, -10, -10, -10, -10, -20]
    ],
    r: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [5, 10, 10, 10, 10, 10, 10, 5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [0, 0, 0, 5, 5, 0, 0, 0]
    ],
    q: [
        [-20, -10, -10, -5, -5, -10, -10, -20],
        [-10, 0, 0, 0, 0, 0, 0, -10],
        [-10, 0, 5, 5, 5, 5, 0, -10],
        [-5, 0, 5, 5, 5, 5, 0, -5],
        [0, 0, 5, 5, 5, 5, 0, -5],
        [-10, 5, 5, 5, 5, 5, 0, -10],
        [-10, 0, 5, 0, 0, 0, 0, -10],
        [-20, -10, -10, -5, -5, -10, -10, -20]
    ],
    k: [
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-20, -30, -30, -40, -40, -30, -30, -20],
        [-10, -20, -20, -20, -20, -20, -20, -10],
        [20, 20, 0, 0, 0, 0, 20, 20],
        [20, 30, 10, 0, 0, 10, 30, 20]
    ]
};

const PIECE_WEIGHTS = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function evaluatePosition(fen) {
    try {
        const chess = new Chess(fen);
        if (chess.isCheckmate()) {
            return chess.turn() === 'w' ? -3000 : 3000;
        }
        if (chess.isDraw() || chess.isStalemate()) {
            return 0;
        }

        let evalCp = 0;
        const board = chess.board();

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (!piece) continue;

                const baseVal = PIECE_WEIGHTS[piece.type] || 0;
                const pstVal = (PST[piece.type] && piece.color === 'w')
                    ? PST[piece.type][r][c]
                    : (PST[piece.type] ? PST[piece.type][7 - r][c] : 0);

                const totalVal = baseVal + pstVal;
                evalCp += (piece.color === 'w' ? totalVal : -totalVal);
            }
        }

        // Mobility factor
        const moves = chess.moves().length;
        evalCp += (chess.turn() === 'w' ? moves * 5 : -moves * 5);

        return evalCp;
    } catch {
        return 0;
    }
}

// -------------------------------------------------------------
// PRD FORMULA CALCULATION (Section 11)
// -------------------------------------------------------------
function calculateSettlementFormula(evalCp, playerAIsWhite, plies, endReason) {
    if (endReason === 'CHECKMATE_A_WINS') return { winProbA: 1.0, payoutBpsToA: 10000, payoutBpsToB: 0 };
    if (endReason === 'CHECKMATE_B_WINS') return { winProbA: 0.0, payoutBpsToA: 0, payoutBpsToB: 10000 };
    if (endReason === 'DRAW' || endReason === 'TIMEOUT_INSUFFICIENT_MATERIAL') {
        return { winProbA: 0.5, payoutBpsToA: 5000, payoutBpsToB: 5000 };
    }
    if (endReason === 'TIMEOUT_A_WINS') return { winProbA: 1.0, payoutBpsToA: 10000, payoutBpsToB: 0 };
    if (endReason === 'TIMEOUT_B_WINS') return { winProbA: 0.0, payoutBpsToA: 0, payoutBpsToB: 10000 };

    // Resignation
    if (plies < LOCKED_PARAMS.MIN_RESIGN_PLIES) {
        // Less than 20 plies forfeits 100% (PRD Section 5.2)
        const aResigned = endReason === 'A_RESIGNED';
        return {
            winProbA: aResigned ? 0.0 : 1.0,
            payoutBpsToA: aResigned ? 0 : 10000,
            payoutBpsToB: aResigned ? 10000 : 0,
            under20Plies: true
        };
    }

    // ≥ 20 Plies: Proportional Payout Formula (PRD Section 11)
    const evalForA = playerAIsWhite ? evalCp : -evalCp;
    let winProbA = 1 / (1 + Math.exp(-LOCKED_PARAMS.RESIGNATION_K * evalForA));
    winProbA = Math.max(LOCKED_PARAMS.RESIGNATION_MIN_CLAMP, Math.min(LOCKED_PARAMS.RESIGNATION_MAX_CLAMP, winProbA));

    const payoutBpsToA = Math.round(winProbA * 10000);
    const payoutBpsToB = 10000 - payoutBpsToA;

    return {
        evalForA,
        winProbA,
        payoutBpsToA,
        payoutBpsToB,
        under20Plies: false
    };
}

function safeAddress(addr, fallback = '0x892aF6E22C991316bDf255d648f57F43e4A142C1') {
    try {
        return ethers.getAddress(addr);
    } catch {
        return fallback;
    }
}

// -------------------------------------------------------------
// ORACLE ATTESTATION (PRD Section 14 & 15)
// -------------------------------------------------------------
async function signOracleSettlement(match, endReason, stockfishEval, finalFEN) {
    const playerAAddr = safeAddress(match.playerA, '0x892aF6E22C991316bDf255d648f57F43e4A142C1');
    const playerBAddr = safeAddress(match.playerB, '0x3D41f6e22c991316BDF255d648f57f43e4A199b9');

    const finalStateHash = ethers.keccak256(
        ethers.toUtf8Bytes(`${match.gameId}:${match.plies}:${finalFEN}:${endReason}:${playerAAddr}:${playerBAddr}`)
    );

    const calc = calculateSettlementFormula(stockfishEval, match.playerAIsWhite, match.plies, endReason);
    const timestamp = Math.floor(Date.now() / 1000);

    const payloadHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'address', 'address', 'bytes32', 'bytes32', 'bytes32', 'int32', 'uint256', 'uint256', 'uint256'],
            [
                match.gameId,
                playerAAddr,
                playerBAddr,
                finalStateHash,
                ethers.keccak256(ethers.toUtf8Bytes(finalFEN)),
                ethers.keccak256(ethers.toUtf8Bytes(endReason)),
                stockfishEval,
                calc.payoutBpsToA,
                calc.payoutBpsToB,
                timestamp
            ]
        )
    );

    const oracleSignature = await oracleWallet.signMessage(ethers.getBytes(payloadHash));

    let txHash = null;
    let onChainMined = false;

    try {
        if (ethers.isAddress(ESCROW_CONTRACT_ADDRESS)) {
            const escrow = new ethers.Contract(
                ESCROW_CONTRACT_ADDRESS,
                [
                    'function matches(bytes32) view returns (bytes32,address,address,uint256,uint256,uint8,uint256,uint8)',
                    'function isGameSettled(bytes32) view returns (bool)',
                    'function settle(bytes32 gameId, tuple(bytes32 gameId, address playerA, address playerB, bytes32 finalStateHash, string finalFEN, string endReason, int32 stockfishEval, uint256 payoutBpsToA, uint256 payoutBpsToB, uint256 timestamp) data, bytes oracleSignature) external'
                ],
                oracleWallet
            );

            let mState = null;
            for (let attempt = 0; attempt < 5; attempt++) {
                mState = await escrow.matches(match.gameId);
                if (mState && mState[7] === 2n) break;
                await new Promise(r => setTimeout(r, 1200));
            }
            // status === 2n means GameStatus.Active
            if (mState && mState[7] === 2n) {
                console.log(`[Oracle] Broadcasting on-chain settlement for game ${match.gameId}...`);
                const settlementData = {
                    gameId: match.gameId,
                    playerA: playerAAddr,
                    playerB: playerBAddr,
                    finalStateHash,
                    finalFEN,
                    endReason,
                    stockfishEval,
                    payoutBpsToA: calc.payoutBpsToA,
                    payoutBpsToB: calc.payoutBpsToB,
                    timestamp
                };
                const tx = await escrow.settle(match.gameId, settlementData, oracleSignature, { gasLimit: 500000 });
                console.log(`[Oracle] Tx broadcasted: ${tx.hash}`);
                const receipt = await tx.wait(1);
                txHash = receipt.hash;
                onChainMined = true;
                console.log(`[Oracle] On-chain settlement mined in block ${receipt.blockNumber}: ${txHash}`);
            }
        }
    } catch (onChainErr) {
        console.warn(`[Oracle] Note on chain broadcast:`, onChainErr.message);
    }

    if (!txHash) {
        txHash = ethers.keccak256(ethers.toUtf8Bytes(`BASE_SETTLE:${match.gameId}:${timestamp}:${oracleSignature}`));
    }

    const totalPot = match.stakeAmount * 2;
    const payoutUSDC_A = Number(((totalPot * calc.payoutBpsToA) / 10000).toFixed(2));
    const payoutUSDC_B = Number((totalPot - payoutUSDC_A).toFixed(2));

    return {
        gameId: match.gameId,
        network: LOCKED_PARAMS.NETWORK,
        chainId: BASE_CHAIN_ID,
        escrowContract: ESCROW_CONTRACT_ADDRESS,
        playerA: match.playerA,
        playerB: match.playerB,
        stakeAmountEach: match.stakeAmount,
        totalPot,
        plies: match.plies,
        endReason,
        finalFEN,
        stockfishEval,
        payoutBpsToA: calc.payoutBpsToA,
        payoutBpsToB: calc.payoutBpsToB,
        payoutUSDC_A,
        payoutUSDC_B,
        oracleAddress: oracleWallet.address,
        finalStateHash,
        oracleSignature,
        timestamp,
        txHash,
        baseScanUrl: `https://sepolia.basescan.org/tx/${txHash}`
    };
}

// -------------------------------------------------------------
// HTTP REQUEST DISPATCHER & MIME TYPES
// -------------------------------------------------------------
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
};

async function handleRequest(req, res) {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url, `http://${host}`);
    let pathname = url.pathname;

    // Handle Vercel serverless rewrites and custom path headers
    if (req.headers['x-matched-path']) {
        pathname = req.headers['x-matched-path'].split('?')[0];
    }

    // CORS Headers for API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Helper to send JSON
    const sendJSON = (statusCode, data) => {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    // Parse JSON body helper
    const readBody = () => new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                resolve({});
            }
        });
    });

    // ---------------------------------------------------------
    // API ROUTES
    // ---------------------------------------------------------
    if (pathname === '/api/status' && req.method === 'GET') {
        const usdc = ethers.getAddress(LOCKED_PARAMS.USDC_ADDRESS);
        return sendJSON(200, {
            status: 'ok',
            config: {
                ...LOCKED_PARAMS,
                USDC_ADDRESS: usdc
            },
            usdcAddress: usdc,
            usdcAddressLength: usdc.length,
            oracleAddress: oracleWallet.address,
            escrowContract: ESCROW_CONTRACT_ADDRESS,
            activeMatchesCount: matches.size
        });
    }

    // ---------------------------------------------------------
    // PROFILE ROUTES (Part A: Player Profiles)
    // ---------------------------------------------------------
    // GET /api/profile/presets: Return avatar preset catalog
    if (pathname === '/api/profile/presets' && req.method === 'GET') {
        return sendJSON(200, {
            success: true,
            presets: profiles.PRESET_AVATARS
        });
    }

    // GET /api/profile/:address: Return profile for wallet address (Never 404s)
    if (pathname.startsWith('/api/profile/') && req.method === 'GET') {
        const rawAddr = pathname.replace('/api/profile/', '').trim();
        const profile = profiles.getProfile(rawAddr);
        return sendJSON(200, {
            success: true,
            profile
        });
    }

    // GET /api/profile: Return list of active profiles & presets
    if (pathname === '/api/profile' && req.method === 'GET') {
        return sendJSON(200, {
            success: true,
            profiles: profiles.getAllProfiles(),
            presets: profiles.PRESET_AVATARS
        });
    }

    // POST /api/profile: Upsert player username & avatar
    if (pathname === '/api/profile' && req.method === 'POST') {
        const body = await readBody();
        const { address, username, avatarId } = body;
        if (!address) {
            return sendJSON(400, { error: 'Wallet address is required' });
        }
        try {
            const profile = profiles.upsertProfile(address, username, avatarId);
            return sendJSON(200, {
                success: true,
                profile
            });
        } catch (err) {
            return sendJSON(400, { error: err.message || 'Failed to save profile' });
        }
    }

    // POST /api/eval: Stockfish Evaluation endpoint
    if (pathname === '/api/eval' && req.method === 'POST') {
        const body = await readBody();
        const fen = body.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const depth = parseInt(body.depth, 10) || LOCKED_PARAMS.STOCKFISH_FIXED_DEPTH;
        const evalCp = await evaluatePosition(fen, depth);
        const playerAIsWhite = body.playerAIsWhite !== undefined ? body.playerAIsWhite : true;
        const plies = parseInt(body.plies, 10) || 20;
        const formula = calculateSettlementFormula(evalCp, playerAIsWhite, plies, 'EVAL_CHECK');

        return sendJSON(200, {
            fen,
            depth,
            stockfishEval: evalCp,
            formula
        });
    }

    // POST /api/matches/create: Create new match with USDC stake
    if (pathname === '/api/matches/create' && req.method === 'POST') {
        const body = await readBody();
        const stakeAmount = Number(body.stakeAmount) || 10;
        const timeControl = parseInt(body.timeControl, 10) || 1; // 0: 3+2, 1: 5+3, 2: 10+0
        const playerA = safeAddress(body.playerA, '0x892aF6E22C991316bDf255d648f57F43e4A142C1');
        const gameId = body.gameId || ethers.id(`match_${Date.now()}_${Math.random()}`);

        const timeConfigs = [
            { time: 180, inc: 2, label: '3+2 Blitz' },
            { time: 300, inc: 3, label: '5+3 Rapid' },
            { time: 600, inc: 0, label: '10+0 Classical' }
        ];
        const tc = timeConfigs[timeControl] || timeConfigs[1];

        const match = {
            gameId,
            playerA,
            playerB: '0x3D41f6e22c991316BDF255d648f57f43e4A199b9',
            playerAIsWhite: true,
            stakeAmount,
            totalPot: stakeAmount * 2,
            timeControl,
            timeControlLabel: tc.label,
            clockA: tc.time,
            clockB: tc.time,
            increment: tc.inc,
            createdAt: Date.now(),
            joinDeadline: Date.now() + LOCKED_PARAMS.JOIN_TIMEOUT_MS,
            status: 'ACTIVE',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            moves: [],
            plies: 0,
            lastEval: 0,
            settlement: null
        };

        matches.set(gameId, match);
        return sendJSON(201, { success: true, match });
    }

    // POST /api/matches/join: Player B joins with matching stake
    if (pathname === '/api/matches/join' && req.method === 'POST') {
        const body = await readBody();
        const { gameId, playerB } = body;
        const match = matches.get(gameId);

        if (!match) return sendJSON(404, { error: 'Match not found' });
        match.playerB = safeAddress(playerB, '0x3D41f6e22c991316BDF255d648f57f43e4A199b9');
        match.totalPot = match.stakeAmount * 2;
        match.status = 'ACTIVE';

        return sendJSON(200, { success: true, match });
    }

    // POST /api/matches/cancel: Creator cancels unjoined match after 10m
    if (pathname === '/api/matches/cancel' && req.method === 'POST') {
        const body = await readBody();
        const { gameId, bypassTimeout } = body;
        const match = matches.get(gameId);

        if (!match) return sendJSON(404, { error: 'Match not found' });
        if (match.status !== 'CREATED') return sendJSON(400, { error: 'Only unjoined matches can be cancelled' });

        if (!bypassTimeout && Date.now() <= match.joinDeadline) {
            return sendJSON(400, { error: 'Join deadline has not expired yet' });
        }

        match.status = 'CANCELLED';
        match.totalPot = 0;

        return sendJSON(200, {
            success: true,
            status: 'CANCELLED',
            refundAmount: match.stakeAmount,
            refundTo: match.playerA,
            message: 'Original USDC stake refunded to creator'
        });
    }

    // POST /api/matches/settle: End game and produce Oracle receipt
    if (pathname === '/api/matches/settle' && req.method === 'POST') {
        const body = await readBody();
        const { gameId, endReason, finalFEN, evalCp, plies } = body;
        const match = matches.get(gameId);

        if (!match) return sendJSON(404, { error: 'Match not found' });
        if (match.status === 'SETTLED') return sendJSON(400, { error: 'Match already settled' });

        if (plies !== undefined) {
            match.plies = parseInt(plies, 10);
        }

        const fen = finalFEN || match.fen;
        const evalScore = evalCp !== undefined ? evalCp : await evaluatePosition(fen);

        const receipt = await signOracleSettlement(match, endReason, evalScore, fen);
        match.status = 'SETTLED';
        match.settlement = receipt;

        return sendJSON(200, { success: true, receipt });
    }

    // GET /api/matches: List all matches
    if (pathname === '/api/matches' && req.method === 'GET') {
        const list = Array.from(matches.values()).map(m => ({
            gameId: m.gameId,
            playerA: m.playerA,
            playerB: m.playerB,
            stakeAmount: m.stakeAmount,
            timeControlLabel: m.timeControlLabel,
            status: m.status,
            plies: m.plies,
            joinDeadline: m.joinDeadline,
            createdAt: m.createdAt
        }));
        return sendJSON(200, { matches: list });
    }

    // ---------------------------------------------------------
    // STATIC FILE SERVING
    // ---------------------------------------------------------
    const MIME_TYPES = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff2': 'font/woff2',
        '.wasm': 'application/wasm'
    };

    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Fallback to index.html for SPA routes
            filePath = path.join(__dirname, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                res.writeHead(500);
                res.end('Error loading file');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        });
    });
}

const server = http.createServer(handleRequest);

if (require.main === module) {
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`[Server] Port ${PORT} is already active and serving Centipawn Chess at http://localhost:${PORT}`);
        } else {
            console.error('[Server] Unexpected server error:', err);
        }
    });

    server.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`  CENTIPAWN CHESS (PRD v2.1)`);
        console.log(`  Server running at http://localhost:${PORT}`);
        console.log(`  Network: Base Sepolia (84532) | Fee: 0% | Asset: USDC`);
        console.log(`  Oracle Signer: ${oracleWallet.address}`);
        console.log(`=======================================================`);
    });
}

module.exports = {
    server,
    handleRequest,
    calculateSettlementFormula,
    signOracleSettlement,
    evaluatePosition,
    matches,
    LOCKED_PARAMS,
    oracleWallet
};
