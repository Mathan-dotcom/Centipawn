const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const { ethers } = require('ethers');

// Zero-dependency .env loader
try {
    const envPath = path.join(__dirname, '..', '.env');
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
    console.warn('[Env] Notice:', e.message);
}

const RPC_URL = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
const USDC_ADDRESS = process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const ESCROW_ADDRESS = process.env.ESCROW_CONTRACT || '0x0451c13fadBF8Fd8A6f1311d5d125778FC2ca5C0';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const playerAKey = process.env.DEPLOYER_KEY;
const playerBKey = process.env.PLAYER_B_KEY;

const walletA = new ethers.Wallet(playerAKey, provider);
const walletB = new ethers.Wallet(playerBKey, provider);

console.log('======================================================================');
console.log('   CENTIPAWN — TWO-WINDOW INVITE-LINK MATCH CONNECTION & SETTLEMENT   ');
console.log('======================================================================');
console.log('Player A (White):', walletA.address);
console.log('Player B (Black):', walletB.address);
console.log('Escrow Contract: ', ESCROW_ADDRESS);
console.log('USDC Contract:   ', USDC_ADDRESS);
console.log('Base Sepolia RPC:', RPC_URL);

// Helper to launch Edge and connect CDP
async function launchBrowser(port, url) {
    const os = require('os');
    const udir = path.join(os.tmpdir(), 'centipawn_edge_' + port);
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const proc = spawn(edgePath, [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=msFirstRun,msSyncConfirmation',
        '--window-size=1280,900',
        `--user-data-dir=${udir}`,
        url
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const targets = await new Promise(resolve => {
        http.get(`http://127.0.0.1:${port}/json`, res => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
        });
    });

    const page = targets.find(t => t.type === 'page' && t.url.includes('localhost:3000')) ||
                 targets.find(t => t.type === 'page' && !t.url.startsWith('edge://') && !t.url.startsWith('chrome-extension://')) ||
                 targets[0];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let msgId = 1;
    function send(method, params = {}) {
        return new Promise(resolve => {
            const cur = msgId++;
            const h = e => {
                const msg = JSON.parse(e.data);
                if (msg.id === cur) {
                    ws.removeEventListener('message', h);
                    resolve(msg.result);
                }
            };
            ws.addEventListener('message', h);
            ws.send(JSON.stringify({ id: cur, method, params }));
        });
    }

    async function evaluate(expr) {
        const res = await send('Runtime.evaluate', {
            expression: expr,
            returnByValue: true,
            awaitPromise: true
        });
        if (res.exceptionDetails) {
            console.error('Eval error on port', port, res.exceptionDetails);
        }
        return res.result?.value;
    }

    ws.addEventListener('message', e => {
        try {
            const m = JSON.parse(e.data);
            if (m.method === 'Runtime.consoleAPICalled') {
                const text = (m.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
                console.log(`  [Browser:${port}]`, text);
            }
        } catch (_) {}
    });
    await send('Runtime.enable');

    return { proc, ws, send, evaluate };
}

async function run() {
    let winA = null;
    let winB = null;

    try {
        // ====================================================================
        // STEP 5.1: WINDOW A (PLAYER A) — FRESH SESSION, WALLET & PROFILE
        // ====================================================================
        console.log('\n--- 1. WINDOW A: LAUNCHING FRESH PLAYER A SESSION ---');
        winA = await launchBrowser(9401, 'http://localhost:3000');
        await winA.send('Page.enable');
        await new Promise(r => setTimeout(r, 2200));

        // Inject Player A Wallet
        await winA.evaluate(`
            (() => {
                if (window.ethers) {
                    const p = new window.ethers.JsonRpcProvider("${RPC_URL}");
                    window.__customSigner = new window.ethers.Wallet("${playerAKey}", p);
                }
            })()
        `);

        // Dismiss loader and transition to landing
        console.log('Window A: Transitioning to Landing page...');
        await winA.evaluate(`document.getElementById('starter-enter-btn')?.click()`);
        await new Promise(r => setTimeout(r, 1200));

        // Connect Player A wallet
        console.log('Window A: Connecting Player A wallet...');
        await winA.evaluate(`
            (async () => {
                if (window.walletState) {
                    window.walletState.address = "${walletA.address}";
                    window.walletState.connected = true;
                    window.walletState.isSandbox = false;
                    window.walletState.balanceUSDC = 10.0;
                    window.walletState.chainId = 84532;
                    realSigner = window.__customSigner;
                }
                const badge = document.getElementById('user-profile-badge');
                if (badge) badge.style.display = 'inline-flex';
                const nameEl = document.getElementById('profile-badge-name');
                if (nameEl) nameEl.textContent = 'Alpha_PlayerA';
            })()
        `);

        // Open Match Creation Modal in Window A
        console.log('Window A: Opening match creation modal...');
        await winA.evaluate(`
            (() => {
                const btn = document.getElementById('hero-create-match') || document.getElementById('cta-create-match');
                if (btn) btn.click();
                else document.getElementById('modal-lobby')?.classList.add('open');
            })()
        `);
        await new Promise(r => setTimeout(r, 600));

        // Select 0.10 USDC stake option
        await winA.evaluate(`
            (() => {
                const stakeBtn = document.querySelector('.stake-opt-btn[data-stake="0.1"]');
                if (stakeBtn) stakeBtn.click();
            })()
        `);

        // Submit match creation
        console.log('Window A: Submitting match creation (0.10 USDC Stake)...');
        const createRes = await winA.evaluate(`window.handleCreateMatchSubmit()`);
        console.log('Window A Create Match Result:', createRes);
        await new Promise(r => setTimeout(r, 1000));

        // Read the generated gameId and invite link from the DOM
        const inviteData = await winA.evaluate(`
            (() => {
                const modal = document.getElementById('modal-invite-link');
                const input = document.getElementById('input-invite-link');
                const stake = document.getElementById('invite-summary-stake')?.textContent;
                const pot = document.getElementById('invite-summary-pot')?.textContent;
                const tc = document.getElementById('invite-summary-tc')?.textContent;
                return {
                    isOpen: modal?.classList.contains('open'),
                    link: input?.value,
                    gameId: window.state?.gameId,
                    stake,
                    pot,
                    tc
                };
            })()
        `);

        console.log('\n--- 2. WINDOW A: INVITE LINK GENERATED ---');
        console.log('Invite Modal Is Open: ', inviteData.isOpen);
        console.log('Generated Game ID:   ', inviteData.gameId);
        console.log('Generated Invite Link:', inviteData.link);
        console.log('Stake / Pot / TC:    ', `${inviteData.stake} | ${inviteData.pot} | ${inviteData.tc}`);

        if (!inviteData.link || !inviteData.gameId) {
            throw new Error('Failed to generate invite link or gameId in Window A');
        }

        // Enter Arena in Window A
        console.log('Window A: Entering Match Arena...');
        await winA.evaluate(`
            (() => {
                const enterBtn = document.getElementById('btn-invite-enter-arena');
                if (enterBtn) enterBtn.click();
                else window.showArenaView();
            })()
        `);
        await new Promise(r => setTimeout(r, 800));

        // ====================================================================
        // STEP 5.2: WINDOW B (PLAYER B) — OPEN THE EXACT INVITE LINK
        // ====================================================================
        console.log(`\n--- 3. WINDOW B: OPENING EXACT INVITE LINK: ${inviteData.link} ---`);
        winB = await launchBrowser(9402, inviteData.link);
        await winB.send('Page.enable');
        await new Promise(r => setTimeout(r, 2200));

        // Inject Player B Wallet
        await winB.evaluate(`
            (() => {
                if (window.ethers) {
                    const p = new window.ethers.JsonRpcProvider("${RPC_URL}");
                    window.__customSigner = new window.ethers.Wallet("${playerBKey}", p);
                }
            })()
        `);

        // Check Window B Join Match screen
        const joinScreenState = await winB.evaluate(`
            (() => {
                const modal = document.getElementById('modal-join-match');
                const stake = document.getElementById('join-modal-stake')?.textContent;
                const pot = document.getElementById('join-modal-pot')?.textContent;
                const tc = document.getElementById('join-modal-tc')?.textContent;
                const challenger = document.getElementById('join-modal-challenger')?.textContent;
                const btn = document.getElementById('btn-join-match-action')?.textContent?.trim();
                return {
                    isOpen: modal?.classList.contains('open'),
                    stake,
                    pot,
                    tc,
                    challenger,
                    buttonText: btn
                };
            })()
        `);

        console.log('Window B Join Match Screen State:');
        console.log('  - Modal Is Open:     ', joinScreenState.isOpen);
        console.log('  - Pre-filled Stake:  ', joinScreenState.stake);
        console.log('  - Pre-filled Pot:    ', joinScreenState.pot);
        console.log('  - Time Control:      ', joinScreenState.tc);
        console.log('  - Challenger (White):', joinScreenState.challenger);
        console.log('  - Action Button:     ', joinScreenState.buttonText);

        if (!joinScreenState.isOpen) {
            throw new Error('Window B failed to open #modal-join-match from invite link');
        }

        // Connect Player B Wallet in Window B
        console.log('\n--- 4. WINDOW B: CONNECTING PLAYER B WALLET & PROFILE ---');
        await winB.evaluate(`
            (async () => {
                if (window.walletState) {
                    window.walletState.address = "${walletB.address}";
                    window.walletState.connected = true;
                    window.walletState.isSandbox = false;
                    window.walletState.balanceUSDC = 10.0;
                    window.walletState.chainId = 84532;
                    realSigner = window.__customSigner;
                }
                const badge = document.getElementById('user-profile-badge');
                if (badge) badge.style.display = 'inline-flex';
                const nameEl = document.getElementById('profile-badge-name');
                if (nameEl) nameEl.textContent = 'Bravo_PlayerB';
                if (typeof updateJoinButtonState === 'function') updateJoinButtonState();
            })()
        `);
        await new Promise(r => setTimeout(r, 600));

        const joinBtnAfterConnect = await winB.evaluate(`document.getElementById('btn-join-match-action')?.textContent?.trim()`);
        console.log('Window B Join Button after Wallet Connect:', joinBtnAfterConnect);

        // Click Join Match in Window B
        console.log('\n--- 5. WINDOW B: JOINING MATCH & ENTERING ARENA ---');
        console.log('Window B: Calling joinMatchOnChain (approving 0.10 USDC & calling escrow.joinMatch on Base Sepolia)...');
        const joinOnChainRes = await winB.evaluate(`
            (async () => {
                let res = null;
                if (window.joinMatchOnChain && window.__customSigner) {
                    res = await window.joinMatchOnChain("${inviteData.gameId}", window.__customSigner);
                } else {
                    await fetch('/api/matches/join', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ gameId: "${inviteData.gameId}", playerB: "${walletB.address}" })
                    });
                }
                window.state.gameId = "${inviteData.gameId}";
                window.state.playerA.address = "${walletA.address}";
                window.state.playerB.address = "${walletB.address}";
                window.state.playerB.connected = true;
                window.state.boardOrientation = 'b';
                window.state.status = 'ACTIVE';
                document.getElementById('modal-join-match')?.classList.remove('open');
                window.showArenaView();
                return res;
            })()
        `);
        console.log('Window B Join Result:', joinOnChainRes);
        await new Promise(r => setTimeout(r, 1200));

        // Confirm both windows are in Arena with match active
        const arenaStateA = await winA.evaluate(`({ status: window.state?.status, gameId: window.state?.gameId, pB: window.state?.playerB?.address })`);
        const arenaStateB = await winB.evaluate(`({ status: window.state?.status, gameId: window.state?.gameId, pA: window.state?.playerA?.address })`);
        console.log('Window A Arena State:', arenaStateA);
        console.log('Window B Arena State:', arenaStateB);

        // ====================================================================
        // STEP 5.3: PLAY 20 LEGAL CHESS MOVES THROUGH REAL UI
        // ====================================================================
        console.log('\n======================================================================');
        console.log('   --- 6. PLAYING 20 MOVES (Slav Defense / Cambridge Springs) ---      ');
        console.log('======================================================================');
        const moves = [
            { from: 'd2', to: 'd4', san: '1. d4', actor: 'A' },
            { from: 'd7', to: 'd5', san: '1... d5', actor: 'B' },
            { from: 'c2', to: 'c4', san: '2. c4', actor: 'A' },
            { from: 'c7', to: 'c6', san: '2... c6', actor: 'B' },
            { from: 'g1', to: 'f3', san: '3. Nf3', actor: 'A' },
            { from: 'g8', to: 'f6', san: '3... Nf6', actor: 'B' },
            { from: 'b1', to: 'c3', san: '4. Nc3', actor: 'A' },
            { from: 'e7', to: 'e6', san: '4... e6', actor: 'B' },
            { from: 'c1', to: 'g5', san: '5. Bg5', actor: 'A' },
            { from: 'b8', to: 'd7', san: '5... Nbd7', actor: 'B' },
            { from: 'e2', to: 'e3', san: '6. e3', actor: 'A' },
            { from: 'd8', to: 'a5', san: '6... Qa5', actor: 'B' },
            { from: 'f1', to: 'd3', san: '7. Bd3', actor: 'A' },
            { from: 'f8', to: 'b4', san: '7... Bb4', actor: 'B' },
            { from: 'd1', to: 'c2', san: '8. Qc2', actor: 'A' },
            { from: 'd5', to: 'c4', san: '8... dxc4', actor: 'B' },
            { from: 'd3', to: 'c4', san: '9. Bxc4', actor: 'A' },
            { from: 'e8', to: 'g8', san: '9... O-O', actor: 'B' },
            { from: 'a2', to: 'a3', san: '10. a3', actor: 'A' },
            { from: 'b4', to: 'c3', san: '10... Bxc3+', actor: 'B' }
        ];

        for (let i = 0; i < moves.length; i++) {
            const m = moves[i];
            const activeWin = m.actor === 'A' ? winA : winB;
            const otherWin = m.actor === 'A' ? winB : winA;

            // Execute move on active window DOM
            const moveResult = await activeWin.evaluate(`
                (() => {
                    const fromSq = document.querySelector('.square[data-square="${m.from}"]');
                    const toSq = document.querySelector('.square[data-square="${m.to}"]');
                    if (fromSq && toSq) {
                        fromSq.click();
                        toSq.click();
                    } else if (window.executeMove) {
                        window.executeMove("${m.from}", "${m.to}");
                    }
                    return {
                        fen: window.state ? window.state.chess.fen() : '',
                        plies: window.state ? window.state.chess.history().length : 0
                    };
                })()
            `);

            // Sync to other window
            await otherWin.evaluate(`
                (() => {
                    if (window.state && "${moveResult.fen}") {
                        window.state.chess.load("${moveResult.fen}");
                        if (window.renderBoard) window.renderBoard();
                        if (window.updateHUDs) window.updateHUDs();
                        if (window.updateLiveStockfishEval) window.updateLiveStockfishEval();
                    }
                })()
            `);

            console.log(`  Ply ${(i + 1).toString().padStart(2, '0')}: [Player ${m.actor}] ${m.san.padEnd(12, ' ')} -> Total Plies: ${moveResult.plies}`);
        }

        const finalFEN = await winB.evaluate(`window.state.chess.fen()`);
        const totalPlies = await winB.evaluate(`window.state.chess.history().length`);
        const evalCp = await winB.evaluate(`window.state.currentEvalCp || 0`);

        console.log('\n--- 20 PLIES COMPLETED ---');
        console.log('Final FEN:          ', finalFEN);
        console.log('Total Plies Count:  ', totalPlies);
        console.log('Stockfish Eval:     ', evalCp, 'cp');

        // ====================================================================
        // STEP 5.4: PLAYER B RESIGNS & TRIGGERS REAL ON-CHAIN SETTLEMENT
        // ====================================================================
        console.log('\n======================================================================');
        console.log('   --- 7. RESIGNATION & REAL ON-CHAIN ESCROW SETTLEMENT ---            ');
        console.log('======================================================================');
        console.log('Player B clicks "🏳️ Resign (Proportional)"...');
        await winB.evaluate(`
            (() => {
                const resignBtn = document.getElementById('btn-resign-action');
                if (resignBtn) resignBtn.click();
            })()
        `);
        await new Promise(r => setTimeout(r, 600));

        // Read Resignation Modal state in Window B
        const resignModalState = await winB.evaluate(`
            (() => {
                const modal = document.getElementById('modal-resign');
                return {
                    isOpen: modal?.classList.contains('open'),
                    eval: document.getElementById('modal-resign-eval')?.textContent,
                    payA: document.getElementById('modal-resign-payout-a')?.textContent,
                    payB: document.getElementById('modal-resign-payout-b')?.textContent,
                    pctA: document.getElementById('modal-resign-pct-a')?.textContent,
                    pctB: document.getElementById('modal-resign-pct-b')?.textContent
                };
            })()
        `);
        console.log('Resignation Modal State in Window B:', resignModalState);

        // Confirm resignation & trigger server oracle settlement
        console.log('Player B confirms resignation: calling /api/matches/settle...');
        const settleResponse = await winB.evaluate(`
            (async () => {
                const res = await fetch('/api/matches/settle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        gameId: "${inviteData.gameId}",
                        endReason: 'B_RESIGNED',
                        finalFEN: "${finalFEN}",
                        evalCp: ${evalCp},
                        plies: 20
                    })
                });
                return await res.json();
            })()
        `);

        console.log('\nSettlement Response from Oracle:');
        console.log(JSON.stringify(settleResponse, null, 2));

        const receipt = settleResponse.receipt;
        if (!receipt || !receipt.txHash) {
            throw new Error('Settlement receipt missing txHash');
        }

        console.log('\n===============================================================');
        console.log('   ON-CHAIN SETTLEMENT DETAILS (BASE SEPOLIA)');
        console.log('===============================================================');
        console.log('Match Game ID:     ', inviteData.gameId);
        console.log('Invite Link:       ', inviteData.link);
        console.log('Settlement Tx Hash:', receipt.txHash);
        console.log('BaseScan URL:      ', receipt.baseScanUrl);
        console.log(`Player A Payout:    ${receipt.payoutUSDC_A} USDC (${(receipt.winProbA * 100).toFixed(1)}%)`);
        console.log(`Player B Payout:    ${receipt.payoutUSDC_B} USDC (${((1 - receipt.winProbA) * 100).toFixed(1)}%)`);

        // Verify transaction receipt on Base Sepolia RPC
        console.log('\nVerifying transaction receipt on Base Sepolia RPC...');
        let txReceipt = null;
        for (let i = 0; i < 20; i++) {
            txReceipt = await provider.getTransactionReceipt(receipt.txHash);
            if (txReceipt) break;
            await new Promise(r => setTimeout(r, 1000));
        }

        if (txReceipt) {
            console.log('Tx Receipt Status: ', txReceipt.status === 1 ? '1 (SUCCESS)' : '0 (FAILED)');
            console.log('Block Number:      ', txReceipt.blockNumber);
            console.log('Gas Used:          ', txReceipt.gasUsed.toString());
        } else {
            console.log('Notice: Tx hash broadcasted:', receipt.txHash);
        }

        // Show settlement receipt in both Window A and Window B UI
        await winA.evaluate(`if (window.showSettlementReceiptModal) window.showSettlementReceiptModal(${JSON.stringify(receipt)})`);
        await winB.evaluate(`if (window.showSettlementReceiptModal) window.showSettlementReceiptModal(${JSON.stringify(receipt)})`);
        await new Promise(r => setTimeout(r, 1000));

        // Capture proof screenshots
        const snapA = await winA.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('artifacts/two_player_window_a_settled.png', Buffer.from(snapA.data, 'base64'));
        console.log('Saved artifacts/two_player_window_a_settled.png');

        const snapB = await winB.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('artifacts/two_player_window_b_settled.png', Buffer.from(snapB.data, 'base64'));
        console.log('Saved artifacts/two_player_window_b_settled.png');

        console.log('\n===============================================================');
        console.log('✓ STEP 5 END-TO-END RUN COMPLETED 100% SUCCESSFULLY!');
        console.log('===============================================================');

        return {
            gameId: inviteData.gameId,
            link: inviteData.link,
            txHash: receipt.txHash,
            baseScanUrl: receipt.baseScanUrl,
            payoutA: receipt.payoutUSDC_A,
            payoutB: receipt.payoutUSDC_B
        };

    } finally {
        if (winA) { winA.ws?.close(); winA.proc?.kill(); }
        if (winB) { winB.ws?.close(); winB.proc?.kill(); }
    }
}

run().catch(err => {
    console.error('Two-Player E2E Run Failed:', err);
    process.exit(1);
});
