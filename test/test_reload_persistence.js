const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const { ethers } = require('ethers');

// .env loader
const env = {};
try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
            }
        });
    }
} catch (e) {}

const RPC_URL = env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
const USDC_ADDRESS = env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const ESCROW_ADDRESS = env.ESCROW_CONTRACT || '0x0451c13fadBF8Fd8A6f1311d5d125778FC2ca5C0';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const walletA = new ethers.Wallet(env.DEPLOYER_KEY, provider);
const walletB = new ethers.Wallet(env.PLAYER_B_KEY, provider);

console.log('======================================================================');
console.log('   CENTIPAWN — TWO-WINDOW RELOAD PERSISTENCE (F5 SURVIVAL) TEST       ');
console.log('======================================================================');
console.log('Player A (Creator):', walletA.address);
console.log('Player B (Joiner): ', walletB.address);

async function launchBrowser(port, url) {
    const udir = path.join(os.tmpdir(), 'centipawn_reload_test_' + port);
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
                const m = JSON.parse(e.data);
                if (m.id === cur) {
                    ws.removeEventListener('message', h);
                    resolve(m.result);
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

    await send('Runtime.enable');
    await send('Page.enable');

    return { proc, ws, send, evaluate };
}

async function run() {
    let winA = null;
    let winB = null;

    try {
        // --------------------------------------------------------------------
        // PHASE 1: WINDOW A CREATES MATCH & ENTER ARENA
        // --------------------------------------------------------------------
        console.log('\n--- 1. WINDOW A (CREATOR): STARTING SESSION ---');
        winA = await launchBrowser(9411, 'http://localhost:3000');
        await new Promise(r => setTimeout(r, 2000));

        // Connect Player A
        await winA.evaluate(`
            (() => {
                document.getElementById('starter-enter-btn')?.click();
                if (window.walletState) {
                    window.walletState.address = "${walletA.address}";
                    window.walletState.connected = true;
                    window.walletState.isSandbox = false;
                    window.walletState.balanceUSDC = 10.0;
                    window.walletState.chainId = 84532;
                    try { localStorage.setItem('centipawn_connected_address', "${walletA.address}"); } catch (_) {}
                }
                const badge = document.getElementById('user-profile-badge');
                if (badge) badge.style.display = 'inline-flex';
                const nameEl = document.getElementById('profile-badge-name');
                if (nameEl) nameEl.textContent = 'Alpha_PlayerA';
            })()
        `);
        await new Promise(r => setTimeout(r, 1000));

        // Create match on server (fast setup for reload test)
        const gameId = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        console.log('Creating match with ID:', gameId);

        await winA.evaluate(`
            (async () => {
                window.state.gameId = "${gameId}";
                window.state.stakeAmount = 0.10;
                window.state.timeControlIdx = 1;
                window.state.playerA.address = "${walletA.address}";
                window.state.boardOrientation = 'w';
                window.state.status = 'ACTIVE';

                await fetch('/api/matches/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        gameId: "${gameId}",
                        stakeAmount: 0.10,
                        timeControl: 1,
                        playerA: "${walletA.address}"
                    })
                });

                window.showArenaView();
            })()
        `);
        await new Promise(r => setTimeout(r, 1000));

        const winAPath = await winA.evaluate(`window.location.pathname`);
        console.log('Window A URL pathname after entering Arena:', winAPath);
        const inviteLink = `http://localhost:3000/match/${gameId}`;

        // --------------------------------------------------------------------
        // PHASE 2: WINDOW B (JOINER) OPENS INVITE LINK & JOINS MATCH
        // --------------------------------------------------------------------
        console.log(`\n--- 2. WINDOW B (JOINER): OPENING INVITE LINK ${inviteLink} ---`);
        winB = await launchBrowser(9412, inviteLink);
        await new Promise(r => setTimeout(r, 2500));

        // Connect Player B and Join Match
        console.log('Window B: Connecting Player B wallet and joining match...');
        await winB.evaluate(`
            (async () => {
                if (window.walletState) {
                    window.walletState.address = "${walletB.address}";
                    window.walletState.connected = true;
                    window.walletState.isSandbox = false;
                    window.walletState.balanceUSDC = 10.0;
                    window.walletState.chainId = 84532;
                    try { localStorage.setItem('centipawn_connected_address', "${walletB.address}"); } catch (_) {}
                }
                const badge = document.getElementById('user-profile-badge');
                if (badge) badge.style.display = 'inline-flex';
                const nameEl = document.getElementById('profile-badge-name');
                if (nameEl) nameEl.textContent = 'Bravo_PlayerB';

                await fetch('/api/matches/join', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gameId: "${gameId}", playerB: "${walletB.address}" })
                });

                window.state.gameId = "${gameId}";
                window.state.playerA.address = "${walletA.address}";
                window.state.playerB.address = "${walletB.address}";
                window.state.playerB.connected = true;
                window.state.boardOrientation = 'b';
                window.state.status = 'ACTIVE';

                document.getElementById('modal-join-match')?.classList.remove('open');
                window.showArenaView();
            })()
        `);
        await new Promise(r => setTimeout(r, 1200));

        // Play 4 moves to establish unique board position
        // 1. d4 d5 2. c4 c6 (Slav Defense)
        const testFen = 'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3';
        console.log('\n--- 3. PLAYING MOVES TO ESTABLISH UNIQUE FEN ---');
        console.log('Position: 1. d4 d5 2. c4 c6');
        console.log('Target FEN:', testFen);

        await winA.evaluate(`
            (async () => {
                window.state.chess.load("${testFen}");
                window.renderBoard();
                window.updateHUDs();
                await fetch('/api/matches/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gameId: "${gameId}", fen: "${testFen}", plies: 4 })
                });
            })()
        `);
        await winB.evaluate(`
            (() => {
                window.state.chess.load("${testFen}");
                window.renderBoard();
                window.updateHUDs();
            })()
        `);
        await new Promise(r => setTimeout(r, 1000));

        // --------------------------------------------------------------------
        // TEST 1: JOINING PLAYER (WINDOW B) FULL PAGE RELOAD (F5)
        // --------------------------------------------------------------------
        console.log('\n======================================================================');
        console.log('   TEST 1: TESTING FULL PAGE RELOAD (F5) ON JOINING PLAYER (WINDOW B) ');
        console.log('======================================================================');
        console.log('Window B: Triggering Page.reload (F5)...');
        await winB.send('Page.reload');
        await new Promise(r => setTimeout(r, 3000));

        // Reconnect wallet in Window B (standard Web3 wallet provider behavior upon refresh)
        await winB.evaluate(`
            (() => {
                if (window.walletState) {
                    window.walletState.address = "${walletB.address}";
                    window.walletState.connected = true;
                    window.walletState.isSandbox = false;
                    window.walletState.balanceUSDC = 10.0;
                    window.walletState.chainId = 84532;
                }
                if (typeof syncLandingPageUI === 'function') syncLandingPageUI();
            })()
        `);
        await new Promise(r => setTimeout(r, 1000));

        // Inspect Window B state after reload
        const bAfterReload = await winB.evaluate(`
            (() => {
                const landing = document.getElementById('landing-page');
                const arena = document.getElementById('arena-container');
                const joinModal = document.getElementById('modal-join-match');
                return {
                    pathname: window.location.pathname,
                    landingDisplay: window.getComputedStyle(landing).display,
                    arenaDisplay: window.getComputedStyle(arena).display,
                    arenaActive: arena.classList.contains('active'),
                    joinModalOpen: joinModal?.classList.contains('open'),
                    gameId: window.state?.gameId,
                    status: window.state?.status,
                    fen: window.state?.chess?.fen(),
                    boardOrientation: window.state?.boardOrientation,
                    playerA: window.state?.playerA?.address,
                    playerB: window.state?.playerB?.address,
                    squaresRendered: document.querySelectorAll('.square').length
                };
            })()
        `);

        console.log('Window B (Joiner) State After F5 Reload:');
        console.log('  - Pathname:          ', bAfterReload.pathname);
        console.log('  - Landing Display:   ', bAfterReload.landingDisplay, '(Expected: none)');
        console.log('  - Arena Display:     ', bAfterReload.arenaDisplay, '(Expected: flex)');
        console.log('  - Arena Active:      ', bAfterReload.arenaActive, '(Expected: true)');
        console.log('  - Join Modal Open:   ', bAfterReload.joinModalOpen, '(Expected: false)');
        console.log('  - Game ID:           ', bAfterReload.gameId);
        console.log('  - Status:            ', bAfterReload.status, '(Expected: ACTIVE)');
        console.log('  - Restored FEN:      ', bAfterReload.fen);
        console.log('  - Board Orientation: ', bAfterReload.boardOrientation, '(Expected: b for Black/Joiner)');
        console.log('  - Player A (White):  ', bAfterReload.playerA);
        console.log('  - Player B (Black):  ', bAfterReload.playerB);
        console.log('  - Squares Rendered:  ', bAfterReload.squaresRendered, '(Expected: 64)');

        const passTest1 = (
            bAfterReload.pathname.includes(gameId) &&
            bAfterReload.landingDisplay === 'none' &&
            bAfterReload.arenaDisplay === 'flex' &&
            !bAfterReload.joinModalOpen &&
            bAfterReload.gameId === gameId &&
            bAfterReload.status === 'ACTIVE' &&
            bAfterReload.fen === testFen &&
            bAfterReload.boardOrientation === 'b' &&
            bAfterReload.playerA.toLowerCase() === walletA.address.toLowerCase() &&
            bAfterReload.playerB.toLowerCase() === walletB.address.toLowerCase() &&
            bAfterReload.squaresRendered === 64
        );

        console.log(`\nTEST 1 RESULT: ${passTest1 ? '✓ PASS' : '✗ FAIL'}`);

        // --------------------------------------------------------------------
        // TEST 2: MATCH CREATOR (WINDOW A) FULL PAGE RELOAD (F5)
        // --------------------------------------------------------------------
        console.log('\n======================================================================');
        console.log('   TEST 2: TESTING FULL PAGE RELOAD (F5) ON MATCH CREATOR (WINDOW A)  ');
        console.log('======================================================================');
        console.log('Window A: Triggering Page.reload (F5)...');
        await winA.send('Page.reload');
        await new Promise(r => setTimeout(r, 3000));

        // Reconnect wallet in Window A
        await winA.evaluate(`
            (() => {
                if (window.walletState) {
                    window.walletState.address = "${walletA.address}";
                    window.walletState.connected = true;
                    window.walletState.isSandbox = false;
                    window.walletState.balanceUSDC = 10.0;
                    window.walletState.chainId = 84532;
                }
                if (typeof syncLandingPageUI === 'function') syncLandingPageUI();
            })()
        `);
        await new Promise(r => setTimeout(r, 1000));

        // Inspect Window A state after reload
        const aAfterReload = await winA.evaluate(`
            (() => {
                const landing = document.getElementById('landing-page');
                const arena = document.getElementById('arena-container');
                const joinModal = document.getElementById('modal-join-match');
                return {
                    pathname: window.location.pathname,
                    landingDisplay: window.getComputedStyle(landing).display,
                    arenaDisplay: window.getComputedStyle(arena).display,
                    arenaActive: arena.classList.contains('active'),
                    joinModalOpen: joinModal?.classList.contains('open'),
                    gameId: window.state?.gameId,
                    status: window.state?.status,
                    fen: window.state?.chess?.fen(),
                    boardOrientation: window.state?.boardOrientation,
                    playerA: window.state?.playerA?.address,
                    playerB: window.state?.playerB?.address,
                    squaresRendered: document.querySelectorAll('.square').length
                };
            })()
        `);

        console.log('Window A (Creator) State After F5 Reload:');
        console.log('  - Pathname:          ', aAfterReload.pathname);
        console.log('  - Landing Display:   ', aAfterReload.landingDisplay, '(Expected: none)');
        console.log('  - Arena Display:     ', aAfterReload.arenaDisplay, '(Expected: flex)');
        console.log('  - Arena Active:      ', aAfterReload.arenaActive, '(Expected: true)');
        console.log('  - Join Modal Open:   ', aAfterReload.joinModalOpen, '(Expected: false)');
        console.log('  - Game ID:           ', aAfterReload.gameId);
        console.log('  - Status:            ', aAfterReload.status, '(Expected: ACTIVE)');
        console.log('  - Restored FEN:      ', aAfterReload.fen);
        console.log('  - Board Orientation: ', aAfterReload.boardOrientation, '(Expected: w for White/Creator)');
        console.log('  - Player A (White):  ', aAfterReload.playerA);
        console.log('  - Player B (Black):  ', aAfterReload.playerB);
        console.log('  - Squares Rendered:  ', aAfterReload.squaresRendered, '(Expected: 64)');

        const passTest2 = (
            aAfterReload.pathname.includes(gameId) &&
            aAfterReload.landingDisplay === 'none' &&
            aAfterReload.arenaDisplay === 'flex' &&
            !aAfterReload.joinModalOpen &&
            aAfterReload.gameId === gameId &&
            aAfterReload.status === 'ACTIVE' &&
            aAfterReload.fen === testFen &&
            aAfterReload.boardOrientation === 'w' &&
            aAfterReload.playerA.toLowerCase() === walletA.address.toLowerCase() &&
            aAfterReload.playerB.toLowerCase() === walletB.address.toLowerCase() &&
            aAfterReload.squaresRendered === 64
        );

        console.log(`\nTEST 2 RESULT: ${passTest2 ? '✓ PASS' : '✗ FAIL'}`);

        // --------------------------------------------------------------------
        // TEST 3: VERIFY SERVER HEALTH VIA GET /api/status
        // --------------------------------------------------------------------
        console.log('\n======================================================================');
        console.log('   TEST 3: CHECKING LOCAL SERVER HEALTH (GET /api/status)              ');
        console.log('======================================================================');
        const statusData = await new Promise((resolve, reject) => {
            http.get('http://localhost:3000/api/status', res => {
                let d = ''; res.on('data', c => d += c);
                res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(d) }));
            }).on('error', reject);
        });

        console.log('Status HTTP Code:  ', statusData.statusCode);
        console.log('Server Status:     ', statusData.body.status);
        console.log('Oracle Signer:     ', statusData.body.oracleAddress);
        console.log('Escrow Contract:   ', statusData.body.escrowContract);
        console.log('Active Matches:    ', statusData.body.activeMatchesCount);

        const passTest3 = statusData.statusCode === 200 && statusData.body.status === 'ok';
        console.log(`\nTEST 3 RESULT: ${passTest3 ? '✓ PASS' : '✗ FAIL'}`);

        console.log('\n======================================================================');
        console.log('                      OVERALL SUITE SUMMARY                           ');
        console.log('======================================================================');
        console.log(`1. Joining Player (Window B) Reload Persistence: ${passTest1 ? 'PASSED (100%)' : 'FAILED'}`);
        console.log(`2. Match Creator (Window A) Reload Persistence:  ${passTest2 ? 'PASSED (100%)' : 'FAILED'}`);
        console.log(`3. Server Daemon Health (GET /api/status):       ${passTest3 ? 'PASSED (100%)' : 'FAILED'}`);
        console.log('======================================================================\n');

        if (!passTest1 || !passTest2 || !passTest3) {
            process.exit(1);
        }

    } finally {
        if (winA) { winA.ws?.close(); winA.proc?.kill(); }
        if (winB) { winB.ws?.close(); winB.proc?.kill(); }
    }
}

run().catch(err => {
    console.error('Reload persistence test failed:', err);
    process.exit(1);
});
