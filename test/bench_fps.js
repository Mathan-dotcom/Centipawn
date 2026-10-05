const http = require('http');
const { spawn } = require('child_process');

async function benchmarkFPS() {
    console.log('--- Benchmarking Centipawn FPS ---');
    const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--disable-gpu-vsync',
        '--no-first-run',
        'http://localhost:3000'
    ]);

    try {
        await new Promise(r => setTimeout(r, 1500));
        const targets = await new Promise((resolve, reject) => {
            http.get('http://127.0.0.1:9222/json', (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => resolve(JSON.parse(body)));
            }).on('error', reject);
        });

        const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
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

        await send('Page.enable');
        await new Promise(r => setTimeout(r, 2000));

        // Measure FPS on 3D Starter Scene
        const starterFPS = await send('Runtime.evaluate', {
            expression: `new Promise(resolve => {
                let frames = 0;
                const start = performance.now();
                function tick() {
                    frames++;
                    if (performance.now() - start < 1000) {
                        requestAnimationFrame(tick);
                    } else {
                        const duration = (performance.now() - start) / 1000;
                        resolve(Math.round(frames / duration));
                    }
                }
                requestAnimationFrame(tick);
            })`,
            awaitPromise: true,
            returnByValue: true
        });

        console.log(`Starter 3D Scene FPS: ${starterFPS.result.value} FPS`);

        // Enter Landing Page
        await send('Runtime.evaluate', {
            expression: `document.getElementById('starter-enter-btn')?.click()`
        });
        await new Promise(r => setTimeout(r, 1200));

        // Measure FPS on Landing Page
        const landingFPS = await send('Runtime.evaluate', {
            expression: `new Promise(resolve => {
                let frames = 0;
                const start = performance.now();
                function tick() {
                    frames++;
                    if (performance.now() - start < 1000) {
                        requestAnimationFrame(tick);
                    } else {
                        const duration = (performance.now() - start) / 1000;
                        resolve(Math.round(frames / duration));
                    }
                }
                requestAnimationFrame(tick);
            })`,
            awaitPromise: true,
            returnByValue: true
        });

        console.log(`Landing Page (Wallpaper + Scrolling) FPS: ${landingFPS.result.value} FPS`);

        ws.close();
    } finally {
        edge.kill();
    }
}

benchmarkFPS().catch(err => {
    console.error(err);
    process.exit(1);
});
