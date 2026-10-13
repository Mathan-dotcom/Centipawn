// Sanity verification script for heuristic evaluation engine
if (!process.env.ORACLE_KEY) {
    process.env.ORACLE_KEY = '0xd816571171d8df7d745e238f5102003568302c85de1a92f9b4cb8a00cd098269';
}

const { evaluatePosition } = require('../engine.js');

function mirrorFen(fen) {
    const parts = fen.split(' ');
    const rows = parts[0].split('/');
    const mirroredRows = rows.reverse().map(row => {
        return row.split('').map(c => {
            if (c >= 'a' && c <= 'z') return c.toUpperCase();
            if (c >= 'A' && c <= 'Z') return c.toLowerCase();
            return c;
        }).join('');
    });
    const mirroredPlacement = mirroredRows.join('/');
    const mirroredColor = parts[1] === 'w' ? 'b' : 'w';

    let mirroredCastling = '-';
    if (parts[2] !== '-') {
        let cStr = '';
        if (parts[2].includes('k')) cStr += 'K';
        if (parts[2].includes('q')) cStr += 'Q';
        if (parts[2].includes('K')) cStr += 'k';
        if (parts[2].includes('Q')) cStr += 'q';
        mirroredCastling = cStr || '-';
    }

    let mirroredEp = '-';
    if (parts[3] !== '-') {
        const file = parts[3][0];
        const rank = parts[3][1];
        const newRank = rank === '3' ? '6' : (rank === '6' ? '3' : rank);
        mirroredEp = file + newRank;
    }

    return [mirroredPlacement, mirroredColor, mirroredCastling, mirroredEp, parts[4], parts[5]].join(' ');
}

function runSanitySuite() {
    console.log('========================================================================================');
    console.log('                        HEURISTIC EVALUATION SANITY SUITE                               ');
    console.log('========================================================================================\n');

    let allPass = true;

    // a) Start position: expect |eval| <= 0.3 pawns (<= 30 cp)
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const startCp = evaluatePosition(startFen);
    const startPawns = startCp / 100;
    const passA = Math.abs(startPawns) <= 0.3;
    if (!passA) allPass = false;
    console.log('[CASE A: Start Position]');
    console.log(`  FEN:    ${startFen}`);
    console.log(`  Eval:   ${startCp} cp (${startPawns.toFixed(2)} pawns)`);
    console.log(`  Expect: |eval| <= 0.3 pawns`);
    console.log(`  Status: ${passA ? 'PASS' : 'FAIL'}\n`);

    // b) After 1.e4: expect not worse than -0.2 for White (eval >= -20 cp)
    const e4Fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const e4Cp = evaluatePosition(e4Fen);
    const e4Pawns = e4Cp / 100;
    const passB = e4Pawns >= -0.2;
    if (!passB) allPass = false;
    console.log('[CASE B: Position After 1.e4]');
    console.log(`  FEN:    ${e4Fen}`);
    console.log(`  Eval:   ${e4Cp} cp (${e4Pawns.toFixed(2)} pawns)`);
    console.log(`  Expect: eval >= -0.20 pawns`);
    console.log(`  Status: ${passB ? 'PASS' : 'FAIL'}\n`);

    // c) 5 FENs + color-mirrored versions: eval(FEN) must equal -eval(mirror) within 20 cp
    const testFens = [
        { desc: 'Start position', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
        { desc: '1.e4 e5 open position', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
        { desc: '1.e4 c5 Sicilian', fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2' },
        { desc: '1.e4 e5 2.Nf3 Nc6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' },
        { desc: 'Italian Game (ply 6)', fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4' }
    ];

    console.log('[CASE C: Symmetry & Mirror Anti-Symmetry]');
    console.log('----------------------------------------------------------------------------------------');
    console.log('| Description              | Orig Eval   | Mirr Eval   | Sum (|Orig+Mirr| <= 20) | Status |');
    console.log('----------------------------------------------------------------------------------------');
    let passCAll = true;
    testFens.forEach(t => {
        const mFen = mirrorFen(t.fen);
        const evalOrig = evaluatePosition(t.fen);
        const evalMirr = evaluatePosition(mFen);
        const diff = Math.abs(evalOrig + evalMirr);
        const pass = diff <= 20;
        if (!pass) {
            passCAll = false;
            allPass = false;
        }
        console.log(`| ${t.desc.padEnd(24)} | ${(evalOrig + ' cp').padStart(11)} | ${(evalMirr + ' cp').padStart(11)} | ${(diff + ' cp').padStart(23)} | ${pass ? 'PASS  ' : 'FAIL  '} |`);
    });
    console.log('----------------------------------------------------------------------------------------\n');

    // d) Position where White is up a queen for nothing: expect large positive value
    const upQueenFen = 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const upQueenCp = evaluatePosition(upQueenFen);
    const upQueenPawns = upQueenCp / 100;
    const passD = upQueenPawns >= 5.0; // At least +5 pawns for a full clean queen
    if (!passD) allPass = false;
    console.log('[CASE D: White Up a Queen for Nothing]');
    console.log(`  FEN:    ${upQueenFen}`);
    console.log(`  Eval:   ${upQueenCp} cp (${upQueenPawns.toFixed(2)} pawns)`);
    console.log(`  Expect: eval >= +5.00 pawns`);
    console.log(`  Status: ${passD ? 'PASS' : 'FAIL'}\n`);

    // e) The six positions of the Italian line:
    const italianFens = [
        { ply: 1, move: '1.e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' },
        { ply: 2, move: '1...e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
        { ply: 3, move: '2.Nf3', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
        { ply: 4, move: '2...Nc6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' },
        { ply: 5, move: '3.Bc4', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
        { ply: 6, move: '3...Bc5', fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4' }
    ];

    console.log('[CASE E: Six Positions of the Italian Line]');
    console.log('----------------------------------------------------------------------------------------');
    console.log('| Ply | Move   | Turn | Eval (cp) | Eval (pawns) | Swing from prev | Plausible (<= 1.5 P) |');
    console.log('----------------------------------------------------------------------------------------');
    let prevEval = 0;
    let passEAll = true;
    italianFens.forEach(it => {
        const cp = evaluatePosition(it.fen);
        const pawns = cp / 100;
        const swing = Math.abs(cp - prevEval);
        prevEval = cp;
        // In a quiet opening, evaluation should stay between -1.5 and +1.5 pawns
        const plausible = Math.abs(pawns) <= 1.5;
        if (!plausible) {
            passEAll = false;
            allPass = false;
        }
        console.log(`|  ${it.ply}  | ${it.move.padEnd(6)} |  ${it.fen.split(' ')[1]}   | ${(cp + ' cp').padStart(9)} | ${(pawns.toFixed(2) + ' P').padStart(12)} | ${(swing + ' cp').padStart(15)} | ${plausible ? 'PASS                ' : 'FAIL                '} |`);
    });
    console.log('----------------------------------------------------------------------------------------\n');

    console.log(`OVERALL SUITE STATUS: ${allPass ? 'ALL TESTS PASSED' : 'SANITY CHECKS FAILED'}\n`);
    return allPass;
}

if (require.main === module) {
    const passed = runSanitySuite();
    process.exit(passed ? 0 : 1);
}

module.exports = { runSanitySuite, mirrorFen };
