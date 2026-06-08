const { Promo } = require('../models/Promo');
const { slugify } = require('./categoryService');

function toClient(p) {
    if (!p) return null;
    return {
        id: p.id,
        title: p.title,
        description: p.description || '',
        image: p.image || '',
        icon: p.icon || 'fa-fire',
        badgeText: p.badgeText || '',
        badgeColor: p.badgeColor || '#ff6b00',
        discountPercent: p.discountPercent || 0,
        originalPrice: p.originalPrice,
        promoPrice: p.promoPrice,
        productIds: p.productIds || [],
        categoryId: p.categoryId || '',
        validFrom: p.validFrom,
        validUntil: p.validUntil,
        active: p.active !== false,
        order: p.order || 99
    };
}

async function isPromoValid(p) {
    if (!p) return false;
    if (p.active === false) return false;
    const now = new Date();
    // Si ya expiró, no se muestra
    if (p.validUntil && new Date(p.validUntil) < now) return false;
    // NOTA: NO filtramos por validFrom para que las promos recién creadas
    // (que a veces tienen validFrom en el futuro por confusión del admin)
    // se muestren en la tienda. Las fechas son informativas — se muestran
    // en la card. El admin ve el estado real (Programada/Activa) en su panel.
    return true;
}

async function listPromos({ includeInactive = false } = {}) {
    const all = await Promo.find().sort({ order: 1, createdAt: -1 }).lean();
    const out = [];
    for (const p of all) {
        const valid = await isPromoValid(p);
        if (!includeInactive && !valid) continue;
        out.push(toClient(p));
    }
    return out;
}

async function getPromo(id) {
    const p = await Promo.findOne({ id: id.toLowerCase() }).lean();
    return p ? toClient(p) : null;
}

async function createPromo(data) {
    const { title, description, image, icon, badgeText, badgeColor, discountPercent, originalPrice, promoPrice, productIds, categoryId, validFrom, validUntil, active, order } = data || {};
    if (!title || !title.trim()) {
        const err = new Error('El título de la promo es requerido');
        err.status = 400;
        throw err;
    }

    const baseId = slugify(title) || `promo-${Date.now()}`;
    let id = baseId;
    let suffix = 1;
    while (await Promo.findOne({ id })) {
        suffix += 1;
        id = `${baseId}-${suffix}`;
    }

    const maxOrder = await Promo.findOne().sort({ order: -1 }).lean();
    const promo = await Promo.create({
        id,
        title: title.trim(),
        description: (description || '').trim(),
        image: image || '',
        icon: icon || 'fa-fire',
        badgeText: (badgeText || '').trim(),
        badgeColor: badgeColor || '#ff6b00',
        discountPercent: Number(discountPercent) || 0,
        originalPrice: originalPrice != null && originalPrice !== '' ? Number(originalPrice) : null,
        promoPrice: promoPrice != null && promoPrice !== '' ? Number(promoPrice) : null,
        productIds: Array.isArray(productIds) ? productIds : [],
        categoryId: categoryId || '',
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        active: active !== false,
        order: typeof order === 'number' ? order : (maxOrder?.order || 0) + 1
    });
    return toClient(promo.toObject());
}

async function updatePromo(id, data) {
    const promo = await Promo.findOne({ id: id.toLowerCase() });
    if (!promo) {
        const err = new Error('Promo no encontrada');
        err.status = 404;
        throw err;
    }
    const fields = ['title', 'description', 'image', 'icon', 'badgeText', 'badgeColor', 'categoryId'];
    for (const f of fields) {
        if (typeof data[f] === 'string') promo[f] = data[f].trim();
    }
    if (typeof data.discountPercent !== 'undefined') promo.discountPercent = Number(data.discountPercent) || 0;
    if (typeof data.originalPrice !== 'undefined') {
        promo.originalPrice = data.originalPrice === null || data.originalPrice === '' ? null : Number(data.originalPrice);
    }
    if (typeof data.promoPrice !== 'undefined') {
        promo.promoPrice = data.promoPrice === null || data.promoPrice === '' ? null : Number(data.promoPrice);
    }
    if (Array.isArray(data.productIds)) promo.productIds = data.productIds;
    if (typeof data.validFrom !== 'undefined') promo.validFrom = data.validFrom ? new Date(data.validFrom) : null;
    if (typeof data.validUntil !== 'undefined') promo.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    if (typeof data.active === 'boolean') promo.active = data.active;
    if (typeof data.order === 'number') promo.order = data.order;
    await promo.save();
    return toClient(promo.toObject());
}

async function deletePromo(id) {
    const promo = await Promo.findOne({ id: id.toLowerCase() });
    if (!promo) {
        const err = new Error('Promo no encontrada');
        err.status = 404;
        throw err;
    }
    await Promo.deleteOne({ _id: promo._id });
    return { id: promo.id, title: promo.title };
}

module.exports = {
    listPromos,
    getPromo,
    createPromo,
    updatePromo,
    deletePromo,
    isPromoValid
};
