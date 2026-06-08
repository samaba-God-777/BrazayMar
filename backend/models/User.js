const mongoose = require('mongoose');
const crypto = require('crypto');

const PBKDF2_ITERATIONS = 120000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
        email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
        name: { type: String, required: true, trim: true },
        phone: { type: String, trim: true, default: '' },
        address: { type: String, trim: true, default: '' },
        passwordHash: { type: String, required: true },
        role: { type: String, enum: ['cliente', 'admin'], default: 'cliente', index: true },
        active: { type: Boolean, default: true },
        lastLoginAt: { type: Date },
        lastSeenAt: { type: Date },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date }
    },
    { versionKey: false }
);

userSchema.methods.toPublic = function toPublic() {
    const now = Date.now();
    const lastSeen = this.lastSeenAt?.getTime?.() || 0;
    const isOnline = lastSeen > 0 && (now - lastSeen) < 2 * 60 * 1000;
    return {
        id: this._id.toString(),
        username: this.username,
        email: this.email,
        name: this.name,
        phone: this.phone,
        address: this.address,
        role: this.role,
        active: this.active,
        isOnline,
        createdAt: this.createdAt?.toISOString?.() || null,
        lastLoginAt: this.lastLoginAt?.toISOString?.() || null,
        lastSeenAt: this.lastSeenAt?.toISOString?.() || null
    };
};

userSchema.statics.hashPassword = function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
    return `${salt}:${hash}`;
};

userSchema.statics.verifyPassword = function verifyPassword(password, stored) {
    if (!stored || typeof stored !== 'string') return false;
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    try {
        const attempt = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
        const a = Buffer.from(hash, 'hex');
        const b = Buffer.from(attempt, 'hex');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
};

module.exports = mongoose.model('User', userSchema);
