const mongoose = require('mongoose');

const DEFAULT_CATEGORIES = [
    { id: 'hamburguesas', name: 'Hamburguesas', icon: 'fa-burger', order: 1 },
    { id: 'especiales', name: 'Especiales', icon: 'fa-star', order: 2 },
    { id: 'cerdo', name: 'Combo Cerdo', icon: 'fa-drumstick-bite', order: 3 }
];

const CATEGORIES_COLLECTION = 'categories';

const categorySchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
        name: { type: String, required: true, trim: true },
        icon: { type: String, default: 'fa-utensils' },
        order: { type: Number, default: 99 },
        active: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
    },
    { versionKey: false }
);

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

module.exports = { Category, DEFAULT_CATEGORIES, CATEGORIES_COLLECTION };
