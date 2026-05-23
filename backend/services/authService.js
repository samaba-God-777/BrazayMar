const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USERS_PATH = path.join(__dirname, '../data/users.json');
const TOKEN_SECRET = process.env.AUTH_SECRET || 'brazasmar-dev-secret-change-in-production';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function ensureUsersFile() {
    const dataDir = path.dirname(USERS_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(USERS_PATH)) {
        const defaultUsers = {
            users: [
                {
                    id: 'admin',
                    username: 'admin',
                    passwordHash: hashPassword('admin123'),
                    role: 'admin',
                    name: 'Administrador'
                }
            ]
        };
        fs.writeFileSync(USERS_PATH, JSON.stringify(defaultUsers, null, 2));
    }
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const attempt = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
}

function base64UrlEncode(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function base64UrlDecode(value) {
    const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function createToken(user) {
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64UrlEncode(JSON.stringify({
        sub: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        exp: Date.now() + TOKEN_TTL_MS
    }));
    const signature = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expected = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    if (signature !== expected) return null;

    try {
        const data = JSON.parse(base64UrlDecode(payload));
        if (!data.exp || Date.now() > data.exp) return null;
        return {
            id: data.sub,
            username: data.username,
            role: data.role,
            name: data.name
        };
    } catch {
        return null;
    }
}

function readUsers() {
    ensureUsersFile();
    return JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8'));
}

function authenticate(username, password) {
    const { users } = readUsers();
    const user = users.find((u) => u.username === username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
        return null;
    }

    return {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
    };
}

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const user = verifyToken(token);
    if (!user) {
        return res.status(401).json({ error: 'No autorizado. Inicia sesión de nuevo.' });
    }

    req.user = user;
    next();
}

ensureUsersFile();

module.exports = {
    authenticate,
    createToken,
    verifyToken,
    requireAuth,
    hashPassword
};
