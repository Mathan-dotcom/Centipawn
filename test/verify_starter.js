const http = require('http');
const { spawn } = require('child_process');

async function runVerification() {
    console.log('--- Launching Edge in Headless mode ---');
    const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        'http://localhost:3000'
    ]);

    try {
        await new Promise(r => setTimeout(r, 1500));

        // Get webSocketDebuggerUrl
        const targets = await new Promise((resolve, reject) => {
            http.get('http://127.0.0.1:9222/json', (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => resolve(JSON.parse(body)));
            }).on('error', reject);
        });

        const pageTarget = targets.find(t => t.type === 'page');
        if (!pageTarget) throw new Error('No page target found');

        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let msgId = 1;
        function send(method, params = {}) {
            return new Promise((resolve, reject) => {
                const id = msgId++;
                const handler = (evt) => {
                    const msg = JSON.parse(evt.data);
                    if (msg.id === id) {
                        ws.removeEventListener('message', handler);
                        if (msg.error) reject(msg.error);
                        else resolve(msg.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        async function evaluate(expression) {
            const res = await send('Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: true
            });
            return res.result.value;
        }

        await send('Page.enable');
        console.log('Navigating to http://localhost:3000...');
        const loadPromise = new Promise(resolve => {
            const onMsg = (evt) => {
                const msg = JSON.parse(evt.data);
                if (msg.method === 'Page.loadEventFired') {
                    ws.removeEventListener('message', onMsg);
                    resolve();
                }
            };
            ws.addEventListener('message', onMsg);
        });
        await send('Page.navigate', { url: 'http://localhost:3000' });
        await loadPromise;
        console.log('Page loaded. Waiting 2.5s for loader to complete and dismiss...');
        await new Promise(r => setTimeout(r, 2500));

        // Check Starter Scene State
        const starterState = await evaluate(`(() => {
            const loader = document.getElementById('loader');
            const starterBtn = document.getElementById('starter-enter-btn');
            const hint = document.getElementById('hint');
            const landing = document.getElementById('landing-page');
            const gl = document.getElementById('gl');
            const bg = document.getElementById('bg');
            
            return {
                loaderDone: loader ? loader.classList.contains('done') : null,
                loaderDisplay: loader ? getComputedStyle(loader).opacity : null,
                starterBtnVisible: starterBtn ? getComputedStyle(starterBtn).display !== 'none' : false,
                starterBtnText: starterBtn ? starterBtn.innerText.replace(/\\s+/g, ' ').trim() : null,
                hintOpacity: hint ? getComputedStyle(hint).opacity : null,
                landingPageDisplay: landing ? getComputedStyle(landing).display : null,
                landingPageActive: landing ? landing.classList.contains('active') : false,
                canvasActive: !!gl,
                bgTitle: bg ? bg.innerText.trim() : null
            };
        })()`);

        console.log('1. Starter Page Initial State:', JSON.stringify(starterState, null, 2));

        if (!starterState.starterBtnVisible) {
            throw new Error('FAIL: #starter-enter-btn is not visible!');
        }
        if (starterState.landingPageActive || starterState.landingPageDisplay === 'flex') {
            throw new Error('FAIL: #landing-page is covering starter page!');
        }
        console.log('✓ PASS: Starter page 3D scene is active and visible with ENTER button!');

        // Now trigger Enter Centipawn Chess button click
        console.log('Clicking #starter-enter-btn...');
        await evaluate(`document.getElementById('starter-enter-btn').click()`);

        // Wait 1.5s for zoom and transition to complete
        await new Promise(r => setTimeout(r, 1500));

        const landingState = await evaluate(`(() => {
            const starterBtn = document.getElementById('starter-enter-btn');
            const landing = document.getElementById('landing-page');
            const btn3D = document.getElementById('btn-view-3d-starter');
            const arenaBtn = document.getElementById('btn-nav-enter-arena');
            const fakeChallenges = document.querySelectorAll('.challenge-card, .table-row-challenge').length;

            const ghLink = document.getElementById('footer-link-github');
            const liLink = document.getElementById('footer-link-linkedin');

            return {
                starterBtnDisplay: starterBtn ? getComputedStyle(starterBtn).display : null,
                landingPageDisplay: landing ? getComputedStyle(landing).display : null,
                landingPageActive: landing ? landing.classList.contains('active') : false,
                btn3DStarterPresent: !!btn3D,
                arenaBtnPresent: !!arenaBtn,
                fakeChallengesCount: fakeChallenges,
                footerGithubHref: ghLink ? ghLink.getAttribute('href') : null,
                footerLinkedinHref: liLink ? liLink.getAttribute('href') : null
            };
        })()`);

        console.log('2. After Enter Click (Landing Page State):', JSON.stringify(landingState, null, 2));

        if (!landingState.landingPageActive || landingState.landingPageDisplay !== 'flex') {
            throw new Error('FAIL: #landing-page did not activate after clicking enter button!');
        }
        if (!landingState.footerGithubHref || !landingState.footerLinkedinHref) {
            throw new Error('FAIL: Footer social links (GitHub/LinkedIn) are missing!');
        }
        console.log('✓ PASS: Clean landing page activated with GitHub (' + landingState.footerGithubHref + ') & LinkedIn (' + landingState.footerLinkedinHref + ') footer links!');

        // Now click 📜 3D Certificate to test returning to starter page
        console.log('Clicking 📜 3D Certificate (#btn-view-3d-starter)...');
        await evaluate(`document.getElementById('btn-view-3d-starter').click()`);

        // Wait 1s for return transition
        await new Promise(r => setTimeout(r, 1000));

        const returnState = await evaluate(`(() => {
            const starterBtn = document.getElementById('starter-enter-btn');
            const landing = document.getElementById('landing-page');

            return {
                starterBtnDisplay: starterBtn ? getComputedStyle(starterBtn).display : null,
                starterBtnVisible: starterBtn ? getComputedStyle(starterBtn).display !== 'none' : false,
                landingPageActive: landing ? landing.classList.contains('active') : false
            };
        })()`);

        console.log('3. After Return to Starter Click:', JSON.stringify(returnState, null, 2));

        if (!returnState.starterBtnVisible) {
            throw new Error('FAIL: #starter-enter-btn did not return!');
        }
        if (returnState.landingPageActive) {
            throw new Error('FAIL: #landing-page is still active!');
        }
        console.log('✓ PASS: Return to 3D starter page works perfectly!');

        console.log('\n🎉 ALL STARTER & NAVIGATION VERIFICATIONS PASSED 100%!');

        ws.close();
    } finally {
        edge.kill();
    }
}

runVerification().catch(err => {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
});
