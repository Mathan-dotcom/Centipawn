const fs = require('fs');
const path = require('path');
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

async function main() {
    console.log('=== Base Sepolia Escrow Deployment (PRD v2.1) ===');
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const deployerKey = process.env.DEPLOYER_KEY;
    if (!deployerKey) {
        console.error('ERROR: DEPLOYER_KEY is not set in environment or .env.');
        console.log('Generate/fund a deployer wallet and set DEPLOYER_KEY in .env before running.');
        process.exit(1);
    }

    const deployer = new ethers.Wallet(deployerKey, provider);
    console.log('Deployer Address:', deployer.address);

    const bal = await provider.getBalance(deployer.address);
    console.log('Deployer ETH Balance:', ethers.formatEther(bal), 'ETH');

    if (bal === 0n) {
        console.error('\nERROR: Deployer wallet has 0.0 ETH on Base Sepolia.');
        console.error('Please fund this address with testnet ETH from a Base Sepolia faucet:');
        console.error('  -> https://faucets.chain.link/base-sepolia');
        console.error('  -> https://www.alchemy.com/faucets/base-sepolia');
        process.exit(1);
    }

    // Determine Oracle Address (from ORACLE_KEY or ORACLE_ADDRESS)
    let oracleAddress = process.env.ORACLE_ADDRESS;
    if (!oracleAddress && process.env.ORACLE_KEY) {
        oracleAddress = new ethers.Wallet(process.env.ORACLE_KEY).address;
    }
    if (!oracleAddress) {
        console.error('ERROR: ORACLE_KEY or ORACLE_ADDRESS must be set in .env.');
        process.exit(1);
    }
    console.log('Trusted Oracle Address:', oracleAddress);
    console.log('USDC Contract Address:', USDC_ADDRESS);

    // Load compiled artifact
    const artifactPath = path.join(__dirname, '..', 'artifacts', 'EvalStakeEscrow.json');
    if (!fs.existsSync(artifactPath)) {
        console.log('Artifact not found. Compiling first...');
        require('./compile.js');
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    console.log('\nBroadcasting deployment transaction to Base Sepolia...');
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const contract = await factory.deploy(USDC_ADDRESS, oracleAddress);

    console.log('Deploy Tx Hash:', contract.deploymentTransaction().hash);
    console.log('Waiting for confirmation on Base Sepolia...');
    await contract.waitForDeployment();

    const deployedAddress = await contract.getAddress();
    console.log('\n=======================================================');
    console.log('✓ CONTRACT DEPLOYED SUCCESSFULLY TO BASE SEPOLIA!');
    console.log('  Contract Address:', deployedAddress);
    console.log('  BaseScan URL:', `https://sepolia.basescan.org/address/${deployedAddress}`);
    console.log('=======================================================');

    // Update .env with real deployed address
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/ESCROW_CONTRACT=.*/g, `ESCROW_CONTRACT=${deployedAddress}`);
        fs.writeFileSync(envPath, envContent);
        console.log('✓ Updated ESCROW_CONTRACT in local .env');
    }
}

main().catch(err => {
    console.error('Deployment Failed:', err);
    process.exit(1);
});
