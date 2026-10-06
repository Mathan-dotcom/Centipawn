const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path,
            method,
            headers: body ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(body))
            } : {}
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch {}
                resolve({ status: res.statusCode, data: parsed });
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('=== PART A: USERNAME/AVATAR PROFILE & PERSISTENCE TEST ===\n');

    // 1. Test GET /api/profile/presets
    console.log('Test 1: GET /api/profile/presets');
    const presetsRes = await request('GET', '/api/profile/presets');
    assert.strictEqual(presetsRes.status, 200);
    assert(Array.isArray(presetsRes.data.presets), 'Presets should be an array');
    assert(presetsRes.data.presets.length >= 10, 'Should have at least 10 presets');
    console.log(`  ✓ Successfully retrieved ${presetsRes.data.presets.length} presets.\n`);

    // 2. Test GET /api/profile/:address for unrecorded address (NEVER 404)
    console.log('Test 2: GET /api/profile/:address for unknown address (Must never 404)');
    const testAddr = '0x1111222233334444555566667777888899990000';
    const unknownRes = await request('GET', `/api/profile/${testAddr}`);
    assert.strictEqual(unknownRes.status, 200, 'Unknown address should return 200');
    assert(unknownRes.data.profile, 'Should return profile object');
    assert.strictEqual(unknownRes.data.profile.username, null, 'Unregistered user should have username: null');
    assert(unknownRes.data.profile.avatarSvg && (unknownRes.data.profile.avatarSvg.includes('%3Csvg') || unknownRes.data.profile.avatarSvg.includes('<svg') || unknownRes.data.profile.avatarSvg.includes('image/svg+xml')), 'Should include deterministic SVG identicon');
    console.log('  ✓ Returns 200 with default profile and SVG identicon.\n');

    // 3. Test Validation on POST /api/profile
    console.log('Test 3: POST /api/profile input validation');
    const invalidCases = [
        { body: { address: testAddr, username: '' }, desc: 'Empty username' },
        { body: { address: testAddr, username: '   ' }, desc: 'Whitespace username' },
        { body: { address: testAddr, username: 'ab' }, desc: 'Too short (<3 chars)' },
        { body: { address: testAddr, username: 'a'.repeat(21) }, desc: 'Too long (>20 chars)' },
        { body: { address: testAddr, username: 'user@name!' }, desc: 'Invalid special characters' },
        { body: { address: 'invalid-address', username: 'valid_user' }, desc: 'Malformed address' }
    ];

    for (const c of invalidCases) {
        const res = await request('POST', '/api/profile', c.body);
        assert.strictEqual(res.status, 400, `Expected 400 for ${c.desc}`);
        console.log(`  ✓ Correctly rejected: ${c.desc} (${res.data.error})`);
    }
    console.log();

    // 4. Test POST /api/profile upsert (Create new profile)
    console.log('Test 4: POST /api/profile upsert (Creation)');
    const newProfileData = {
        address: testAddr,
        username: 'Kasparov_AI',
        avatarId: 'knight-neon'
    };
    const createRes = await request('POST', '/api/profile', newProfileData);
    assert.strictEqual(createRes.status, 200);
    assert.strictEqual(createRes.data.profile.username, 'Kasparov_AI');
    assert.strictEqual(createRes.data.profile.avatarId, 'knight-neon');
    console.log('  ✓ Profile created successfully on server.\n');

    // 5. Test GET /api/profile/:address after saving (Immediate check)
    console.log('Test 5: GET /api/profile/:address verification');
    const verifyRes = await request('GET', `/api/profile/${testAddr}`);
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.data.profile.username, 'Kasparov_AI');
    assert.strictEqual(verifyRes.data.profile.avatarId, 'knight-neon');
    console.log('  ✓ Server returned persisted profile.\n');

    // 6. Test Physical Disk Persistence
    console.log('Test 6: Physical File Persistence in data/profiles.json');
    const profilesFilePath = path.join(__dirname, '..', 'data', 'profiles.json');
    assert(fs.existsSync(profilesFilePath), 'data/profiles.json must exist');
    const rawData = fs.readFileSync(profilesFilePath, 'utf8');
    const parsedData = JSON.parse(rawData);
    assert(parsedData[testAddr.toLowerCase()], 'Profile must be physically written in JSON file');
    assert.strictEqual(parsedData[testAddr.toLowerCase()].username, 'Kasparov_AI');
    console.log(`  ✓ Verified: Profile exists physically on disk at data/profiles.json.\n`);

    // 7. Test Profile Update (Upsert existing)
    console.log('Test 7: Update existing profile');
    const updateRes = await request('POST', '/api/profile', {
        address: testAddr,
        username: 'Kasparov_Updated',
        avatarId: 'centipawn-phoenix'
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.profile.username, 'Kasparov_Updated');
    assert.strictEqual(updateRes.data.profile.avatarId, 'centipawn-phoenix');

    const verifyUpdate = await request('GET', `/api/profile/${testAddr}`);
    assert.strictEqual(verifyUpdate.data.profile.username, 'Kasparov_Updated');
    assert.strictEqual(verifyUpdate.data.profile.avatarId, 'centipawn-phoenix');
    console.log('  ✓ Upsert successfully updated username and avatar.\n');

    console.log('==================================================');
    console.log('🎉 ALL PART A BACKEND & STORAGE TESTS PASSED 100%!');
    console.log('==================================================');
}

runTests().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
