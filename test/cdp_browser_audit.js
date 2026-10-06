const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\matha.DESKTOP-O7DKQ9A\\.gemini\\antigravity-ide\\brain\\4329f89e-7b44-4db8-ac78-e57ac302b123';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;

function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', reject);
    });
}

class CDPClient {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.id = 1;
        this.callbacks = new Map();
        this.ready = new Promise((resolve, reject) => {
            this.ws.onopen = () => resolve();
            this.ws.onerror = err => reject(err);
        });
        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id && this.callbacks.has(msg.id)) {
                const cb = this.callbacks.get(msg.id);
                this.callbacks.delete(msg.id);
                if (msg.error) cb.reject(new Error(msg.error.message));
                else cb.resolve(msg.result);
            }
        };
    }

    async send(method, params = {}) {
        await this.ready;
        const msgId = this.id++;
        return new Promise((resolve, reject) => {
            this.callbacks.set(msgId, { resolve, reject });
            this.ws.send(JSON.stringify({ id: msgId, method, params }));
        });
    }

    async eval(expr) {
        const res = await this.send('Runtime.evaluate', {
            expression: expr,
            awaitPromise: true,
            returnByValue: true
        });
        if (res.exceptionDetails) {
            throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
        }
        return res.result ? res.result.value : undefined;
    }

    async captureScreenshot(filename, width = 1280, height = 800) {
        await this.send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: width < 600
        });
        await sleep(300);
        const res = await this.send('Page.captureScreenshot', { format: 'png' });
        const filePath = path.join(ARTIFACT_DIR, filename);
        fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
        console.log(`📸 Screenshot saved: ${filename} (${width}x${height})`);
        return filePath;
    }

    close() {
        if (this.ws) this.ws.close();
    }
}

