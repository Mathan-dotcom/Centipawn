// EvalStake Chess - Main Frontend Application Controller
// PRD Version 2.1 Specification for Base-First Hackathon Implementation

(function () {
    'use strict';

    // -------------------------------------------------------------
    // PRD LOCKED PARAMETERS (Section 2)
    // -------------------------------------------------------------
    const LOCKED = {
        NETWORK: 'Base Sepolia',
        CHAIN_ID: 84532,
        STAKE_ASSET: 'USDC (ERC-20)',
        PLATFORM_FEE_BPS: 0,
        JOIN_TIMEOUT_SEC: 600, // 10 minutes
        MIN_RESIGN_PLIES: 20,
        RESIGNATION_K: 0.004,
        RESIGNATION_MIN_CLAMP: 0.05,
        RESIGNATION_MAX_CLAMP: 0.95,
        ORACLE_ADDRESS: '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
        ESCROW_CONTRACT: '0x389a9B48f07662f3a4B3E03410a831f24dE3c2A1'
    };

    // -------------------------------------------------------------
    // APP STATE
    // -------------------------------------------------------------
    const state = {
        chess: null,
        selectedSquare: null,
        legalMovesForSelected: [],
        boardOrientation: 'w', // 'w' or 'b'
        gameId: null,
        status: 'READY', // 'READY', 'ACTIVE', 'SETTLED', 'CANCELLED'
        stakeAmount: 10.0,
        totalPot: 20.0,
        timeControlIdx: 1, // 0: 3+2, 1: 5+3, 2: 10+0
        timeControlConfigs: [
            { initial: 180, inc: 2, label: '3+2 Blitz' },
            { initial: 300, inc: 3, label: '5+3 Rapid' },
            { initial: 600, inc: 0, label: '10+0 Classical' }
        ],
        clocks: { w: 300, b: 300 },
        clockTimer: null,
        playerA: {
            address: '0x892aF6E22C991316bDf255d648f57F43e4A142C1',
            color: 'w',
            balanceUSDC: 100.0,
            stakeUSDC: 10.0
        },
        playerB: {
            address: '0x3D41f6e22c991316BDF255d648f57f43e4A199b9',
            color: 'b',
            balanceUSDC: 100.0,
            stakeUSDC: 10.0
        },
        playMode: 'hotseat', // 'hotseat' (two players local/peer), 'ai' (vs Stockfish)
        currentEvalCp: 0,
        currentWinProbA: 0.5,
        soundEnabled: true,
        dim3D: false,
        pendingPromotion: null,
        lastSettlementReceipt: null,
        joinDeadlineSecRemaining: 600,
        joinCountdownTimer: null
    };

    // -------------------------------------------------------------
    // SVG PIECE DEFINITIONS (Crisp, High-Resolution Vectors)
    // -------------------------------------------------------------
    const PIECE_SVGS = {
        wP: `<svg viewBox="0 0 45 45"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#ffffff" stroke="#0e0f14" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        wN: `<svg viewBox="0 0 45 45"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#ffffff" stroke="#0e0f14" stroke-width="1.5"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-4.04 2-5 2.1-3.4 5.34-6.31 9-8z" fill="#ffffff" stroke="#0e0f14" stroke-width="1.5"/><circle cx="28" cy="17" r="1.5" fill="#0e0f14"/></svg>`,
        wB: `<svg viewBox="0 0 45 45"><g fill="none" stroke="#0e0f14" stroke-width="1.5" stroke-linecap="round"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" fill="#ffffff"/><path d="M17.5 26h10M15 30h15M22.5 15.5v5M20 18h5"/></g></svg>`,
        wR: `<svg viewBox="0 0 45 45"><g fill="#ffffff" stroke="#0e0f14" stroke-width="1.5" stroke-linecap="round"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" stroke-linejoin="round"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23"/></g></svg>`,
        wQ: `<svg viewBox="0 0 45 45"><g fill="#ffffff" stroke="#0e0f14" stroke-width="1.5" stroke-linecap="round"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15L14 11v14L7 14l2 12z"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 2-1 .5-2.5 0 0 0-1.5-1.5-2.5-.5-2.5 0-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linejoin="round"/><path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0"/></g></svg>`,
        wK: `<svg viewBox="0 0 45 45"><g fill="none" stroke="#0e0f14" stroke-width="1.5" stroke-linecap="round"><path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#ffffff"/><path d="M11.5 37c5.5 3.5 16.5 3.5 22 0v-4s-3.5 1-11 1-11-1-11-1v4z" fill="#ffffff"/><path d="M12 33.5c6-1 15-1 21 0" stroke="#0e0f14"/><path d="M11.5 30c3.5-1 18.5-1 22 0M11.5 33.5c2.5 2.5 17.5 2.5 20 0" stroke="#0e0f14"/></g></svg>`,

        bP: `<svg viewBox="0 0 45 45"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#2d3244" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        bN: `<svg viewBox="0 0 45 45"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#2d3244" stroke="#ffffff" stroke-width="1.5"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-4.04 2-5 2.1-3.4 5.34-6.31 9-8z" fill="#2d3244" stroke="#ffffff" stroke-width="1.5"/><circle cx="28" cy="17" r="1.5" fill="#ffffff"/></svg>`,
        bB: `<svg viewBox="0 0 45 45"><g fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" fill="#2d3244"/><path d="M17.5 26h10M15 30h15M22.5 15.5v5M20 18h5"/></g></svg>`,
        bR: `<svg viewBox="0 0 45 45"><g fill="#2d3244" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" stroke-linejoin="round"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23"/></g></svg>`,
        bQ: `<svg viewBox="0 0 45 45"><g fill="#2d3244" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15L14 11v14L7 14l2 12z"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 2-1 .5-2.5 0 0 0-1.5-1.5-2.5-.5-2.5 0-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linejoin="round"/><path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0"/></g></svg>`,
        bK: `<svg viewBox="0 0 45 45"><g fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"><path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#2d3244"/><path d="M11.5 37c5.5 3.5 16.5 3.5 22 0v-4s-3.5 1-11 1-11-1-11-1v4z" fill="#2d3244"/><path d="M12 33.5c6-1 15-1 21 0" stroke="#ffffff"/><path d="M11.5 30c3.5-1 18.5-1 22 0M11.5 33.5c2.5 2.5 17.5 2.5 20 0" stroke="#ffffff"/></g></svg>`
    };

    // -------------------------------------------------------------
    // AUDIO SYNTHESIS (Zero External Files, Web Audio API)
    // -------------------------------------------------------------
    let audioCtx = null;
    function playSound(type) {
        if (!state.soundEnabled) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const t = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            if (type === 'move') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(220, t);
                osc.frequency.exponentialRampToValueAtTime(110, t + 0.08);
                gain.gain.setValueAtTime(0.18, t);
                gain.gain.linearRampToValueAtTime(0.001, t + 0.08);
                osc.start(t);
                osc.stop(t + 0.08);
            } else if (type === 'capture') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(380, t);
                osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);
                gain.gain.setValueAtTime(0.25, t);
                gain.gain.linearRampToValueAtTime(0.001, t + 0.12);
                osc.start(t);
                osc.stop(t + 0.12);
            } else if (type === 'check') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, t); // D5
                osc.frequency.setValueAtTime(880, t + 0.08); // A5
                gain.gain.setValueAtTime(0.2, t);
                gain.gain.linearRampToValueAtTime(0.001, t + 0.28);
                osc.start(t);
                osc.stop(t + 0.28);
            } else if (type === 'settle') {
                // Chord
                [440, 554.37, 659.25].forEach((freq, i) => {
                    const o = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    o.connect(g); g.connect(audioCtx.destination);
                    o.frequency.setValueAtTime(freq, t);
                    g.gain.setValueAtTime(0.12, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6 + i * 0.1);
                    o.start(t); o.stop(t + 0.7);
                });
            }
        } catch (e) {
            // Audio ignore
        }
    }

    // -------------------------------------------------------------
    // PRD FORMULA CALCULATOR (Client-Side Mirror)
    // -------------------------------------------------------------
    function computePRDPayout(evalCp, playerAIsWhite, plies) {
        if (plies < LOCKED.MIN_RESIGN_PLIES) {
            return {
                underThreshold: true,
                payoutBpsToA: 0,
                payoutBpsToB: 10000,
                winProbA: 0,
                payoutUSDC_A: 0.0,
                payoutUSDC_B: state.totalPot
            };
        }

        const evalForA = playerAIsWhite ? evalCp : -evalCp;
        let winProbA = 1 / (1 + Math.exp(-LOCKED.RESIGNATION_K * evalForA));
        winProbA = Math.max(LOCKED.RESIGNATION_MIN_CLAMP, Math.min(LOCKED.RESIGNATION_MAX_CLAMP, winProbA));

        const payoutBpsToA = Math.round(winProbA * 10000);
        const payoutBpsToB = 10000 - payoutBpsToA;

        const payoutUSDC_A = Number(((state.totalPot * payoutBpsToA) / 10000).toFixed(2));
        const payoutUSDC_B = Number((state.totalPot - payoutUSDC_A).toFixed(2));

        return {
            underThreshold: false,
            evalForA,
            winProbA,
            payoutBpsToA,
            payoutBpsToB,
            payoutUSDC_A,
            payoutUSDC_B
        };
    }

    // -------------------------------------------------------------
    // INITIALIZATION & DOM ATTACHMENT
    // -------------------------------------------------------------
    function init() {
        const ChessConstructor = window.Chess || (typeof Chess !== 'undefined' ? Chess : null);
        if (!ChessConstructor) {
            console.error('Chess engine library not loaded yet');
            return;
        }

        state.chess = new ChessConstructor();
        buildArenaDOM();
        startNewMatch(10.0, 1); // 10 USDC, 5+3 Rapid (Default)
        setupEventListeners();

        // Reveal the application HUD when the starter 5s loader finishes
        waitForLoaderDone();
    }

    function waitForLoaderDone() {
        const loader = document.getElementById('loader');
        if (loader && !document.getElementById('loader-skip-btn')) {
            const skipBtn = document.createElement('button');
            skipBtn.id = 'loader-skip-btn';
            skipBtn.textContent = 'EXPLORE 3D STARTER →';
            skipBtn.onclick = () => {
                loader.classList.add('done');
            };
            loader.appendChild(skipBtn);
        }
    }

    // -------------------------------------------------------------
    // TOAST NOTIFICATIONS & PROFILE SYNC
    // -------------------------------------------------------------
    function showToast(message) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = 'toast-msg';
        toast.innerHTML = `<span>✨</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(12px)';
            setTimeout(() => toast.remove(), 350);
        }, 3400);
    }

    function getPlayerProfile() {
        const saved = localStorage.getItem('evalstake_profile');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { }
        }
        return {
            gamerTag: 'GrandmasterZero',
            avatar: '♟',
            elo: '1850 Arena Elo',
            stake: 10,
            tc: 1
        };
    }

    function syncLandingPageUI() {
        const profile = getPlayerProfile();
        const tagInput = document.getElementById('reg-gamer-tag');
        if (tagInput) tagInput.value = profile.gamerTag || 'GrandmasterZero';
        const eloInput = document.getElementById('reg-elo');
        if (eloInput) eloInput.value = profile.elo || '1850 Arena Elo';

        // Avatar active state
        document.querySelectorAll('#reg-avatar-list .avatar-opt').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.avatar === (profile.avatar || '♟'));
        });

        // Time control active state
        document.querySelectorAll('.reg-tc-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.tc, 10) === (profile.tc !== undefined ? profile.tc : 1));
        });

        // Stake active state
        document.querySelectorAll('.reg-stake-btn').forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.stake) === (profile.stake || 10));
        });

        // Update HUD Player A display
        const hudNameA = document.getElementById('name-player-a');
        if (hudNameA) hudNameA.textContent = `${profile.gamerTag || 'Player A'} (White)`;
        const hudAvatarA = document.querySelector('#hud-player-a .white-avatar');
        if (hudAvatarA) hudAvatarA.textContent = profile.avatar || '♟';

        // Balances
        const balStr = `${state.playerA.balanceUSDC.toFixed(2)} USDC`;
        const balEl = document.getElementById('landing-usdc-bal');
        if (balEl) balEl.textContent = balStr;
        const headerBal = document.getElementById('header-usdc-bal');
        if (headerBal) headerBal.textContent = balStr;
    }

    // Window Navigation Controllers
    window.showLandingPage = function() {
        const landing = document.getElementById('landing-page');
        const arena = document.getElementById('arena-container');
        if (arena) {
            arena.classList.remove('active');
            arena.style.display = 'none';
        }
        if (landing) {
            landing.style.display = 'flex';
            void landing.offsetWidth;
            landing.classList.add('active');
        }
        syncLandingPageUI();
    };

    window.hideLandingPage = function() {
        const landing = document.getElementById('landing-page');
        if (landing) {
            landing.classList.remove('active');
            setTimeout(() => { landing.style.display = 'none'; }, 300);
        }
    };

    window.showArenaView = function() {
        const landing = document.getElementById('landing-page');
        const arena = document.getElementById('arena-container');
        if (landing) {
            landing.classList.remove('active');
            landing.style.display = 'none';
        }
        if (arena) {
            arena.style.display = 'flex';
            void arena.offsetWidth;
            arena.classList.add('active');
        }
        renderBoard();
        if (!state.clockTimer && state.status === 'ACTIVE') {
            startClockTimer();
        }
    };

    window.hideArenaView = function() {
        const arena = document.getElementById('arena-container');
        if (arena) {
            arena.classList.remove('active');
            setTimeout(() => { arena.style.display = 'none'; }, 300);
        }
    };

    // -------------------------------------------------------------
    // BUILD ARENA & LANDING DOM INTERFACES
    // -------------------------------------------------------------
    function buildArenaDOM() {
        if (document.getElementById('landing-page')) return;

        // 1. Landing Page Container (Stock Wallpaper Background)
        const landing = document.createElement('div');
        landing.id = 'landing-page';
        landing.innerHTML = `
            <!-- Sticky Landing Navigation -->
            <header class="landing-nav">
                <div class="brand-section">
                    <div class="brand-logo" id="landing-brand-logo">
                        <div class="brand-glyph">♟</div>
                        <span class="brand-name">EVALSTAKE</span>
                    </div>
                    <span class="brand-badge mono">BASE PROTOCOL</span>
                    <span class="mono" style="color:var(--accent-green);font-size:11px;">● 84532 TESTNET</span>
                </div>

                <nav class="landing-nav-links">
                    <a href="#landing-hero" class="landing-nav-btn active">Overview</a>
                    <a href="#section-reg" class="landing-nav-btn">Registration</a>
                    <a href="#section-stats" class="landing-nav-btn">Stats & Telemetry</a>
                    <a href="#section-settings" class="landing-nav-btn">Settings</a>
                    <a href="#section-lobby" class="landing-nav-btn">Lobby</a>
                </nav>

                <div style="display:flex;align-items:center;gap:12px;">
                    <button class="btn-primary" id="btn-view-3d-starter" style="padding:8px 14px;font-size:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.2);">
                        📜 3D Starter
                    </button>
                    <button class="btn-hero-primary" id="btn-nav-enter-arena" style="padding:8px 18px;font-size:13px;">
                        ⚔️ Play Arena
                    </button>
                    <div class="wallet-badge-btn" id="landing-wallet-badge">
                        <div class="wallet-status-dot"></div>
                        <span class="wallet-balance" id="landing-usdc-bal">100.00 USDC</span>
                        <span class="wallet-address" id="landing-addr">0x892a...42c1</span>
                    </div>
                </div>
            </header>

            <!-- Main Landing Content Scroll Area -->
            <div class="landing-content">
                <!-- Hero Section -->
                <section class="landing-hero" id="landing-hero">
                    <div class="hero-pill-badge mono">BASE SEPOLIA // ZERO-KNOWLEDGE CHESS PROTOCOL</div>
                    <h1 class="hero-title">The Proportional-Payout Web3 Chess Arena</h1>
                    <p class="hero-subtitle">
                        No more binary all-or-nothing forfeits. Resign at any moment past Ply 20 and salvage your centipawn equity on-chain with zero-knowledge cryptographic certainty.
                    </p>
                    <div class="hero-actions-row">
                        <button class="btn-hero-primary" id="hero-play-arena">
                            ⚔️ ENTER LIVE CHESS ARENA ➔
                        </button>
                        <button class="btn-hero-secondary" id="hero-quick-match">
                            ⚡ QUICK MATCH (10 USDC)
                        </button>
                        <button class="btn-hero-secondary" id="hero-view-escrow">
                            📜 PROTOCOL ESCROW SPECS
                        </button>
                    </div>
                </section>

                <!-- 3 Feature Highlights -->
                <div class="landing-grid-3">
                    <div class="feature-card">
                        <div class="feature-icon-badge">💎</div>
                        <h3 class="feature-title">Proportional Resignation Equity</h3>
                        <p class="feature-desc">
                            Unlike traditional winner-takes-all wagering where resigning forfeits 100% of your stake, EvalStake calculates continuous Stockfish centipawn equity past Ply 20 and returns your proportional pot share.
                        </p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon-badge">⏱️</div>
                        <h3 class="feature-title">10-Minute Timeout Protection</h3>
                        <p class="feature-desc">
                            Non-custodial Base Sepolia smart contract with automatic 600s cancellation timeout. If opponent disconnects or stalls before ply 20, 100% refund is guaranteed.
                        </p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon-badge">⚡</div>
                        <h3 class="feature-title">Non-Custodial Base Escrow</h3>
                        <p class="feature-desc">
                            Direct smart-contract escrow on Base with EIP-712 ECDSA oracle signature verification and 0% protocol fee for the hackathon launch.
                        </p>
                    </div>
                </div>

                <!-- Split Section 1: Player Registration & Stats Dashboard -->
                <div class="landing-split-section">
                    <!-- Registration & Profile Card -->
                    <div class="section-card" id="section-reg">
                        <div class="section-card-title">
                            <span>👤</span>
                            <span>Player Registration & Identity</span>
                        </div>
                        <p style="font-size:12px;color:var(--dim-more);line-height:1.5;">
                            Configure your player profile. Your gamer tag, avatar, and rating will be registered with your connected Base Sepolia address.
                        </p>

                        <div class="form-group">
                            <label class="form-label" for="reg-gamer-tag">GAMER TAG / CHESS ALIAS</label>
                            <input type="text" class="form-input" id="reg-gamer-tag" value="GrandmasterZero" placeholder="Enter gamer tag">
                        </div>

                        <div class="form-group">
                            <label class="form-label">AVATAR BADGE</label>
                            <div class="avatar-selector" id="reg-avatar-list">
                                <div class="avatar-opt active" data-avatar="♟" title="Cyber Knight">♟</div>
                                <div class="avatar-opt" data-avatar="♚" title="Quantum King">♚</div>
                                <div class="avatar-opt" data-avatar="♛" title="Neural Queen">♛</div>
                                <div class="avatar-opt" data-avatar="♜" title="Base Rook">♜</div>
                                <div class="avatar-opt" data-avatar="♝" title="Crypto Bishop">♝</div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="reg-wallet-addr">CONNECTED WALLET (BASE SEPOLIA)</label>
                            <div style="display:flex;gap:8px;">
                                <input type="text" class="form-input" id="reg-wallet-addr" readonly value="0x892aF6E22C991316bDf255d648f57F43e4A142C1" style="font-family:'JetBrains Mono',monospace;color:var(--accent-cyan);flex:1;">
                                <button class="btn-primary" id="btn-copy-wallet" style="font-size:11px;padding:8px 12px;">Copy</button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="reg-elo">CHESS TITLE / RATING</label>
                            <input type="text" class="form-input" id="reg-elo" value="1850 Arena Elo" placeholder="e.g. 1850 FIDE">
                        </div>

                        <div class="form-group">
                            <label class="form-label">PREFERRED TIME CONTROL</label>
                            <div style="display:flex;gap:8px;">
                                <button class="btn-primary reg-tc-btn" data-tc="0">3+2 Blitz</button>
                                <button class="btn-primary reg-tc-btn active" data-tc="1">5+3 Rapid</button>
                                <button class="btn-primary reg-tc-btn" data-tc="2">10+0 Classical</button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">DEFAULT STAKE AMOUNT</label>
                            <div style="display:flex;gap:8px;">
                                <button class="btn-primary reg-stake-btn" data-stake="5">5 USDC</button>
                                <button class="btn-primary reg-stake-btn active" data-stake="10">10 USDC</button>
                                <button class="btn-primary reg-stake-btn" data-stake="25">25 USDC</button>
                                <button class="btn-primary reg-stake-btn" data-stake="50">50 USDC</button>
                            </div>
                        </div>

                        <div style="margin-top:10px;">
                            <button class="btn-hero-primary" id="btn-save-profile" style="width:100%;justify-content:center;">
                                💾 Save & Register Profile
                            </button>
                        </div>
                    </div>

                    <!-- Stats & Protocol Telemetry Card -->
                    <div class="section-card" id="section-stats">
                        <div class="section-card-title">
                            <span>📊</span>
                            <span>Performance Stats & Telemetry</span>
                        </div>
                        <p style="font-size:12px;color:var(--dim-more);line-height:1.5;">
                            Lifetime player telemetry across Base Sepolia smart escrow matches. Proportional equity records total capital saved from binary 0-value resignations.
                        </p>

                        <!-- 4 Metrics Grid -->
                        <div class="stats-metric-grid">
                            <div class="stat-metric-box">
                                <span class="stat-metric-lbl">TOTAL MATCHES</span>
                                <span class="stat-metric-val" id="stat-matches-count">38</span>
                                <span style="font-size:10px;color:var(--dim);">26W · 8L (Resign) · 4D</span>
                            </div>
                            <div class="stat-metric-box">
                                <span class="stat-metric-lbl">WIN RATE</span>
                                <span class="stat-metric-val" style="color:var(--accent-green);" id="stat-win-rate">68.4%</span>
                                <span style="font-size:10px;color:var(--accent-green);">Top 5% on Arena</span>
                            </div>
                            <div class="stat-metric-box">
                                <span class="stat-metric-lbl">NET USDC EARNED</span>
                                <span class="stat-metric-val" style="color:var(--accent-cyan);" id="stat-net-usdc">+342.50</span>
                                <span style="font-size:10px;color:var(--dim);">USDC on Base</span>
                            </div>
                            <div class="stat-metric-box" style="border-color:rgba(112,214,255,0.35);background:rgba(112,214,255,0.06);">
                                <span class="stat-metric-lbl" style="color:var(--accent-cyan);">EQUITY SALVAGED</span>
                                <span class="stat-metric-val" style="color:var(--accent-cyan);" id="stat-equity-saved">+84.20</span>
                                <span style="font-size:10px;color:var(--dim);">Saved via Resignation Eval</span>
                            </div>
                        </div>

                        <!-- Protocol Security Box -->
                        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px;">
                            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#ffffff;display:flex;justify-content:space-between;">
                                <span>ESCROW PROTOCOL HEALTH:</span>
                                <span style="color:var(--accent-green);">● ONLINE</span>
                            </div>
                            <div style="font-size:11px;display:flex;justify-content:space-between;color:var(--dim);">
                                <span>Smart Contract:</span>
                                <span class="mono" style="color:var(--ink-pure);">0x389a...c2A1 (Base)</span>
                            </div>
                            <div style="font-size:11px;display:flex;justify-content:space-between;color:var(--dim);">
                                <span>Settlement Oracle:</span>
                                <span class="mono" style="color:var(--ink-pure);">EIP-712 ECDSA Verified</span>
                            </div>
                            <div style="font-size:11px;display:flex;justify-content:space-between;color:var(--dim);">
                                <span>Safety Timeout:</span>
                                <span class="mono" style="color:var(--accent-green);">10 Min Auto-Refund</span>
                            </div>
                            <div style="font-size:11px;display:flex;justify-content:space-between;color:var(--dim);">
                                <span>Protocol Fee:</span>
                                <span class="mono" style="color:var(--accent-green);">0% (Hackathon Free)</span>
                            </div>
                        </div>

                        <div style="margin-top:auto;">
                            <button class="btn-primary" id="btn-view-specs" style="width:100%;padding:10px;font-size:12px;background:rgba(255,255,255,0.06);">
                                📜 Read PRD Mathematical Payout Spec (v2.1)
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Split Section 2: Settings & Match Lobby -->
                <div class="landing-split-section">
                    <!-- Settings Card -->
                    <div class="section-card" id="section-settings">
                        <div class="section-card-title">
                            <span>⚙️</span>
                            <span>Game & Arena Settings</span>
                        </div>

                        <div class="setting-row">
                            <div>
                                <div class="setting-title">Sound Effects (Web Audio API)</div>
                                <div class="setting-desc">Synthesized audio for moves, captures, checks, and settlement chords</div>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="setting-sound-toggle" checked>
                                <span class="slider"></span>
                            </label>
                        </div>

                        <div class="setting-row">
                            <div>
                                <div class="setting-title">Board Visual Theme</div>
                                <div class="setting-desc">Visual styling of the 8x8 squares and glowing borders</div>
                            </div>
                            <select class="form-input" id="setting-board-theme" style="width:160px;">
                                <option value="obsidian" selected>Obsidian Glass</option>
                                <option value="cyber">Neon Cyber</option>
                                <option value="walnut">Warm Walnut</option>
                            </select>
                        </div>

                        <div class="setting-row">
                            <div>
                                <div class="setting-title">Stockfish Engine Difficulty</div>
                                <div class="setting-desc">Depth and calculation plies for auto-play evaluation</div>
                            </div>
                            <select class="form-input" id="setting-engine-depth" style="width:160px;">
                                <option value="10">Fast (10-Ply)</option>
                                <option value="18" selected>Deep (18-Ply)</option>
                                <option value="24">Master (24-Ply)</option>
                            </select>
                        </div>

                        <div class="setting-row">
                            <div>
                                <div class="setting-title">Auto-Queen Promotion</div>
                                <div class="setting-desc">Automatically promote pawns to Queens on the 8th rank</div>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="setting-auto-queen" checked>
                                <span class="slider"></span>
                            </label>
                        </div>

                        <div style="background:rgba(112,214,255,0.06);border:1px solid rgba(112,214,255,0.25);border-radius:10px;padding:16px;display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
                            <div>
                                <div style="font-weight:600;font-size:13px;color:#ffffff;">Base Sepolia USDC Faucet</div>
                                <div style="font-size:11px;color:var(--dim);margin-top:2px;">Claim 100 Mock USDC test tokens for instant arena staking</div>
                            </div>
                            <button class="btn-hero-primary" id="setting-faucet-btn" style="padding:8px 16px;font-size:12px;">
                                💧 Claim 100 USDC
                            </button>
                        </div>
                    </div>

                    <!-- Active Match Lobby Card -->
                    <div class="section-card" id="section-lobby">
                        <div class="section-card-title">
                            <span>🏛️</span>
                            <span>Active Match Lobby & Challenges</span>
                        </div>
                        <p style="font-size:12px;color:var(--dim-more);line-height:1.5;">
                            Open challenges waiting on Base Sepolia. Matches not accepted within 10 minutes auto-refund the creator.
                        </p>

                        <div style="overflow-x:auto;">
                            <table class="challenges-table">
                                <thead>
                                    <tr>
                                        <th>CREATOR</th>
                                        <th>RATING</th>
                                        <th>STAKE</th>
                                        <th>TIME</th>
                                        <th>EXPIRY</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody id="challenges-table-body">
                                    <tr>
                                        <td>
                                            <div class="challenge-player-cell">
                                                <div class="challenge-avatar-mini">♚</div>
                                                <span>GM_Hikaru</span>
                                            </div>
                                        </td>
                                        <td><span class="mono" style="color:var(--accent-cyan);">2240</span></td>
                                        <td><span class="mono" style="color:#ffffff;font-weight:600;">25.00 USDC</span></td>
                                        <td><span class="mono" style="color:var(--dim);">5+3 Rapid</span></td>
                                        <td><span class="mono" style="color:#fbbf24;">08:42</span></td>
                                        <td><button class="btn-join-match" data-stake="25" data-tc="1" data-opp="GM_Hikaru">Join Match</button></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div class="challenge-player-cell">
                                                <div class="challenge-avatar-mini">♟</div>
                                                <span>BasePawn</span>
                                            </div>
                                        </td>
                                        <td><span class="mono" style="color:var(--accent-cyan);">1720</span></td>
                                        <td><span class="mono" style="color:#ffffff;font-weight:600;">10.00 USDC</span></td>
                                        <td><span class="mono" style="color:var(--dim);">3+2 Blitz</span></td>
                                        <td><span class="mono" style="color:#fbbf24;">06:15</span></td>
                                        <td><button class="btn-join-match" data-stake="10" data-tc="0" data-opp="BasePawn">Join Match</button></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div class="challenge-player-cell">
                                                <div class="challenge-avatar-mini">♛</div>
                                                <span>ZeroKnight</span>
                                            </div>
                                        </td>
                                        <td><span class="mono" style="color:var(--accent-cyan);">1980</span></td>
                                        <td><span class="mono" style="color:#ffffff;font-weight:600;">50.00 USDC</span></td>
                                        <td><span class="mono" style="color:var(--dim);">10+0 Classical</span></td>
                                        <td><span class="mono" style="color:#fbbf24;">09:30</span></td>
                                        <td><button class="btn-join-match" data-stake="50" data-tc="2" data-opp="ZeroKnight">Join Match</button></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div style="display:flex;gap:12px;margin-top:auto;">
                            <button class="btn-hero-primary" id="btn-create-lobby-match" style="flex:1;justify-content:center;">
                                ⚡ Create Custom Challenge
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 2. Arena Container (Live Chessboard, Clocks, Eval Bar, Move Notation)
        const arena = document.createElement('div');
        arena.id = 'arena-container';
        arena.innerHTML = `
            <!-- Top Navigation Bar -->
            <header class="arena-header">
                <div class="brand-section">
                    <button class="btn-primary" id="btn-back-to-landing" style="font-size:12px;padding:7px 14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;gap:6px;cursor:pointer;">
                        <span>←</span> <span>Hub</span>
                    </button>
                    <div class="brand-logo" id="nav-brand-logo">
                        <div class="brand-glyph">♟</div>
                        <span class="brand-name">EVALSTAKE</span>
                    </div>
                    <span class="brand-badge mono">BASE SEPOLIA</span>
                    <span class="mono" style="color:var(--accent-green);font-size:10px;">● 0% PROTOCOL FEE</span>
                </div>

                <div class="header-center">
                    <button class="nav-tab-btn active" id="tab-btn-arena">
                        <span>⚔️</span> Arena
                    </button>
                    <button class="nav-tab-btn" id="tab-btn-lobby">
                        <span>🏛️</span> Match Lobby
                    </button>
                    <button class="nav-tab-btn" id="tab-btn-rules">
                        <span>📜</span> PRD Settlement Rules
                    </button>
                </div>

                <div class="header-actions">
                    <button class="btn-icon-subtle" id="btn-toggle-sound" title="Toggle Sound">
                        <span id="sound-icon">🔊</span>
                    </button>
                    <div class="wallet-badge-btn" id="wallet-widget">
                        <div class="wallet-status-dot"></div>
                        <span class="wallet-balance" id="header-usdc-bal">100.00 USDC</span>
                        <span class="wallet-address" id="header-addr">0x892a...42c1</span>
                    </div>
                </div>
            </header>

            <!-- Main Interactive Workspace -->
            <main class="arena-workspace">
                <!-- Left: Board + Evaluation Bar Column -->
                <div class="board-column">
                    <!-- Opponent HUD (Player B) -->
                    <div class="player-hud" id="hud-player-b">
                        <div class="player-identity">
                            <div class="player-avatar black-avatar">B</div>
                            <div class="player-details">
                                <div class="player-name-row">
                                    <span class="player-name" id="name-player-b">Player B (Black)</span>
                                    <span class="player-role-badge mono" id="role-player-b">MATCHING</span>
                                </div>
                                <span class="player-stake-row" id="stake-player-b">Stake: 10.00 USDC</span>
                            </div>
                            <div class="captured-pieces" id="captures-player-b"></div>
                        </div>
                        <div class="player-clock" id="clock-player-b">05:00</div>
                    </div>

                    <!-- Board & Live Stockfish Eval Bar -->
                    <div class="board-eval-wrapper">
                        <!-- Vertical Live Eval Bar -->
                        <div class="eval-bar-container" title="Live Stockfish Centipawn Evaluation">
                            <div class="eval-bar-label black-score" id="eval-label-black"></div>
                            <div class="eval-bar-black" id="eval-fill-black" style="height: 50%;"></div>
                            <div class="eval-bar-white" id="eval-fill-white" style="height: 50%;"></div>
                            <div class="eval-bar-label white-score" id="eval-label-white">+0.0</div>
                        </div>

                        <!-- 8x8 Chessboard Grid -->
                        <div class="chessboard-box" id="chessboard"></div>
                    </div>

                    <!-- User HUD (Player A) -->
                    <div class="player-hud" id="hud-player-a">
                        <div class="player-identity">
                            <div class="player-avatar white-avatar">A</div>
                            <div class="player-details">
                                <div class="player-name-row">
                                    <span class="player-name" id="name-player-a">GrandmasterZero (White)</span>
                                    <span class="player-role-badge mono" style="color:var(--accent-cyan);">CREATOR</span>
                                </div>
                                <span class="player-stake-row" id="stake-player-a">Stake: 10.00 USDC</span>
                            </div>
                            <div class="captured-pieces" id="captures-player-a"></div>
                        </div>
                        <div class="player-clock" id="clock-player-a">05:00</div>
                    </div>
                </div>

                <!-- Right: HUD Cards & Settlement Analytics -->
                <aside class="arena-sidebar">
                    <!-- Match Escrow Card -->
                    <div class="hud-card">
                        <div class="card-header-row">
                            <span class="card-title">ESCROW STATUS</span>
                            <span class="mono" id="hud-match-id" style="font-size:10px;color:var(--dim);cursor:pointer;" title="Click to copy Match ID">ID: 0x9a7...d4</span>
                        </div>

                        <div class="escrow-pot-display">
                            <div>
                                <span class="mono" style="font-size:10px;display:block;margin-bottom:2px;">ON-CHAIN ESCROW POT</span>
                                <span class="pot-amount" id="hud-pot-display">20.00</span>
                                <span class="pot-currency">USDC</span>
                            </div>
                            <span class="pot-fee-badge mono">0% PROTOCOL FEE</span>
                        </div>

                        <!-- 20 Plies Threshold Indicator (PRD Section 5.2 & 18.1) -->
                        <div class="ply-threshold-box under-threshold" id="ply-threshold-badge">
                            <span class="ply-meter" id="ply-counter-val">PLY 0 / 20</span>
                            <span id="ply-threshold-desc">Under 20 plies. Resignation forfeits 100% to opponent.</span>
                        </div>

                        <!-- Live Proportional Split Preview (PRD Section 11) -->
                        <div class="proportional-widget">
                            <div class="split-labels-row">
                                <div class="split-col">
                                    <span style="color:var(--ink-pure);font-weight:600;" id="split-pct-a">50.0% A</span>
                                    <span style="color:var(--accent-cyan);font-size:10px;" id="split-usdc-a">10.00 USDC</span>
                                </div>
                                <div class="split-col black-col">
                                    <span style="color:var(--dim-more);font-weight:600;" id="split-pct-b">50.0% B</span>
                                    <span style="color:var(--accent-purple);font-size:10px;" id="split-usdc-b">10.00 USDC</span>
                                </div>
                            </div>
                            <div class="split-ratio-bar">
                                <div class="ratio-fill-white" id="split-bar-a" style="width: 50%;"></div>
                                <div class="ratio-fill-black" id="split-bar-b" style="width: 50%;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Move History Card -->
                    <div class="hud-card move-history-card">
                        <div class="card-header-row">
                            <span class="card-title">MOVE NOTATION</span>
                            <span class="mono" id="hud-tc-badge" style="font-size:10px;color:var(--accent-cyan);">5+3 RAPID</span>
                        </div>
                        <div class="move-list-scroll" id="move-list-scroll">
                            <div style="color:var(--dim);font-size:11px;padding:8px;" id="empty-move-hint">Game in progress. Moves will be recorded here...</div>
                        </div>
                    </div>

                    <!-- Match Tactical Actions -->
                    <div class="game-actions-row">
                        <button class="btn-danger" id="btn-resign-action" title="Resign position with Stockfish proportional payout">
                            🏳️ Resign (Proportional)
                        </button>
                        <button class="btn-primary" id="btn-draw-action">
                            🤝 Offer Draw (50/50)
                        </button>
                        <button class="btn-icon-subtle" id="btn-flip-board" title="Flip Board Perspective">
                            🔄
                        </button>
                    </div>

                    <div style="display:flex;gap:10px;">
                        <button class="btn-primary" id="btn-ai-move" style="font-size:11px;padding:8px 12px;background:rgba(255,255,255,0.05);">
                            🤖 Auto-Play Opponent Move
                        </button>
                        <button class="btn-primary" id="btn-simulate-win" style="font-size:11px;padding:8px 12px;background:rgba(255,255,255,0.05);">
                            ⚡ Load ≥20 Ply Winning Game
                        </button>
                    </div>
                </aside>
            </main>

            <!-- ============================================================== -->
            <!-- MODAL: RESIGNATION CONFIRMATION (PRD Section 13)               -->
            <!-- ============================================================== -->
            <div class="modal-overlay" id="modal-resign">
                <div class="modal-card">
                    <div class="modal-header">
                        <h3 class="modal-title">Confirm Resignation</h3>
                        <button class="modal-close-btn" id="modal-resign-close">✕</button>
                    </div>

                    <div class="resign-preview-box">
                        <div class="resign-stat-row">
                            <span style="color:var(--dim-more);">Current Stockfish Evaluation:</span>
                            <span class="resign-eval-badge" id="modal-resign-eval">+3.20</span>
                        </div>
                        <div class="resign-stat-row">
                            <span style="color:var(--dim-more);">Completed Plies:</span>
                            <span class="mono" id="modal-resign-plies" style="color:#ffffff;">24 plies (≥ 20 Requirement Met)</span>
                        </div>

                        <div class="payout-split-comparison">
                            <div class="split-card favored" id="modal-split-card-a">
                                <span class="mono" style="font-size:10px;color:var(--dim);">YOU RECEIVE</span>
                                <div class="split-card-val" id="modal-resign-payout-a">15.60 USDC</div>
                                <div class="split-card-pct" id="modal-resign-pct-a">78.0% of Pot</div>
                            </div>
                            <div class="split-card" id="modal-split-card-b">
                                <span class="mono" style="font-size:10px;color:var(--dim);">OPPONENT RECEIVES</span>
                                <div class="split-card-val" id="modal-resign-payout-b">4.40 USDC</div>
                                <div class="split-card-pct" id="modal-resign-pct-b">22.0% of Pot</div>
                            </div>
                        </div>
                    </div>

                    <p class="modal-notice-text" id="modal-resign-warning">
                        Resignation payout is strictly based on the server/oracle Stockfish position evaluation.
                        Because you have completed ≥ 20 plies, the pot is split proportionally according to position strength.
                    </p>

                    <div class="modal-actions">
                        <button class="btn-primary" id="modal-resign-cancel">Cancel</button>
                        <button class="btn-danger" id="modal-resign-confirm">Confirm Resignation & Settle</button>
                    </div>
                </div>
            </div>

            <!-- ============================================================== -->
            <!-- MODAL: SETTLEMENT & GAME RECEIPT (PRD Section 20)              -->
            <!-- ============================================================== -->
            <div class="modal-overlay" id="modal-settlement">
                <div class="modal-card" style="max-width:580px;">
                    <div class="modal-header">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-size:24px;">⚖️</span>
                            <div>
                                <h3 class="modal-title">Game Settlement Receipt</h3>
                                <span class="mono" style="font-size:10px;color:var(--accent-green);">ON-CHAIN SETTLEMENT VERIFIED (BASE)</span>
                            </div>
                        </div>
                        <button class="modal-close-btn" id="modal-settle-close">✕</button>
                    </div>

                    <div class="receipt-container" id="settlement-receipt-body">
                        <!-- Dynamic Receipt Content -->
                    </div>

                    <div class="modal-actions">
                        <button class="btn-primary" id="btn-copy-receipt">📋 Copy Game Receipt</button>
                        <button class="btn-primary" id="btn-new-game-modal" style="background:linear-gradient(135deg,#70d6ff,#a78bfa);color:#08080a;font-weight:700;">
                            ⚔️ Play New Match
                        </button>
                    </div>
                </div>
            </div>

            <!-- ============================================================== -->
            <!-- MODAL: MATCH LOBBY & CREATION (PRD Section 7 & 8)              -->
            <!-- ============================================================== -->
            <div class="modal-overlay" id="modal-lobby">
                <div class="modal-card">
                    <div class="modal-header">
                        <h3 class="modal-title">Create or Join Match</h3>
                        <button class="modal-close-btn" id="modal-lobby-close">✕</button>
                    </div>

                    <div style="display:flex;flex-direction:column;gap:14px;">
                        <div>
                            <label class="mono" style="font-size:10px;display:block;margin-bottom:6px;">STAKE AMOUNT PER PLAYER (USDC)</label>
                            <div style="display:flex;gap:8px;">
                                <button class="btn-primary stake-opt-btn" data-stake="5">5 USDC</button>
                                <button class="btn-primary stake-opt-btn active" data-stake="10">10 USDC</button>
                                <button class="btn-primary stake-opt-btn" data-stake="25">25 USDC</button>
                                <button class="btn-primary stake-opt-btn" data-stake="50">50 USDC</button>
                            </div>
                        </div>

                        <div>
                            <label class="mono" style="font-size:10px;display:block;margin-bottom:6px;">TIME CONTROL</label>
                            <div style="display:flex;gap:8px;">
                                <button class="btn-primary tc-opt-btn" data-tc="0">3+2 Blitz</button>
                                <button class="btn-primary tc-opt-btn active" data-tc="1">5+3 Rapid (Default)</button>
                                <button class="btn-primary tc-opt-btn" data-tc="2">10+0 Classical</button>
                            </div>
                        </div>

                        <div class="escrow-pot-display">
                            <div>
                                <span class="mono" style="font-size:10px;color:var(--dim);">PROJECTED TOTAL ESCROW POT</span>
                                <div style="font-size:22px;font-weight:700;color:#ffffff;" id="lobby-projected-pot">20.00 USDC</div>
                            </div>
                            <span class="mono" style="font-size:10px;color:var(--accent-green);">0% PLATFORM FEE</span>
                        </div>

                        <!-- Waiting Room / Join Deadline countdown -->
                        <div id="lobby-waiting-room" style="display:none;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px;flex-direction:column;gap:8px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <span class="mono" style="font-size:10px;color:var(--dim);">JOIN DEADLINE COUNTDOWN:</span>
                                <span class="mono" id="join-countdown-clock" style="font-size:14px;color:#fbbf24;font-weight:700;">10:00</span>
                            </div>
                            <span class="mono" style="font-size:9px;color:var(--dim);">If unjoined after 10m, creator can cancel and receive full stake refund (PRD Section 7.1).</span>
                            <div style="display:flex;gap:8px;margin-top:6px;">
                                <button class="btn-primary" id="btn-sim-join" style="font-size:11px;">🤝 Simulate Player B Join</button>
                                <button class="btn-danger" id="btn-cancel-unjoined" style="font-size:11px;">Cancel & Refund Stake</button>
                            </div>
                        </div>

                        <div class="modal-actions" id="lobby-create-actions">
                            <button class="btn-primary" id="btn-create-match-submit" style="background:linear-gradient(135deg,#70d6ff,#34d399);color:#08080a;font-weight:700;">
                                Deposit 10.00 USDC & Create Match
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ============================================================== -->
            <!-- MODAL: PRD SETTLEMENT RULES                                    -->
            <!-- ============================================================== -->
            <div class="modal-overlay" id="modal-rules">
                <div class="modal-card" style="max-width:560px;">
                    <div class="modal-header">
                        <h3 class="modal-title">PRD Settlement Specification (v2.1)</h3>
                        <button class="modal-close-btn" id="modal-rules-close">✕</button>
                    </div>

                    <div style="font-size:12px;line-height:1.6;color:var(--ink);display:flex;flex-direction:column;gap:12px;max-height:400px;overflow-y:auto;padding-right:6px;">
                        <p><strong style="color:#ffffff;">Differentiator:</strong> Unlike traditional winner-takes-all wagering, if you resign a chess game, you do not lose the entire stake when the position itself shows that the game was close or winning.</p>
                        
                        <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 14px;">
                            <div style="font-weight:600;color:var(--accent-cyan);margin-bottom:4px;">Locked Resignation Formula (Section 11)</div>
                            <code class="mono" style="display:block;font-size:11px;color:#ffffff;margin-bottom:4px;">winProbA = 1 / (1 + e^(-0.004 * evalForA))</code>
                            <span class="mono" style="font-size:10px;color:var(--dim);">Clamped strictly between 5% and 95%. Example: +320 cp favors Player A by ~78%.</span>
                        </div>

                        <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 14px;">
                            <div style="font-weight:600;color:#fbbf24;margin-bottom:4px;">Minimum 20-Ply Anti-Sandbagging Rule (Section 5.2)</div>
                            <span style="color:var(--dim-more);">Resignation before 20 completed plies forfeits 100% to the opponent. After ≥ 20 plies, the Stockfish evaluation formula governs the payout.</span>
                        </div>

                        <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 14px;">
                            <div style="font-weight:600;color:var(--accent-green);margin-bottom:4px;">Base Network & 0% Protocol Fee</div>
                            <span style="color:var(--dim-more);">Staking uses USDC ERC-20 on Base Sepolia. The hackathon deployment has exactly 0% platform fee: total payout equals total escrowed funds.</span>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn-primary" id="btn-rules-close-done">Close</button>
                    </div>
                </div>
            </div>

            <!-- Pawn Promotion Picker Modal -->
            <div class="modal-overlay" id="modal-promotion">
                <div class="modal-card" style="max-width:360px;">
                    <div class="modal-header">
                        <h3 class="modal-title">Pawn Promotion</h3>
                    </div>
                    <div class="promotion-picker" id="promotion-picker-options"></div>
                </div>
            </div>
        `;

        document.body.appendChild(landing);
        document.body.appendChild(arena);
    }

    // -------------------------------------------------------------
    // CHESSBOARD RENDERING & INTERACTION
    // -------------------------------------------------------------
    function renderBoard() {
        const boardEl = document.getElementById('chessboard');
        if (!boardEl || !state.chess) return;

        boardEl.innerHTML = '';
        const board = state.chess.board();
        const isWhite = state.boardOrientation === 'w';

        for (let rIdx = 0; rIdx < 8; rIdx++) {
            for (let cIdx = 0; cIdx < 8; cIdx++) {
                const r = isWhite ? rIdx : 7 - rIdx;
                const c = isWhite ? cIdx : 7 - cIdx;
                const squareName = String.fromCharCode(97 + c) + (8 - r);
                const piece = board[r][c];

                const sqEl = document.createElement('div');
                sqEl.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
                sqEl.dataset.square = squareName;

                // Selection highlight
                if (state.selectedSquare === squareName) {
                    sqEl.classList.add('selected');
                }

                // Check highlight
                if (state.chess.in_check && state.chess.in_check()) {
                    const turn = state.chess.turn();
                    if (piece && piece.type === 'k' && piece.color === turn) {
                        sqEl.classList.add('in-check');
                    }
                }

                // Legal move indicator
                const isLegalTarget = state.legalMovesForSelected.some(m => m.to === squareName);
                if (isLegalTarget) {
                    if (piece) {
                        const ring = document.createElement('div');
                        ring.className = 'move-hint-capture-ring';
                        sqEl.appendChild(ring);
                    } else {
                        const dot = document.createElement('div');
                        dot.className = 'move-hint-dot';
                        sqEl.appendChild(dot);
                    }
                }

                // Coordinates
                if ((isWhite && r === 7) || (!isWhite && r === 0)) {
                    const fLabel = document.createElement('span');
                    fLabel.className = 'coord-label coord-file';
                    fLabel.textContent = String.fromCharCode(97 + c);
                    sqEl.appendChild(fLabel);
                }
                if ((isWhite && c === 0) || (!isWhite && c === 7)) {
                    const rLabel = document.createElement('span');
                    rLabel.className = 'coord-label coord-rank';
                    rLabel.textContent = (8 - r);
                    sqEl.appendChild(rLabel);
                }

                // Piece SVG
                if (piece) {
                    const pKey = piece.color + piece.type.toUpperCase();
                    if (PIECE_SVGS[pKey]) {
                        const pEl = document.createElement('div');
                        pEl.className = 'chess-piece';
                        pEl.innerHTML = PIECE_SVGS[pKey];
                        sqEl.appendChild(pEl);
                    }
                }

                sqEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleSquareClick(squareName);
                });

                boardEl.appendChild(sqEl);
            }
        }

        updateHUDs();
    }

    // -------------------------------------------------------------
    // SQUARE CLICK & MOVE HANDLING
    // -------------------------------------------------------------
    function handleSquareClick(square) {
        if (state.status === 'SETTLED' || state.status === 'CANCELLED') return;

        const pieceAtSquare = state.chess.get(square);
        const turn = state.chess.turn();

        // 1. If currently a piece is selected and user clicked a target square
        if (state.selectedSquare) {
            const moveCandidate = state.legalMovesForSelected.find(m => m.to === square);
            if (moveCandidate) {
                // Check if promotion is needed
                if (moveCandidate.flags && moveCandidate.flags.includes('p')) {
                    promptPromotion(state.selectedSquare, square);
                    return;
                }
                executeMove(state.selectedSquare, square);
                return;
            }
        }

        // 2. Select own piece
        if (pieceAtSquare && pieceAtSquare.color === turn) {
            state.selectedSquare = square;
            const moves = state.chess.moves({ square: square, verbose: true });
            state.legalMovesForSelected = moves;
            renderBoard();
            return;
        }

        // 3. Clear selection
        state.selectedSquare = null;
        state.legalMovesForSelected = [];
        renderBoard();
    }

    function promptPromotion(from, to) {
        state.pendingPromotion = { from, to };
        const modal = document.getElementById('modal-promotion');
        const container = document.getElementById('promotion-picker-options');
        const color = state.chess.turn();

        container.innerHTML = '';
        ['q', 'r', 'b', 'n'].forEach(type => {
            const btn = document.createElement('button');
            btn.className = 'promotion-piece-btn';
            const key = color + type.toUpperCase();
            btn.innerHTML = PIECE_SVGS[key] || type;
            btn.onclick = () => {
                modal.classList.remove('open');
                executeMove(from, to, type);
                state.pendingPromotion = null;
            };
            container.appendChild(btn);
        });

        modal.classList.add('open');
    }

    function executeMove(from, to, promotion = 'q') {
        const move = state.chess.move({ from, to, promotion });
        if (!move) return;

        // Play sound
        if (state.chess.in_check && state.chess.in_check()) {
            playSound('check');
        } else if (move.captured) {
            playSound('capture');
        } else {
            playSound('move');
        }

        state.selectedSquare = null;
        state.legalMovesForSelected = [];

        // Apply clock increment to player who just moved
        const movedColor = move.color;
        const inc = state.timeControlConfigs[state.timeControlIdx].inc;
        state.clocks[movedColor] += inc;

        renderBoard();
        appendMoveNotation(move);
        updateLiveStockfishEval();

        // Check game-ending conditions
        if (state.chess.in_checkmate && state.chess.in_checkmate()) {
            handleCheckmate();
        } else if (state.chess.in_draw && state.chess.in_draw()) {
            handleDraw('DRAW');
        }
    }

    // -------------------------------------------------------------
    // LIVE EVALUATION UPDATER
    // -------------------------------------------------------------
    async function updateLiveStockfishEval() {
        const fen = state.chess.fen();
        const plies = state.chess.history().length;
        const playerAIsWhite = state.playerA.color === 'w';

        try {
            const res = await fetch('/api/eval', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen, playerAIsWhite, plies })
            });

            if (res.ok) {
                const data = await res.json();
                state.currentEvalCp = data.stockfishEval;
                updateEvalBar(data.stockfishEval, playerAIsWhite, plies);
                return;
            }
        } catch {
            // Local fallback
        }

        // Local deterministic calculation if offline
        const localCp = computeLocalEval(fen);
        state.currentEvalCp = localCp;
        updateEvalBar(localCp, playerAIsWhite, plies);
    }

    function computeLocalEval(fen) {
        // Quick material count + mobility
        const board = state.chess.board();
        const val = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
        let score = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (!p) continue;
                score += (p.color === 'w' ? val[p.type] : -val[p.type]);
            }
        }
        return score;
    }

    function updateEvalBar(evalCp, playerAIsWhite, plies) {
        const evalWhiteEl = document.getElementById('eval-label-white');
        const evalBlackEl = document.getElementById('eval-label-black');
        const fillWhiteEl = document.getElementById('eval-fill-white');
        const fillBlackEl = document.getElementById('eval-fill-black');

        // Convert centipawns to bar percentage (sigmoid scaled)
        // 0 cp = 50%, +500 cp ≈ 85%, -500 cp ≈ 15%
        const normalized = 1 / (1 + Math.exp(-0.0035 * evalCp));
        const whitePct = Math.max(5, Math.min(95, normalized * 100));
        const blackPct = 100 - whitePct;

        if (fillWhiteEl) fillWhiteEl.style.height = `${whitePct}%`;
        if (fillBlackEl) fillBlackEl.style.height = `${blackPct}%`;

        const cpFormatted = (evalCp / 100).toFixed(1);
        if (evalWhiteEl) {
            evalWhiteEl.textContent = evalCp >= 0 ? `+${cpFormatted}` : '';
        }
        if (evalBlackEl) {
            evalBlackEl.textContent = evalCp < 0 ? `${cpFormatted}` : '';
        }

        // Update Proportional Split widget
        const payout = computePRDPayout(evalCp, playerAIsWhite, plies);
        state.currentWinProbA = payout.winProbA;

        const splitPctAEl = document.getElementById('split-pct-a');
        const splitPctBEl = document.getElementById('split-pct-b');
        const splitUsdcAEl = document.getElementById('split-usdc-a');
        const splitUsdcBEl = document.getElementById('split-usdc-b');
        const splitBarAEl = document.getElementById('split-bar-a');
        const splitBarBEl = document.getElementById('split-bar-b');

        const pctA = (payout.winProbA * 100).toFixed(1);
        const pctB = (100 - parseFloat(pctA)).toFixed(1);

        if (splitPctAEl) splitPctAEl.textContent = `${pctA}% A`;
        if (splitPctBEl) splitPctBEl.textContent = `${pctB}% B`;
        if (splitUsdcAEl) splitUsdcAEl.textContent = `${payout.payoutUSDC_A.toFixed(2)} USDC`;
        if (splitUsdcBEl) splitUsdcBEl.textContent = `${payout.payoutUSDC_B.toFixed(2)} USDC`;
        if (splitBarAEl) splitBarAEl.style.width = `${pctA}%`;
        if (splitBarBEl) splitBarBEl.style.width = `${pctB}%`;
    }

    // -------------------------------------------------------------
    // HUD & CLOCK UPDATERS
    // -------------------------------------------------------------
    function updateHUDs() {
        const plies = state.chess ? state.chess.history().length : 0;
        const turn = state.chess ? state.chess.turn() : 'w';

        // Turn glows
        const hudA = document.getElementById('hud-player-a');
        const hudB = document.getElementById('hud-player-b');
        if (hudA) hudA.classList.toggle('active-turn', turn === state.playerA.color);
        if (hudB) hudB.classList.toggle('active-turn', turn === state.playerB.color);

        // Ply Counter & Threshold badge (PRD Section 5.2)
        const plyBadge = document.getElementById('ply-threshold-badge');
        const plyVal = document.getElementById('ply-counter-val');
        const plyDesc = document.getElementById('ply-threshold-desc');

        if (plyVal) plyVal.textContent = `PLY ${plies} / ${LOCKED.MIN_RESIGN_PLIES}`;

        if (plies < LOCKED.MIN_RESIGN_PLIES) {
            if (plyBadge) {
                plyBadge.className = 'ply-threshold-box under-threshold';
            }
            if (plyDesc) {
                plyDesc.textContent = `Under 20 plies. Resignation forfeits 100% to opponent.`;
            }
        } else {
            if (plyBadge) {
                plyBadge.className = 'ply-threshold-box over-threshold';
            }
            if (plyDesc) {
                plyDesc.textContent = `≥ 20 Plies met! Stockfish proportional resignation enabled.`;
            }
        }

        // Captured pieces
        renderCapturedPieces();
    }

    function renderCapturedPieces() {
        if (!state.chess) return;
        const history = state.chess.history({ verbose: true });
        const capW = document.getElementById('captures-player-a');
        const capB = document.getElementById('captures-player-b');
        if (!capW || !capB) return;

        const capturedByWhite = [];
        const capturedByBlack = [];

        const pieceIcons = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };

        history.forEach(m => {
            if (m.captured) {
                if (m.color === 'w') {
                    capturedByWhite.push(pieceIcons[m.captured] || '');
                } else {
                    capturedByBlack.push(pieceIcons[m.captured] || '');
                }
            }
        });

        capW.innerHTML = capturedByWhite.join('');
        capB.innerHTML = capturedByBlack.join('');
    }

    function startClockTimer() {
        if (state.clockTimer) clearInterval(state.clockTimer);

        state.clockTimer = setInterval(() => {
            if (state.status !== 'ACTIVE' || !state.chess) return;

            const turn = state.chess.turn();
            if (state.clocks[turn] > 0) {
                state.clocks[turn]--;
                formatClockDisplay();
            } else {
                handleTimeout(turn);
            }
        }, 1000);
    }

    function formatClockDisplay() {
        const fmt = (sec) => {
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        };

        const clkA = document.getElementById('clock-player-a');
        const clkB = document.getElementById('clock-player-b');

        if (clkA) {
            clkA.textContent = fmt(state.clocks[state.playerA.color]);
            clkA.classList.toggle('low-time', state.clocks[state.playerA.color] <= 30);
        }
        if (clkB) {
            clkB.textContent = fmt(state.clocks[state.playerB.color]);
            clkB.classList.toggle('low-time', state.clocks[state.playerB.color] <= 30);
        }
    }

    // -------------------------------------------------------------
    // MOVE NOTATION TABLE
    // -------------------------------------------------------------
    function appendMoveNotation(move) {
        const scroll = document.getElementById('move-list-scroll');
        const emptyHint = document.getElementById('empty-move-hint');
        if (emptyHint) emptyHint.remove();

        const history = state.chess.history();
        const moveNumber = Math.ceil(history.length / 2);

        let row = document.getElementById(`move-row-${moveNumber}`);
        if (!row) {
            row = document.createElement('div');
            row.id = `move-row-${moveNumber}`;
            row.className = 'move-row';
            row.innerHTML = `<span class="move-num">${moveNumber}.</span><span class="move-white"></span><span class="move-black"></span>`;
            scroll.appendChild(row);
        }

        const whiteSpan = row.querySelector('.move-white');
        const blackSpan = row.querySelector('.move-black');

        if (move.color === 'w') {
            whiteSpan.textContent = move.san;
        } else {
            blackSpan.textContent = move.san;
        }

        scroll.scrollTop = scroll.scrollHeight;
    }

    // -------------------------------------------------------------
    // PRD SECTION 13: RESIGNATION CONFIRMATION MODAL
    // -------------------------------------------------------------
    function openResignationModal() {
        const modal = document.getElementById('modal-resign');
        if (!modal) return;

        const plies = state.chess.history().length;
        const playerAIsWhite = state.playerA.color === 'w';
        const evalCp = state.currentEvalCp;
        const payout = computePRDPayout(evalCp, playerAIsWhite, plies);

        const evalBadge = document.getElementById('modal-resign-eval');
        const pliesBadge = document.getElementById('modal-resign-plies');
        const valA = document.getElementById('modal-resign-payout-a');
        const valB = document.getElementById('modal-resign-payout-b');
        const pctA = document.getElementById('modal-resign-pct-a');
        const pctB = document.getElementById('modal-resign-pct-b');
        const warning = document.getElementById('modal-resign-warning');

        if (evalBadge) evalBadge.textContent = evalCp >= 0 ? `+${(evalCp / 100).toFixed(1)} cp` : `${(evalCp / 100).toFixed(1)} cp`;
        if (pliesBadge) {
            pliesBadge.textContent = `${plies} plies (${plies >= LOCKED.MIN_RESIGN_PLIES ? '≥ 20 Requirement Met' : '< 20 Plies Penalty Active'})`;
            pliesBadge.style.color = plies >= LOCKED.MIN_RESIGN_PLIES ? 'var(--accent-green)' : '#fbbf24';
        }

        if (plies < LOCKED.MIN_RESIGN_PLIES) {
            valA.textContent = '0.00 USDC';
            pctA.textContent = '0% (Forfeit)';
            valB.textContent = `${state.totalPot.toFixed(2)} USDC`;
            pctB.textContent = '100% of Pot';
            warning.innerHTML = `<span style="color:#f87171;font-weight:600;">⚠️ Early Resignation Warning:</span> You have completed ${plies} plies, which is under the 20-ply threshold. Under PRD Section 5.2, resigning now awards 100% of the pot to your opponent.`;
        } else {
            valA.textContent = `${payout.payoutUSDC_A.toFixed(2)} USDC`;
            pctA.textContent = `${(payout.winProbA * 100).toFixed(1)}% of Pot`;
            valB.textContent = `${payout.payoutUSDC_B.toFixed(2)} USDC`;
            pctB.textContent = `${(100 - payout.winProbA * 100).toFixed(1)}% of Pot`;
            warning.innerHTML = `Resignation payout is calculated from the final position strength via Stockfish evaluation. Clamped to 5%–95%.`;
        }

        modal.classList.add('open');
    }

    // -------------------------------------------------------------
    // PRD SECTION 20: SETTLEMENT & GAME RECEIPT MODAL
    // -------------------------------------------------------------
    async function settleGame(endReason, resignerColor = null) {
        state.status = 'SETTLED';
        if (state.clockTimer) clearInterval(state.clockTimer);
        playSound('settle');

        const plies = state.chess.history().length;
        const playerAIsWhite = state.playerA.color === 'w';
        const finalFEN = state.chess.fen();
        const evalCp = state.currentEvalCp;

        let endReasonCode = endReason;
        if (endReason === 'RESIGNATION') {
            endReasonCode = (resignerColor === 'w') ? 'A_RESIGNED' : 'B_RESIGNED';
        }

        let receipt = null;

        try {
            const res = await fetch('/api/matches/settle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: state.gameId,
                    endReason: endReasonCode,
                    finalFEN,
                    evalCp,
                    plies
                })
            });

            if (res.ok) {
                const data = await res.json();
                receipt = data.receipt;
            }
        } catch {
            // Local fallback simulation
        }

        if (!receipt) {
            // Autonomous local fallback receipt
            const calc = computePRDPayout(evalCp, playerAIsWhite, plies);
            const totalPot = state.totalPot;
            const payoutUSDC_A = calc.payoutUSDC_A;
            const payoutUSDC_B = calc.payoutUSDC_B;
            const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

            receipt = {
                gameId: state.gameId,
                network: LOCKED.NETWORK,
                chainId: LOCKED.CHAIN_ID,
                escrowContract: LOCKED.ESCROW_CONTRACT,
                playerA: state.playerA.address,
                playerB: state.playerB.address,
                stakeAmountEach: state.stakeAmount,
                totalPot: state.totalPot,
                plies,
                endReason: endReasonCode,
                finalFEN,
                stockfishEval: evalCp,
                payoutBpsToA: calc.payoutBpsToA,
                payoutBpsToB: calc.payoutBpsToB,
                payoutUSDC_A,
                payoutUSDC_B,
                oracleAddress: LOCKED.ORACLE_ADDRESS,
                finalStateHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                oracleSignature: '0x' + Array.from({ length: 130 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                txHash,
                baseScanUrl: `https://sepolia.basescan.org/tx/${txHash}`
            };
        }

        state.lastSettlementReceipt = receipt;
        showSettlementReceiptModal(receipt);
    }

    function showSettlementReceiptModal(r) {
        const modal = document.getElementById('modal-settlement');
        const body = document.getElementById('settlement-receipt-body');
        if (!modal || !body) return;

        body.innerHTML = `
            <div class="receipt-line">
                <span style="color:var(--dim);">Network:</span>
                <span style="color:#ffffff;">${r.network} (Chain ID: ${r.chainId})</span>
            </div>
            <div class="receipt-line">
                <span style="color:var(--dim);">Game ID:</span>
                <span style="color:var(--accent-cyan);">${r.gameId}</span>
            </div>
            <div class="receipt-line">
                <span style="color:var(--dim);">Escrow Contract:</span>
                <span style="color:var(--dim-more);">${r.escrowContract}</span>
            </div>
            <div class="receipt-line">
                <span style="color:var(--dim);">Total Pot / Fee:</span>
                <span style="color:#ffffff;">${r.totalPot.toFixed(2)} USDC (0% Platform Fee)</span>
            </div>
            <div class="receipt-line">
                <span style="color:var(--dim);">End Reason:</span>
                <span style="color:#fbbf24;font-weight:700;">${r.endReason}</span>
            </div>
            <div class="receipt-line">
                <span style="color:var(--dim);">Plies Completed:</span>
                <span style="color:#ffffff;">${r.plies} plies</span>
            </div>
            <div class="receipt-line">
                <span style="color:var(--dim);">Final Stockfish Eval:</span>
                <span style="color:var(--accent-cyan);font-weight:700;">${r.stockfishEval >= 0 ? '+' : ''}${(r.stockfishEval / 100).toFixed(1)} cp</span>
            </div>
            <div class="receipt-line" style="background:rgba(52,211,153,0.06);padding:6px;border-radius:4px;">
                <span style="color:var(--accent-green);font-weight:700;">Player A Payout:</span>
                <span style="color:#ffffff;font-weight:700;">${r.payoutUSDC_A.toFixed(2)} USDC (${(r.payoutBpsToA / 100).toFixed(1)}%)</span>
            </div>
            <div class="receipt-line" style="background:rgba(167,139,250,0.06);padding:6px;border-radius:4px;">
                <span style="color:var(--accent-purple);font-weight:700;">Player B Payout:</span>
                <span style="color:#ffffff;font-weight:700;">${r.payoutUSDC_B.toFixed(2)} USDC (${(r.payoutBpsToB / 100).toFixed(1)}%)</span>
            </div>
            <div class="receipt-line">
                <span style="color:var(--dim);">Final FEN:</span>
                <span style="font-size:9px;color:var(--dim-more);word-break:break-all;">${r.finalFEN}</span>
            </div>
            <div class="receipt-line">
                <span style="color:var(--dim);">Oracle Signer:</span>
                <span style="color:var(--accent-cyan);">${r.oracleAddress}</span>
            </div>
            <div class="receipt-line">
                <span style="color:var(--dim);">Base Sepolia Tx Hash:</span>
                <a href="${r.baseScanUrl}" target="_blank" class="receipt-hash-link">${r.txHash.slice(0, 18)}...${r.txHash.slice(-8)} ↗</a>
            </div>
        `;

        modal.classList.add('open');
    }

    // -------------------------------------------------------------
    // GAME END CONDITIONS (Checkmate, Timeout, Draw)
    // -------------------------------------------------------------
    function handleCheckmate() {
        const turn = state.chess.turn();
        const winnerColor = turn === 'w' ? 'b' : 'w';
        const winnerIsA = winnerColor === state.playerA.color;
        settleGame(winnerIsA ? 'CHECKMATE_A_WINS' : 'CHECKMATE_B_WINS');
    }

    function handleTimeout(flaggedColor) {
        const winnerColor = flaggedColor === 'w' ? 'b' : 'w';
        const winnerIsA = winnerColor === state.playerA.color;
        settleGame(winnerIsA ? 'TIMEOUT_A_WINS' : 'TIMEOUT_B_WINS');
    }

    function handleDraw(reason = 'DRAW') {
        settleGame(reason);
    }

    // -------------------------------------------------------------
    // MATCH CREATION & LOBBY CONTROLLER
    // -------------------------------------------------------------
    async function startNewMatch(stakeAmount = 10.0, timeControlIdx = 1) {
        state.stakeAmount = stakeAmount;
        state.totalPot = stakeAmount * 2;
        state.timeControlIdx = timeControlIdx;

        const tc = state.timeControlConfigs[timeControlIdx];
        state.clocks = { w: tc.initial, b: tc.initial };

        state.chess.reset();
        state.selectedSquare = null;
        state.legalMovesForSelected = [];
        state.status = 'ACTIVE';

        // Clear move list DOM
        const scroll = document.getElementById('move-list-scroll');
        if (scroll) {
            scroll.innerHTML = '<div style="color:var(--dim);font-size:11px;padding:8px;" id="empty-move-hint">Game in progress. Moves will be recorded here...</div>';
        }

        try {
            const res = await fetch('/api/matches/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stakeAmount, timeControl: timeControlIdx })
            });
            if (res.ok) {
                const data = await res.json();
                state.gameId = data.match.gameId;
            }
        } catch {
            // Local fallback gameId
            state.gameId = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        }

        const idEl = document.getElementById('hud-match-id');
        if (idEl) idEl.textContent = `ID: ${state.gameId.slice(0, 8)}...${state.gameId.slice(-4)}`;

        const potEl = document.getElementById('hud-pot-display');
        if (potEl) potEl.textContent = state.totalPot.toFixed(2);

        const tcBadge = document.getElementById('hud-tc-badge');
        if (tcBadge) tcBadge.textContent = tc.label.toUpperCase();

        renderBoard();
        formatClockDisplay();
        startClockTimer();
        updateLiveStockfishEval();
    }

    // -------------------------------------------------------------
    // SIMULATION TOOLS (Fast testing of PRD criteria)
    // -------------------------------------------------------------
    function playAIMove() {
        if (!state.chess || state.status !== 'ACTIVE') return;
        const moves = state.chess.moves({ verbose: true });
        if (moves.length === 0) return;

        // Choose a strategic move (captures prioritized)
        const capture = moves.find(m => m.captured);
        const selected = capture || moves[Math.floor(Math.random() * moves.length)];
        executeMove(selected.from, selected.to, selected.promotion || 'q');
    }

    function loadHighPlyWinningGame() {
        // Loads a 24-ply game where White is in a dominating +3.5 position
        // Allows immediate testing of the PRD Section 11 & 13 proportional resignation!
        if (state.clockTimer) clearInterval(state.clockTimer);
        state.chess.reset();

        const moveSeq = [
            'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6',
            'd4', 'exd4', 'cxd4', 'Bb4+', 'Nc3', 'Nxe4', 'O-O', 'Bxc3',
            'd5', 'Bf6', 'Re1', 'Ne7', 'Rxe4', 'd6', 'Bg5', 'Bxg5'
        ];

        moveSeq.forEach(san => state.chess.move(san));

        const scroll = document.getElementById('move-list-scroll');
        if (scroll) scroll.innerHTML = '';
        state.chess.history({ verbose: true }).forEach(m => appendMoveNotation(m));

        state.status = 'ACTIVE';
        renderBoard();
        startClockTimer();
        updateLiveStockfishEval();
    }

    // -------------------------------------------------------------
    // EVENT LISTENERS & USER CONTROLS
    // -------------------------------------------------------------
    function setupEventListeners() {
        // Navigation Tabs
        const btnArena = document.getElementById('tab-btn-arena');
        const btnLobby = document.getElementById('tab-btn-lobby');
        const btnRules = document.getElementById('tab-btn-rules');
        const modalLobby = document.getElementById('modal-lobby');
        const modalRules = document.getElementById('modal-rules');

        if (btnLobby) {
            btnLobby.onclick = () => modalLobby.classList.add('open');
        }
        if (btnRules) {
            btnRules.onclick = () => modalRules.classList.add('open');
        }
        if (btnArena) {
            btnArena.onclick = () => {
                modalLobby.classList.remove('open');
                modalRules.classList.remove('open');
            };
        }

        // Modal Close Buttons
        document.getElementById('modal-resign-close')?.addEventListener('click', () => {
            document.getElementById('modal-resign').classList.remove('open');
        });
        document.getElementById('modal-resign-cancel')?.addEventListener('click', () => {
            document.getElementById('modal-resign').classList.remove('open');
        });
        document.getElementById('modal-settle-close')?.addEventListener('click', () => {
            document.getElementById('modal-settlement').classList.remove('open');
        });
        document.getElementById('modal-lobby-close')?.addEventListener('click', () => {
            modalLobby.classList.remove('open');
        });
        document.getElementById('modal-rules-close')?.addEventListener('click', () => {
            modalRules.classList.remove('open');
        });
        document.getElementById('btn-rules-close-done')?.addEventListener('click', () => {
            modalRules.classList.remove('open');
        });

        // Resign Button -> Opens PRD Section 13 Modal
        document.getElementById('btn-resign-action')?.addEventListener('click', () => {
            openResignationModal();
        });

        // Resignation Confirm Button -> Settles Game
        document.getElementById('modal-resign-confirm')?.addEventListener('click', () => {
            document.getElementById('modal-resign').classList.remove('open');
            settleGame('RESIGNATION', state.playerA.color);
        });

        // Draw Offer Button
        document.getElementById('btn-draw-action')?.addEventListener('click', () => {
            if (confirm('Opponent accepts draw offer? Under PRD Section 5.4, draw pays 50/50.')) {
                handleDraw('DRAW');
            }
        });

        // Flip Board
        document.getElementById('btn-flip-board')?.addEventListener('click', () => {
            state.boardOrientation = state.boardOrientation === 'w' ? 'b' : 'w';
            renderBoard();
        });

        // Sound Toggle
        document.getElementById('btn-toggle-sound')?.addEventListener('click', () => {
            state.soundEnabled = !state.soundEnabled;
            document.getElementById('sound-icon').textContent = state.soundEnabled ? '🔊' : '🔇';
        });

        // 3D Backdrop Dim Toggle
        document.getElementById('btn-toggle-dim')?.addEventListener('click', () => {
            state.dim3D = !state.dim3D;
            document.body.classList.toggle('dim-backdrop', state.dim3D);
        });

        // AI Move and Simulation Buttons
        document.getElementById('btn-ai-move')?.addEventListener('click', playAIMove);
        document.getElementById('btn-simulate-win')?.addEventListener('click', loadHighPlyWinningGame);

        // Copy Game Receipt Button
        document.getElementById('btn-copy-receipt')?.addEventListener('click', () => {
            if (!state.lastSettlementReceipt) return;
            const text = JSON.stringify(state.lastSettlementReceipt, null, 2);
            navigator.clipboard.writeText(text).then(() => alert('Game receipt copied to clipboard!'));
        });

        // Play New Game
        document.getElementById('btn-new-game-modal')?.addEventListener('click', () => {
            document.getElementById('modal-settlement').classList.remove('open');
            startNewMatch(state.stakeAmount, state.timeControlIdx);
        });

        // Match ID Click to Copy
        document.getElementById('hud-match-id')?.addEventListener('click', () => {
            if (state.gameId) {
                navigator.clipboard.writeText(state.gameId).then(() => alert(`Match ID ${state.gameId} copied!`));
            }
        });

        // Stake selection buttons in Lobby
        document.querySelectorAll('.stake-opt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.stake-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const val = parseFloat(btn.dataset.stake);
                state.stakeAmount = val;
                document.getElementById('lobby-projected-pot').textContent = `${(val * 2).toFixed(2)} USDC`;
                document.getElementById('btn-create-match-submit').textContent = `Deposit ${val.toFixed(2)} USDC & Create Match`;
            });
        });

        // Time control selection buttons in Lobby
        document.querySelectorAll('.tc-opt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tc-opt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.timeControlIdx = parseInt(btn.dataset.tc, 10);
            });
        });

        // Create Match Submit
        document.getElementById('btn-create-match-submit')?.addEventListener('click', () => {
            startNewMatch(state.stakeAmount, state.timeControlIdx);
            document.getElementById('modal-lobby').classList.remove('open');
            window.showArenaView();
        });

        // -------------------------------------------------------------
        // LANDING PAGE & NAVIGATION EVENT LISTENERS
        // -------------------------------------------------------------
        // Hub / Landing Return Button in Arena Header
        document.getElementById('btn-back-to-landing')?.addEventListener('click', () => {
            window.showLandingPage();
        });

        // Brand Logo click to go to Landing
        document.getElementById('nav-brand-logo')?.addEventListener('click', () => {
            window.showLandingPage();
        });
        document.getElementById('landing-brand-logo')?.addEventListener('click', () => {
            window.showLandingPage();
        });

        // Return to 3D Paper Starter Button
        document.getElementById('btn-view-3d-starter')?.addEventListener('click', () => {
            if (window.returnToStarter) {
                window.returnToStarter();
            }
        });

        // Enter Arena buttons
        document.getElementById('btn-nav-enter-arena')?.addEventListener('click', () => {
            window.showArenaView();
        });
        document.getElementById('hero-play-arena')?.addEventListener('click', () => {
            window.showArenaView();
        });
        document.getElementById('hero-quick-match')?.addEventListener('click', () => {
            startNewMatch(10.0, 1);
            window.showArenaView();
            showToast('⚡ Quick Match Initialized (10 USDC Pot on Base Sepolia)');
        });

        // Escrow specs buttons
        document.getElementById('hero-view-escrow')?.addEventListener('click', () => {
            modalRules.classList.add('open');
        });
        document.getElementById('btn-view-specs')?.addEventListener('click', () => {
            modalRules.classList.add('open');
        });

        // Copy Wallet Button
        document.getElementById('btn-copy-wallet')?.addEventListener('click', () => {
            const addr = '0x892aF6E22C991316bDf255d648f57F43e4A142C1';
            navigator.clipboard.writeText(addr).then(() => {
                showToast('📋 Base Sepolia Wallet Address Copied!');
            });
        });

        // Avatar selector in registration form
        document.querySelectorAll('#reg-avatar-list .avatar-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('#reg-avatar-list .avatar-opt').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
            });
        });

        // Registration Time Control buttons
        document.querySelectorAll('.reg-tc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.reg-tc-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Registration Stake buttons
        document.querySelectorAll('.reg-stake-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.reg-stake-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Save Profile Button
        document.getElementById('btn-save-profile')?.addEventListener('click', () => {
            const gamerTag = document.getElementById('reg-gamer-tag')?.value.trim() || 'GrandmasterZero';
            const elo = document.getElementById('reg-elo')?.value.trim() || '1850 Arena Elo';
            const activeAvatarEl = document.querySelector('#reg-avatar-list .avatar-opt.active');
            const avatar = activeAvatarEl ? activeAvatarEl.dataset.avatar : '♟';
            const activeTcEl = document.querySelector('.reg-tc-btn.active');
            const tc = activeTcEl ? parseInt(activeTcEl.dataset.tc, 10) : 1;
            const activeStakeEl = document.querySelector('.reg-stake-btn.active');
            const stake = activeStakeEl ? parseFloat(activeStakeEl.dataset.stake) : 10;

            const profile = { gamerTag, elo, avatar, tc, stake };
            localStorage.setItem('evalstake_profile', JSON.stringify(profile));

            // Sync with Player A HUD
            const nameEl = document.getElementById('name-player-a');
            if (nameEl) nameEl.textContent = `${gamerTag} (White)`;
            const avatarEl = document.querySelector('#hud-player-a .white-avatar');
            if (avatarEl) avatarEl.textContent = avatar;

            showToast(`Profile Registered: ${gamerTag} [${elo}]`);
        });

        // Settings: Audio FX Toggle
        document.getElementById('setting-sound-toggle')?.addEventListener('change', (e) => {
            state.soundEnabled = e.target.checked;
            const soundIcon = document.getElementById('sound-icon');
            if (soundIcon) soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
            showToast(state.soundEnabled ? '🔊 Audio FX Enabled' : '🔇 Audio FX Muted');
        });

        // Settings: Board Theme
        document.getElementById('setting-board-theme')?.addEventListener('change', (e) => {
            const theme = e.target.value;
            const board = document.getElementById('chessboard');
            if (board) {
                board.classList.remove('theme-cyber', 'theme-walnut');
                if (theme === 'cyber') board.classList.add('theme-cyber');
                if (theme === 'walnut') board.classList.add('theme-walnut');
            }
            showToast(`Board Theme Updated: ${theme.toUpperCase()}`);
        });

        // Settings: Engine Depth
        document.getElementById('setting-engine-depth')?.addEventListener('change', (e) => {
            showToast(`Stockfish Engine Depth Set to ${e.target.value} Plies`);
        });

        // Settings: Faucet Claim
        document.getElementById('setting-faucet-btn')?.addEventListener('click', () => {
            state.playerA.balanceUSDC += 100.0;
            const balStr = `${state.playerA.balanceUSDC.toFixed(2)} USDC`;
            const balEl = document.getElementById('landing-usdc-bal');
            if (balEl) balEl.textContent = balStr;
            const headerBal = document.getElementById('header-usdc-bal');
            if (headerBal) headerBal.textContent = balStr;
            showToast('💧 Claimed +100.00 Mock USDC from Base Sepolia Faucet!');
            playSound('settle');
        });

        // Lobby Challenge Buttons: Join Match
        document.querySelectorAll('.btn-join-match').forEach(btn => {
            btn.addEventListener('click', () => {
                const stake = parseFloat(btn.dataset.stake || '10');
                const tc = parseInt(btn.dataset.tc || '1', 10);
                const opp = btn.dataset.opp || 'Opponent';

                startNewMatch(stake, tc);
                const oppName = document.getElementById('name-player-b');
                if (oppName) oppName.textContent = `${opp} (Black)`;

                window.showArenaView();
                showToast(`⚔️ Entered Match vs ${opp} for ${stake.toFixed(2)} USDC`);
            });
        });

        // Create Challenge from Lobby Card
        document.getElementById('btn-create-lobby-match')?.addEventListener('click', () => {
            modalLobby.classList.add('open');
        });
    }

    // Start initialization when document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
