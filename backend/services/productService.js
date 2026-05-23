const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Product = require('../models/Product');
const { CATEGORIES } = require('../models/Product');

function emptyMenu() {
    return { hamburguesas: [], especiales: [], cerdo: [] };
}

async function getMenuGrouped() {
    const menu = emptyMenu();
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
        if (menu[doc.categoria]) {
            menu[doc.categoria].push(item);
        }
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

    for (const categoria of CATEGORIES) {
        const list = menu[categoria] || [];
        for (const p of list) {
            docs.push({
                productId: p.id || uuidv4(),
                nombre: p.nombre,
                descripcion: p.descripcion,
                precio: String(p.precio),
                categoria: p.categoria || categoria,
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

function isValidCategory(category) {
    return CATEGORIES.includes(category);
}

module.exports = {
    getMenuGrouped,
    findByProductId,
    createProduct,
    updateProduct,
    deleteProduct,
    seedFromJsonIfEmpty,
    isValidCategory,
    CATEGORIES
};