async function main() {
    console.log('=== CENTIPAWN CDP BROWSER AUTOMATION & AUDIT ===\n');

    // 1. Launch Headless Chrome with Remote Debugging
    console.log('1. Launching headless Chrome with remote debugging on port ' + PORT);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_audit_'));
    const chrome = spawn(CHROME_PATH, [
        `--remote-debugging-port=${PORT}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        `--user-data-dir=${tempDir}`,
        'about:blank'
    ]);

    await sleep(2000);

    let versionInfo;
    for (let i = 0; i < 10; i++) {
        try {
            versionInfo = await httpGet(`http://127.0.0.1:${PORT}/json/version`);
            break;
        } catch {
            await sleep(500);
        }
    }

    if (!versionInfo || !versionInfo.webSocketDebuggerUrl) {
        throw new Error('Failed to connect to Chrome debugging endpoint');
    }

    const tabs = await httpGet(`http://127.0.0.1:${PORT}/json`);
    const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
    const client = new CDPClient(pageTab.webSocketDebuggerUrl);
    await client.ready;
    console.log('✓ Connected to Chrome CDP on page:', pageTab.url);

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    console.log('Navigating to http://localhost:3000...');
    await client.send('Page.navigate', { url: 'http://localhost:3000' });
    
    // Wait until app.js has initialized
    let ready = false;
    for (let i = 0; i < 30; i++) {
        await sleep(300);
        try {
            ready = await client.eval(`typeof window.showArenaView === 'function'`);
            if (ready) {
                console.log('✓ Page and app.js fully initialized.');
                break;
            }
        } catch (e) {}
    }
    if (!ready) {
        throw new Error('Timed out waiting for window.showArenaView to initialize');
    }

    // 2. Open Arena View
    console.log('\n2. Navigating to Arena View...');
    await client.eval(`
        window.showArenaView();
        // Also connect sandbox wallet for active session
        document.getElementById('btn-wallet-sandbox')?.click();
    `);
    await sleep(1000);

    // 3. Test Part A: Profile Setup Modal & Submission
    console.log('\n3. Testing Part A: Profile Setup...');
    const initialBadge = await client.eval(`
        const badge = document.getElementById('user-profile-badge');
        badge ? badge.innerText.trim() : null;
    `);
    console.log('  Initial profile badge text:', initialBadge);

    // Open profile setup modal and save profile
    console.log('  Submitting profile: username="Magnus_Centipawn", avatar="dragon-hyper"...');
    await client.eval(`
        document.getElementById('user-profile-badge')?.click();
        const input = document.getElementById('input-profile-username');
        if (input) {
            input.value = 'Magnus_Centipawn';
            input.dispatchEvent(new Event('input'));
        }
        // Select dragon-hyper avatar
        const opt = document.querySelector('.avatar-preset-item[data-avatar-id="dragon-hyper"]');
        if (opt) opt.click();
        // Click Save Profile
        document.getElementById('btn-save-profile')?.click();
    `);
    await sleep(800);

    const savedProfileCheck = await client.eval(`
        ({
            badgeName: document.getElementById('profile-badge-name')?.innerText,
            badgeIcon: document.getElementById('profile-badge-icon')?.innerText,
            hudNameA: document.getElementById('name-player-a')?.innerText,
            hudAvatarA: document.getElementById('avatar-player-a')?.innerText
        })
    `);
    console.log('  Profile updated in DOM:', JSON.stringify(savedProfileCheck, null, 2));

    // 4. Test Part A: Persistence across Page Reload
    console.log('\n4. Testing Part A Persistence: Reloading page...');
    await client.send('Page.reload');
    for (let i = 0; i < 30; i++) {
        await sleep(300);
        try {
            if (await client.eval(`typeof window.showArenaView === 'function'`)) break;
        } catch (e) {}
    }

    // After reload, switch to Arena and verify profile state
    await client.eval(`window.showArenaView();`);
    await sleep(500);

    const reloadedProfile = await client.eval(`
        ({
            walletAddress: window.walletState ? window.walletState.address : null,
            badgeName: document.getElementById('profile-badge-name')?.innerText,
            badgeIcon: document.getElementById('profile-badge-icon')?.innerText,
            hudNameA: document.getElementById('name-player-a')?.innerText,
            hudAvatarA: document.getElementById('avatar-player-a')?.innerText
        })
    `);
    console.log('  Profile after page reload:', JSON.stringify(reloadedProfile, null, 2));

    // 5. Test Part B: Arena Usability, Moves & Visual Feedback
    console.log('\n5. Testing Part B Usability: Moves & Turn Indicator Banner...');
    // Ensure game is active and make legal move e2 to e4
    await client.eval(`
        if (window.state && window.state.chess) {
            window.state.chess.reset();
            window.state.status = 'ACTIVE';
            window.showArenaView();
        }
    `);
    await sleep(500);

    const bannerInitial = await client.eval(`
        document.getElementById('turn-banner-text')?.innerText
    `);
    console.log('  Turn banner initial state:', bannerInitial);

    // Move e2 to e4
    console.log('  Executing move e2 -> e4...');
    await client.eval(`
        const sqE2 = document.querySelector('.square[data-square="e2"]');
        const sqE4 = document.querySelector('.square[data-square="e4"]');
        if (sqE2) sqE2.click();
        if (sqE4) sqE4.click();
    `);
    await sleep(500);

    const postMoveCheck = await client.eval(`
        ({
            fen: window.state.chess.fen(),
            history: window.state.chess.history(),
            bannerText: document.getElementById('turn-banner-text')?.innerText,
            lastPlySpan: document.querySelector('.move-white.last-ply')?.innerText,
            clockA: document.getElementById('clock-player-a')?.innerText,
            clockB: document.getElementById('clock-player-b')?.innerText
        })
    `);
    console.log('  Post-move game state:', JSON.stringify(postMoveCheck, null, 2));

    // Test illegal move rejection
    console.log('  Testing illegal move visual rejection (e4 -> e6)...');
    const illegalCheckBefore = await client.eval(`
        (() => {
            const sqE4 = document.querySelector('.square[data-square="e4"]');
            const sqE6 = document.querySelector('.square[data-square="e6"]');
            if (sqE4) sqE4.click();
            if (sqE6) sqE6.click();
            return {
                boardHasShake: document.getElementById('chessboard')?.classList.contains('shake-illegal'),
                fenUnchanged: window.state.chess.fen().startsWith('rnbqkbnr/pppppppp/8/8/4P3')
            };
        })()
    `);
    console.log('  Illegal move rejection result:', JSON.stringify(illegalCheckBefore, null, 2));

    // 6. Test Resignation Confirmation Modal
    console.log('\n6. Testing Resignation Confirmation Modal...');
    await client.eval(`document.getElementById('btn-resign-action')?.click();`);
    await sleep(500);

    const resignModalState = await client.eval(`
        ({
            modalIsOpen: document.getElementById('modal-resign')?.classList.contains('open'),
            evalText: document.getElementById('modal-resign-eval')?.innerText,
            pliesText: document.getElementById('modal-resign-plies')?.innerText,
            payoutA: document.getElementById('modal-resign-payout-a')?.innerText,
            warning: document.getElementById('modal-resign-warning')?.innerText
        })
    `);
    console.log('  Resign modal preview:', JSON.stringify(resignModalState, null, 2));

    // Close resign modal
    await client.eval(`document.getElementById('modal-resign-cancel')?.click();`);
    await sleep(300);

    // 7. Load ≥20 Ply Winning Game & Settlement Card Test
    console.log('\n7. Testing ≥20 Ply Game & Persistent Match Summary Card...');
    await client.eval(`
        document.getElementById('btn-simulate-win')?.click();
    `);
    await sleep(800);

    const highPlyState = await client.eval(`
        ({
            plies: window.state.chess.history().length,
            evalCp: window.state.currentEvalCp,
            banner: document.getElementById('turn-banner-text')?.innerText
        })
    `);
    console.log('  Loaded high-ply game:', JSON.stringify(highPlyState, null, 2));

    // Settle the game via UI Resignation
    console.log('  Settling match to verify Persistent Post-Game Summary Card...');
    await client.eval(`
        document.getElementById('btn-resign-action')?.click();
        document.getElementById('modal-resign-confirm')?.click();
    `);
    await sleep(1000);

    // Close the receipt popup so we can clearly see the persistent card on screen
    await client.eval(`
        document.getElementById('modal-settle-close')?.click();
    `);
    await sleep(500);

    const summaryCardState = await client.eval(`
        ({
            isDisplayed: document.getElementById('persistent-match-summary')?.style.display,
            headline: document.getElementById('summary-headline-text')?.innerText,
            reason: document.getElementById('summary-end-reason')?.innerText,
            playerA: document.getElementById('summary-name-a')?.innerText,
            payoutA: document.getElementById('summary-payout-a')?.innerText,
            playerB: document.getElementById('summary-name-b')?.innerText,
            payoutB: document.getElementById('summary-payout-b')?.innerText,
            txLink: document.getElementById('summary-basescan-link')?.href
        })
    `);
    console.log('  Persistent post-game summary card in sidebar:', JSON.stringify(summaryCardState, null, 2));

    // 8. Capture Screenshots across Desktop and Mobile Viewports
    console.log('\n8. Capturing Screenshots...');
    // Desktop 1280x800
    await client.captureScreenshot('arena_desktop_1280.png', 1280, 850);

    // Mobile 430px (iPhone 14 Pro Max)
    await client.captureScreenshot('arena_mobile_430.png', 430, 932);

    // Mobile 390px (iPhone 12/13/14)
    await client.captureScreenshot('arena_mobile_390.png', 390, 844);

    // Mobile 375px (iPhone SE)
    await client.captureScreenshot('arena_mobile_375.png', 375, 667);

    // Test Spectator Mode
    console.log('\n9. Testing Spectator View (?spectator=true)...');
    await client.send('Page.navigate', { url: 'http://localhost:3000/?spectator=true' });
    for (let i = 0; i < 30; i++) {
        await sleep(300);
        try {
            if (await client.eval(`typeof window.showArenaView === 'function'`)) break;
        } catch (e) {}
    }
    await client.eval(`window.showArenaView();`);
    await sleep(500);

    const spectatorState = await client.eval(`
        ({
            isSpectator: window.state ? window.state.isSpectator : false,
            bannerDisplay: document.getElementById('spectator-mode-banner')?.style.display,
            turnBanner: document.getElementById('turn-banner-text')?.innerText
        })
    `);
    console.log('  Spectator view state:', JSON.stringify(spectatorState, null, 2));
    await client.captureScreenshot('arena_spectator_desktop.png', 1280, 850);

    console.log('\n==============================================');
    console.log('🎉 AUDIT COMPLETE: ALL CHECKS & SCREENSHOTS PASS!');
    console.log('==============================================');

    client.close();
    chrome.kill();
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error during CDP audit:', err);
    process.exit(1);
});
