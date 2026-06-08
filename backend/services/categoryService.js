const { Category, DEFAULT_CATEGORIES } = require('../models/Category');
const Product = require('../models/Product');

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

async function ensureDefaults() {
    const count = await Category.countDocuments();
    if (count > 0) return;
    await Category.insertMany(DEFAULT_CATEGORIES);
    console.log(`📂 ${DEFAULT_CATEGORIES.length} categorías iniciales creadas`);
}

async function listCategories() {
    await ensureDefaults();
    const cats = await Category.find().sort({ order: 1, name: 1 }).lean();
    return cats.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon || 'fa-utensils',
        order: c.order || 99,
        active: c.active !== false
    }));
}

async function getCategory(id) {
    return Category.findOne({ id: id.toLowerCase() });
}

async function createCategory({ name, icon, order }) {
    if (!name || !name.trim()) {
        const err = new Error('El nombre de la categoría es requerido');
        err.status = 400;
        throw err;
    }
    const baseId = slugify(name);
    if (!baseId) {
        const err = new Error('Nombre de categoría inválido');
        err.status = 400;
        throw err;
    }

    let id = baseId;
    let suffix = 1;
    while (await Category.findOne({ id })) {
        suffix += 1;
        id = `${baseId}-${suffix}`;
    }

    const maxOrder = await Category.findOne().sort({ order: -1 }).lean();
    const cat = await Category.create({
        id,
        name: name.trim(),
        icon: icon || 'fa-utensils',
        order: typeof order === 'number' ? order : (maxOrder?.order || 0) + 1,
        active: true
    });
    return cat.toObject();
}

async function updateCategory(id, { name, icon, order, active }) {
    const cat = await Category.findOne({ id: id.toLowerCase() });
    if (!cat) {
        const err = new Error('Categoría no encontrada');
        err.status = 404;
        throw err;
    }
    if (typeof name === 'string' && name.trim()) cat.name = name.trim();
    if (typeof icon === 'string' && icon.trim()) cat.icon = icon.trim();
    if (typeof order === 'number') cat.order = order;
    if (typeof active === 'boolean') cat.active = active;
    await cat.save();
    return cat.toObject();
}

async function deleteCategory(id, { reassignTo } = {}) {
    const cat = await Category.findOne({ id: id.toLowerCase() });
    if (!cat) {
        const err = new Error('Categoría no encontrada');
        err.status = 404;
        throw err;
    }

    const productCount = await Product.countDocuments({ categoria: cat.id });
    if (productCount > 0) {
        if (!reassignTo) {
            const err = new Error(`La categoría tiene ${productCount} producto(s). Reasígnalos o especifica "reassignTo".`);
            err.status = 409;
            err.productCount = productCount;
            throw err;
        }
        const target = await Category.findOne({ id: reassignTo.toLowerCase() });
        if (!target) {
            const err = new Error(`Categoría destino "${reassignTo}" no existe`);
            err.status = 400;
            throw err;
        }
        await Product.updateMany({ categoria: cat.id }, { $set: { categoria: target.id } });
    }

    await Category.deleteOne({ _id: cat._id });
    return { id: cat.id, name: cat.name, reassigned: productCount };
}

module.exports = {
    listCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    ensureDefaults,
    slugify
};
