const fs = require('fs');
const path = require('path');
const solc = require('solc');

console.log('Compiling contracts/EvalStakeEscrow.sol...');

const contractPath = path.join(__dirname, '..', 'contracts', 'EvalStakeEscrow.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'EvalStakeEscrow.sol': {
            content: source
        }
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode']
            }
        },
        optimizer: {
            enabled: true,
            runs: 200
        },
        viaIR: true
    }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
    let hasError = false;
    output.errors.forEach(err => {
        if (err.severity === 'error') {
            console.error('COMPILE ERROR:', err.formattedMessage);
            hasError = true;
        } else {
            console.warn('COMPILE WARNING:', err.formattedMessage);
        }
    });
    if (hasError) process.exit(1);
}

const contract = output.contracts['EvalStakeEscrow.sol']['EvalStakeEscrow'];
console.log('✓ Compilation Successful!');
console.log('Bytecode size (bytes):', contract.evm.bytecode.object.length / 2);
console.log('ABI functions count:', contract.abi.length);

// Save artifacts
const artifactsDir = path.join(__dirname, '..', 'artifacts');
if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

fs.writeFileSync(
    path.join(artifactsDir, 'EvalStakeEscrow.json'),
    JSON.stringify({ abi: contract.abi, bytecode: contract.evm.bytecode.object }, null, 2)
);
console.log('✓ Artifacts saved to artifacts/EvalStakeEscrow.json');
