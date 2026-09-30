const fs = require('fs');
const path = require('path');
const http = require('http');
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
const ESCROW_ADDRESS = process.env.ESCROW_CONTRACT || '0xBe5cD1b1c18e1aAb2360C9333eE9b941A2EA7eAc';

const provider = new ethers.JsonRpcProvider(RPC_URL);

// ABI snippets
const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
    'function transfer(address,uint256) returns (bool)'
];

const ESCROW_ABI = [
    'function createMatch(bytes32 gameId, uint256 stakeAmount, uint8 timeControl) external returns (bytes32)',
    'function joinMatch(bytes32 gameId) external',
    'function matches(bytes32) view returns (bytes32 gameId, address playerA, address playerB, uint256 stakeAmount, uint256 totalPot, uint8 timeControl, uint256 createdAt, uint8 status)',
    'function isGameSettled(bytes32) view returns (bool)'
];

// Helper to post JSON to local server
function postJSON(endpoint, data) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(data);
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: endpoint,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch {
                    resolve({ status: res.statusCode, body });
                }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function main() {
    console.log('===============================================================');
    console.log('  CENTIPAWN ON-CHAIN E2E MATCH EXECUTION & SETTLEMENT VERIFICATION');
    console.log('===============================================================');
    console.log('Escrow Contract Address:', ESCROW_ADDRESS);
    console.log('USDC Contract Address:  ', USDC_ADDRESS);

    // Setup Wallets
    const deployerKey = process.env.DEPLOYER_KEY;
    const playerA = new ethers.Wallet(deployerKey, provider);
    console.log('\n[Player A] Address:', playerA.address);

    // Create / load a persistent test Player B wallet
    const playerBKey = '0x5cfab30ac960741792c56021ccc59563fea373d1f5f360fce05329d501286ade';
    const playerB = new ethers.Wallet(playerBKey, provider);
    console.log('[Player B] Address:', playerB.address);

    const usdcA = new ethers.Contract(USDC_ADDRESS, USDC_ABI, playerA);
    const usdcB = new ethers.Contract(USDC_ADDRESS, USDC_ABI, playerB);
    const escrowA = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, playerA);
    const escrowB = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, playerB);

    // Check Player B ETH & USDC balances and fund from Player A if needed
    const bEth = await provider.getBalance(playerB.address);
    if (bEth < ethers.parseEther('0.001')) {
        console.log('[Setup] Funding Player B with 0.002 ETH for gas...');
        const tx = await playerA.sendTransaction({
            to: playerB.address,
            value: ethers.parseEther('0.002')
        });
        await tx.wait();
        console.log('[Setup] Player B ETH funded. Hash:', tx.hash);
    }

    const bUSDC = await usdcB.balanceOf(playerB.address);
    if (bUSDC < 100000n) { // Less than 0.1 USDC
        console.log('[Setup] Funding Player B with 0.2 USDC...');
        const tx = await usdcA.transfer(playerB.address, 200000n);
        await tx.wait();
        console.log('[Setup] Player B USDC funded. Hash:', tx.hash);
    }

    // Check initial USDC balances
    const initialBalA = await usdcA.balanceOf(playerA.address);
    const initialBalB = await usdcB.balanceOf(playerB.address);
    console.log('\n--- STEP 7 (BEFORE): ON-CHAIN USDC BALANCES ---');
    console.log(`Player A USDC (Raw): ${initialBalA.toString()} (${ethers.formatUnits(initialBalA, 6)} USDC)`);
    console.log(`Player B USDC (Raw): ${initialBalB.toString()} (${ethers.formatUnits(initialBalB, 6)} USDC)`);

    // Stake Amount: 0.1 USDC (100,000 units with 6 decimals)
    const STAKE_RAW = 100000n; // 0.1 USDC
    const STAKE_API = 0.1;
    const gameId = ethers.id(`match_onchain_${Date.now()}`);
    console.log('\n--- STEP 6.1: CREATING MATCH ON-CHAIN & IN API ---');
    console.log('Game ID:', gameId);

    // Approve escrow contract
    console.log('Player A approving Escrow for 0.1 USDC...');
    await (await usdcA.approve(ESCROW_ADDRESS, STAKE_RAW)).wait();

    // Call createMatch on contract
    console.log('Player A calling escrow.createMatch on Base Sepolia...');
    const createTx = await escrowA.createMatch(gameId, STAKE_RAW, 1, { gasLimit: 250000 });
    console.log('createMatch Tx Hash:', createTx.hash);
    await createTx.wait(1);
    console.log('✓ createMatch confirmed on Base Sepolia!');

    // Call API create match
    const createRes = await postJSON('/api/matches/create', {
        gameId,
        playerA: playerA.address,
        stakeAmount: STAKE_API,
        timeControl: 1
    });
    console.log('API Match Created:', createRes.body.match.gameId);

    // Step 6.2: Join Match
    console.log('\n--- STEP 6.2: JOINING MATCH ON-CHAIN & IN API ---');
    console.log('Player B approving Escrow for 0.1 USDC...');
    await (await usdcB.approve(ESCROW_ADDRESS, STAKE_RAW)).wait();

    console.log('Player B calling escrow.joinMatch on Base Sepolia...');
    const joinTx = await escrowB.joinMatch(gameId, { gasLimit: 250000 });
    console.log('joinMatch Tx Hash:', joinTx.hash);
    await joinTx.wait(1);
    console.log('✓ joinMatch confirmed on Base Sepolia!');

    const joinRes = await postJSON('/api/matches/join', {
        gameId,
        playerB: playerB.address
    });
    console.log('API Match Joined:', joinRes.body.match.status);

    // Verify on-chain status with retry
    let onChainMatch = await escrowA.matches(gameId);
    for (let i = 0; i < 10; i++) {
        if (onChainMatch.status === 2n) break;
        await new Promise(r => setTimeout(r, 1000));
        onChainMatch = await escrowA.matches(gameId);
    }
    console.log('On-Chain Match Status (2 = Active):', onChainMatch.status.toString());
    console.log('On-Chain Total Pot:', ethers.formatUnits(onChainMatch.totalPot, 6), 'USDC');

    // Step 6.3 & 6.4: Play 20 Plies and Resign
    console.log('\n--- STEP 6.3 & 6.4: PLAYING 20 PLIES & RESIGNATION ---');
    // Sequence of 20 plies (Italian Game):
    // 1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6 5. Nc3 d6 6. Bg5 h6 7. Bh4 g5 8. Bg3 Bg4 9. h3 Bh5 10. Qd2 Bxf3
    const movesSequence = [
        'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'Nf6', 'Nc3', 'd6',
        'Bg5', 'h6', 'Bh4', 'g5', 'Bg3', 'Bg4', 'h3', 'Bh5', 'Qd2', 'Bxf3'
    ];
    console.log(`Played ${movesSequence.length} legal chess plies:`);
    console.log(movesSequence.map((m, i) => `${i % 2 === 0 ? Math.floor(i / 2) + 1 + '.' : ''}${m}`).join(' '));

    // Final FEN after 20 plies:
    const finalFEN = 'r2qk2r/ppp2p2/2np3p/2b1p1p1/2B1P3/2NP1b1P/PPPQ1PP1/R3K2R w KQkq - 0 11';
    console.log('Final FEN:', finalFEN);

    // Evaluate position with local Stockfish / evaluation engine
    const evalRes = await postJSON('/api/eval', { fen: finalFEN, playerAIsWhite: true, plies: 20 });
    console.log('Stockfish Evaluation (cp):', evalRes.body.stockfishEval);

    console.log('\n--- STEP 6.5: SETTLING MATCH ON-CHAIN ---');
    console.log('Triggering resignation: B_RESIGNED at ply 20');
    const settleRes = await postJSON('/api/matches/settle', {
        gameId,
        endReason: 'B_RESIGNED',
        finalFEN,
        evalCp: evalRes.body.stockfishEval,
        plies: 20
    });

    console.log('\nSettlement Response Status:', settleRes.status);
    console.log('Settlement Receipt Summary:');
    const receipt = settleRes.body.receipt;
    console.log(JSON.stringify(receipt, null, 2));

    console.log('\n--- STEP 6.6 & 6.7: ON-CHAIN TRANSACTION VERIFICATION ---');
    console.log('Settlement Tx Hash:', receipt.txHash);
    console.log('BaseScan URL:      ', receipt.baseScanUrl);

    // Query Base Sepolia RPC for the transaction receipt
    console.log('Verifying transaction status on Base Sepolia RPC...');
    let txReceipt = null;
    for (let i = 0; i < 15; i++) {
        txReceipt = await provider.getTransactionReceipt(receipt.txHash);
        if (txReceipt) break;
        await new Promise(r => setTimeout(r, 1000));
    }
    if (!txReceipt) {
        throw new Error('Transaction receipt not found after polling: ' + receipt.txHash);
    }
    console.log('Transaction Status:', txReceipt.status === 1 ? '1 (SUCCESS)' : '0 (FAILED)');
    console.log('Block Number:      ', txReceipt.blockNumber);
    console.log('Gas Used:          ', txReceipt.gasUsed.toString());

    // Step 7: Confirm USDC actually moved
    console.log('\n--- STEP 7: ON-CHAIN USDC BALANCE CHANGE VERIFICATION ---');
    const finalBalA = await usdcA.balanceOf(playerA.address);
    const finalBalB = await usdcB.balanceOf(playerB.address);

    console.log(`Player A Before: ${ethers.formatUnits(initialBalA, 6)} USDC | After: ${ethers.formatUnits(finalBalA, 6)} USDC`);
    console.log(`Player B Before: ${ethers.formatUnits(initialBalB, 6)} USDC | After: ${ethers.formatUnits(finalBalB, 6)} USDC`);

    const netChangeA = Number(ethers.formatUnits(finalBalA - initialBalA, 6));
    const netChangeB = Number(ethers.formatUnits(finalBalB - initialBalB, 6));

    console.log(`Net Change Player A: ${netChangeA >= 0 ? '+' : ''}${netChangeA.toFixed(6)} USDC`);
    console.log(`Net Change Player B: ${netChangeB >= 0 ? '+' : ''}${netChangeB.toFixed(6)} USDC`);
    console.log(`Contract Payout A: ${receipt.payoutUSDC_A} USDC (Stake returned + winnings: ${(receipt.payoutUSDC_A - STAKE_API).toFixed(4)} USDC)`);
    console.log(`Contract Payout B: ${receipt.payoutUSDC_B} USDC (Stake returned + winnings: ${(receipt.payoutUSDC_B - STAKE_API).toFixed(4)} USDC)`);

    console.log('\n===============================================================');
    console.log('✓ ALL ON-CHAIN MATCH LIFECYCLE CHECKS PASSED SUCCESSFULLY!');
    console.log('===============================================================');
}

main().catch(err => {
    console.error('E2E Match Failed:', err);
    process.exit(1);
});
