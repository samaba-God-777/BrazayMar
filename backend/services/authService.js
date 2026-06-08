const crypto = require('crypto');
const User = require('../models/User');

const TOKEN_SECRET = process.env.AUTH_SECRET || 'brazasmar-dev-secret-change-in-production';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const ADMIN_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

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

function ttlForRole(role) {
    return role === 'admin' ? ADMIN_TOKEN_TTL_MS : TOKEN_TTL_MS;
}

function createToken(user) {
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64UrlEncode(JSON.stringify({
        sub: user._id.toString(),
        username: user.username,
        role: user.role,
        name: user.name,
        exp: Date.now() + ttlForRole(user.role)
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;

function validateRegisterPayload({ username, email, password, name, phone, address }) {
    const errors = [];
    if (!username || !USERNAME_RE.test(username)) {
        errors.push('El usuario debe tener 3-30 caracteres (letras, números, . _ -)');
    }
    if (!email || !EMAIL_RE.test(email)) {
        errors.push('Email inválido');
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
        errors.push('La contraseña debe tener al menos 6 caracteres');
    }
    if (!name || name.trim().length < 2) {
        errors.push('El nombre es requerido');
    }
    return { errors, clean: { username, email, name, phone, address } };
}

async function registerCustomer(payload) {
    const { errors, clean } = validateRegisterPayload(payload);
    if (errors.length) {
        const err = new Error(errors.join('. '));
        err.status = 400;
        throw err;
    }

    const existing = await User.findOne({
        $or: [{ username: clean.username.toLowerCase() }, { email: clean.email.toLowerCase() }]
    });
    if (existing) {
        const err = new Error('El usuario o email ya están registrados');
        err.status = 409;
        throw err;
    }

    const user = await User.create({
        username: clean.username.toLowerCase(),
        email: clean.email.toLowerCase(),
        name: clean.name.trim(),
        phone: (clean.phone || '').trim(),
        address: (clean.address || '').trim(),
        passwordHash: User.hashPassword(payload.password),
        role: 'cliente'
    });

    return user;
}

async function authenticateUser(identifier, password) {
    if (!identifier || !password) return null;
    const id = String(identifier).trim().toLowerCase();
    const user = await User.findOne({
        $or: [{ username: id }, { email: id }]
    });
    if (!user || !user.active) return null;
    if (!User.verifyPassword(password, user.passwordHash)) return null;

    user.lastLoginAt = new Date();
    await user.save();
    return user;
}

async function ensureDefaultAdmin() {
    const count = await User.countDocuments({ role: 'admin' });
    if (count > 0) return;
    const exists = await User.findOne({ username: 'admin' });
    if (exists) return;

    await User.create({
        username: 'admin',
        email: process.env.ADMIN_EMAIL || 'admin@brazasmar.local',
        name: 'Administrador',
        passwordHash: User.hashPassword(process.env.ADMIN_PASSWORD || 'admin123'),
        role: 'admin'
    });
    console.log('👨‍💼 Usuario admin inicial creado (admin / admin123)');
}

async function getUserById(id) {
    try {
        return await User.findById(id);
    } catch {
        return null;
    }
}

async function updateProfile(userId, updates) {
    const allowed = ['name', 'phone', 'address', 'email'];
    const data = {};
    for (const key of allowed) {
        if (typeof updates[key] === 'string') data[key] = updates[key].trim();
    }
    if (data.email && !EMAIL_RE.test(data.email)) {
        const err = new Error('Email inválido');
        err.status = 400;
        throw err;
    }
    if (data.email) {
        const dup = await User.findOne({ email: data.email.toLowerCase(), _id: { $ne: userId } });
        if (dup) {
            const err = new Error('Ese email ya está en uso');
            err.status = 409;
            throw err;
        }
        data.email = data.email.toLowerCase();
    }
    data.updatedAt = new Date();
    const user = await User.findByIdAndUpdate(userId, data, { new: true });
    return user;
}

async function changePassword(userId, currentPassword, newPassword) {
    if (!newPassword || newPassword.length < 6) {
        const err = new Error('La nueva contraseña debe tener al menos 6 caracteres');
        err.status = 400;
        throw err;
    }
    const user = await User.findById(userId);
    if (!user) {
        const err = new Error('Usuario no encontrado');
        err.status = 404;
        throw err;
    }
    if (!User.verifyPassword(currentPassword, user.passwordHash)) {
        const err = new Error('La contraseña actual es incorrecta');
        err.status = 401;
        throw err;
    }
    user.passwordHash = User.hashPassword(newPassword);
    user.updatedAt = new Date();
    await user.save();
    return user;
}

function getUserFromRequest(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    return verifyToken(token);
}

function requireAuth(req, res, next) {
    const user = getUserFromRequest(req);
    if (!user) {
        return res.status(401).json({ error: 'No autorizado. Inicia sesión de nuevo.' });
    }
    req.user = user;
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'No autorizado' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'No tienes permisos para esta acción' });
        }
        next();
    };
}

module.exports = {
    createToken,
    verifyToken,
    getUserFromRequest,
    registerCustomer,
    authenticateUser,
    requireAuth,
    requireRole,
    ensureDefaultAdmin,
    getUserById,
    updateProfile,
    changePassword,
    hashPassword: User.hashPassword
};
