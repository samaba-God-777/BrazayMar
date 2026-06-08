const mongoose = require('mongoose');

const promoSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
        title: { type: String, required: true, trim: true, maxlength: 80 },
        description: { type: String, trim: true, maxlength: 400, default: '' },
        image: { type: String, default: '' },
        icon: { type: String, default: 'fa-fire' },
        badgeText: { type: String, default: '' },
        badgeColor: { type: String, default: '#ff6b00' },
        discountPercent: { type: Number, default: 0, min: 0, max: 100 },
        originalPrice: { type: Number, default: null },
        promoPrice: { type: Number, default: null },
        productIds: { type: [String], default: [] },
        categoryId: { type: String, default: '' },
        validFrom: { type: Date, default: null },
        validUntil: { type: Date, default: null },
        active: { type: Boolean, default: true },
        order: { type: Number, default: 99 },
        createdAt: { type: Date, default: Date.now }
    },
    { versionKey: false }
);

const Promo = mongoose.models.Promo || mongoose.model('Promo', promoSchema);

module.exports = { Promo };
