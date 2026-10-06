// profiles.js — Persistent Profile Store for Centipawn (PRD v2.1)
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const DATA_DIR = path.join(__dirname, 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

// Preset Avatars (12 bundled icon/emoji presets)
const PRESET_AVATARS = [
    { id: 'knight-neon', label: 'Neon Knight', icon: '♞', color: '#70d6ff' },
    { id: 'bishop-cyber', label: 'Cyber Bishop', icon: '♝', color: '#a78bfa' },
    { id: 'queen-gold', label: 'Golden Queen', icon: '♛', color: '#f59e0b' },
    { id: 'king-crown', label: 'Sovereign King', icon: '♚', color: '#ef4444' },
    { id: 'rook-vault', label: 'Iron Fortress', icon: '♜', color: '#10b981' },
    { id: 'pawn-matrix', label: 'Matrix Pawn', icon: '♟', color: '#06b6d4' },
    { id: 'centipawn-phoenix', label: 'Phoenix GM', icon: '🔥', color: '#f97316' },
    { id: 'base-builder', label: 'Base Builder', icon: '⚡', color: '#3b82f6' },
    { id: 'grandmaster-bot', label: 'Synth Master', icon: '🤖', color: '#ec4899' },
    { id: 'dragon-hyper', label: 'Hyper Dragon', icon: '🐉', color: '#8b5cf6' },
    { id: 'vortex-sol', label: 'Quantum Vortex', icon: '🌀', color: '#14b8a6' },
    { id: 'shield-warden', label: 'Vault Warden', icon: '🛡️', color: '#64748b' }
];

// In-Memory Profile Cache
const profileMap = new Map();

// Generate a deterministic SVG identicon for any wallet address
function generateIdenticonSvg(address) {
    const clean = (address || '').toLowerCase().replace(/^0x/, '').padEnd(40, '0');
    // Generate deterministic colors from address slices
    const h1 = parseInt(clean.slice(0, 4), 16) % 360;
    const h2 = (h1 + 140) % 360;
    const color1 = `hsl(${h1}, 75%, 60%)`;
    const color2 = `hsl(${h2}, 85%, 45%)`;
    
    // 5x5 symmetric grid
    let cells = '';
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
            const idx = r * 3 + c;
            const val = parseInt(clean.charAt(idx % clean.length), 16);
            if (val % 2 === 0) {
                // symmetric columns
                const x1 = c * 10;
                const x2 = (4 - c) * 10;
                const y = r * 10;
                cells += `<rect x="${x1}" y="${y}" width="10" height="10" fill="${color1}" />`;
                if (c < 2) {
                    cells += `<rect x="${x2}" y="${y}" width="10" height="10" fill="${color1}" />`;
                }
            }
        }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="50" height="50">
        <rect width="50" height="50" fill="${color2}" rx="8"/>
        ${cells}
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Load profiles from persistent storage
function initStorage() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (fs.existsSync(PROFILES_FILE)) {
            const raw = fs.readFileSync(PROFILES_FILE, 'utf8');
            const data = JSON.parse(raw || '{}');
            for (const [addr, p] of Object.entries(data)) {
                profileMap.set(addr.toLowerCase(), p);
            }
            console.log(`[Profiles] Loaded ${profileMap.size} player profiles from storage.`);
        } else {
            fs.writeFileSync(PROFILES_FILE, JSON.stringify({}, null, 2), 'utf8');
        }
    } catch (err) {
        console.warn('[Profiles] Notice loading storage:', err.message);
    }
}

// Persist in-memory profiles to disk
function saveStorage() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        const data = {};
        for (const [addr, p] of profileMap.entries()) {
            data[addr.toLowerCase()] = p;
        }
        fs.writeFileSync(PROFILES_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('[Profiles] Failed to save profiles:', err.message);
    }
}

// Initialize on module load
initStorage();

/**
 * Validate username constraints: 3-20 chars, alphanumeric + underscore
 */
function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: 'Username must be a non-empty string' };
    }
    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
        return { valid: false, error: 'Username must be between 3 and 20 characters' };
    }
    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!regex.test(trimmed)) {
        return { valid: false, error: 'Username can only contain alphanumeric characters and underscores' };
    }
    return { valid: true, username: trimmed };
}

/**
 * Get profile for address. Never throws 404; returns default if not found.
 */
function getProfile(rawAddress) {
    if (!rawAddress || !ethers.isAddress(rawAddress)) {
        const fallback = '0x0000000000000000000000000000000000000000';
        return {
            address: fallback,
            username: null,
            avatarId: 'default',
            avatar: PRESET_AVATARS[0],
            identiconUrl: generateIdenticonSvg(fallback),
            avatarSvg: generateIdenticonSvg(fallback),
            isDefault: true,
            createdAt: null,
            updatedAt: null
        };
    }

    const checkAddr = ethers.getAddress(rawAddress);
    const key = checkAddr.toLowerCase();
    const existing = profileMap.get(key);

    if (existing) {
        const preset = PRESET_AVATARS.find(a => a.id === existing.avatarId) || PRESET_AVATARS[0];
        return {
            address: checkAddr,
            username: existing.username,
            avatarId: existing.avatarId,
            avatar: preset,
            identiconUrl: generateIdenticonSvg(checkAddr),
            avatarSvg: generateIdenticonSvg(checkAddr),
            isDefault: false,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt
        };
    }

    // Default profile for unregistered address (never 404)
    return {
        address: checkAddr,
        username: null,
        avatarId: 'default',
        avatar: PRESET_AVATARS[0],
        identiconUrl: generateIdenticonSvg(checkAddr),
        avatarSvg: generateIdenticonSvg(checkAddr),
        isDefault: true,
        createdAt: null,
        updatedAt: null
    };
}

/**
 * Create or update a profile for an address
 */
function upsertProfile(rawAddress, rawUsername, avatarId = 'knight-neon') {
    if (!rawAddress || !ethers.isAddress(rawAddress)) {
        throw new Error('Invalid Ethereum wallet address format');
    }
    const v = validateUsername(rawUsername);
    if (!v.valid) {
        throw new Error(v.error);
    }

    const checkAddr = ethers.getAddress(rawAddress);
    const key = checkAddr.toLowerCase();
    const existing = profileMap.get(key);

    // Validate avatarId against presets
    const validPreset = PRESET_AVATARS.find(a => a.id === avatarId);
    const resolvedAvatarId = validPreset ? validPreset.id : 'knight-neon';

    const now = Date.now();
    const profile = {
        address: key, // stored lowercase
        username: v.username,
        avatarId: resolvedAvatarId,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now
    };

    profileMap.set(key, profile);
    saveStorage();

    return getProfile(checkAddr);
}

/**
 * Return all registered profiles or presets
 */
function getAllProfiles() {
    const list = [];
    for (const [key] of profileMap.entries()) {
        list.push(getProfile(key));
    }
    return list;
}

module.exports = {
    PRESET_AVATARS,
    getProfile,
    upsertProfile,
    getAllProfiles,
    validateUsername,
    generateIdenticonSvg
};
