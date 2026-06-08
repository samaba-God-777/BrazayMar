const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Product = require('../models/Product');
const categoryService = require('./categoryService');

async function getMenuGrouped() {
    const categories = await categoryService.listCategories();
    const menu = {
        categories: categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, order: c.order })),
        items: {}
    };
    for (const c of categories) menu.items[c.id] = [];

    const products = await Product.find().sort({ fechaCreacion: -1 }).lean();

    for (const doc of products) {
        const item = {
            id: doc.productId,
            nombre: doc.nombre,
            descripcion: doc.descripcion,
            precio: doc.precio,
            categoria: doc.categoria,
            imagen: doc.imagen,
            destacado: doc.destacado,
            descuento: doc.descuento,
            rating: doc.rating,
            fechaCreacion: doc.fechaCreacion,
            fechaActualizacion: doc.fechaActualizacion
        };
        const key = doc.categoria;
        if (!menu.items[key]) menu.items[key] = [];
        menu.items[key].push(item);
    }

    return menu;
}

async function findByProductId(productId) {
    const doc = await Product.findOne({ productId });
    if (!doc) return null;
    return doc.toMenuItem();
}

async function createProduct(data) {
    const productId = uuidv4();
    const doc = await Product.create({
        productId,
        nombre: data.nombre,
        descripcion: data.descripcion,
        precio: data.precio,
        categoria: data.categoria,
        imagen: data.imagen,
        destacado: data.destacado,
        descuento: data.descuento,
        rating: data.rating
    });
    return doc.toMenuItem();
}

async function updateProduct(productId, data) {
    const doc = await Product.findOneAndUpdate(
        { productId },
        {
            ...data,
            fechaActualizacion: new Date()
        },
        { new: true }
    );
    if (!doc) return null;
    return doc.toMenuItem();
}

async function deleteProduct(productId) {
    const doc = await Product.findOneAndDelete({ productId });
    if (!doc) return null;
    return doc.toMenuItem();
}

async function seedFromJsonIfEmpty(menuPath) {
    const count = await Product.countDocuments();
    if (count > 0) {
        console.log(`📦 MongoDB: ${count} productos en base de datos`);
        return;
    }

    if (!fs.existsSync(menuPath)) {
        console.log('📦 MongoDB: sin productos y sin menu.json para migrar');
        return;
    }

    const menu = JSON.parse(fs.readFileSync(menuPath, 'utf-8'));
    const docs = [];

    for (const categoria of Object.keys(menu)) {
        const list = menu[categoria] || [];
        for (const p of list) {
            docs.push({
                productId: p.id || uuidv4(),
                nombre: p.nombre,
                descripcion: p.descripcion,
                precio: String(p.precio),
                categoria: String(p.categoria || categoria).toLowerCase(),
                imagen: p.imagen || '/images/placeholder.png',
                destacado: !!p.destacado,
                descuento: p.descuento || 0,
                rating: p.rating || '4.5',
                fechaCreacion: p.fechaCreacion ? new Date(p.fechaCreacion) : new Date()
            });
        }
    }

    if (docs.length > 0) {
        await Product.insertMany(docs);
        console.log(`✅ Migrados ${docs.length} productos desde menu.json a MongoDB`);
    }
}

async function isValidCategory(category) {
    if (!category) return false;
    const cats = await categoryService.listCategories();
    return cats.some((c) => c.id === String(category).toLowerCase());
}

module.exports = {
    getMenuGrouped,
    findByProductId,
    createProduct,
    updateProduct,
    deleteProduct,
    seedFromJsonIfEmpty,
    isValidCategory
};
