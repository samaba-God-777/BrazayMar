/**
 * Script para migrar datos locales (JSON) a MongoDB Atlas
 * Uso: node migrate-to-atlas.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Modelos
const Product = require('./backend/models/Product');
const Order = require('./backend/models/Order');

const MONGODB_URI = process.env.MONGODB_URI;

async function migrateData() {
    try {
        console.log('🔄 Conectando a MongoDB Atlas...');
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 8000
        });
        console.log('✅ Conectado a MongoDB Atlas');

        // Limpiar colecciones existentes
        console.log('\n🧹 Limpiando colecciones existentes...');
        await Product.deleteMany({});
        await Order.deleteMany({});
        console.log('✅ Colecciones limpiadas');

        // Migrar productos
        console.log('\n📦 Migrando productos...');
        const menuPath = path.join(__dirname, 'backend/data/menu.json');
        if (fs.existsSync(menuPath)) {
            const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
            let productCount = 0;

            for (const [categoria, productos] of Object.entries(menuData)) {
                for (const product of productos) {
                    await Product.create({
                        productId: product.id,
                        nombre: product.nombre,
                        descripcion: product.descripcion,
                        precio: product.precio,
                        categoria: product.categoria,
                        imagen: product.imagen,
                        destacado: product.destacado || false,
                        descuento: product.descuento || 0,
                        rating: product.rating || '4.5',
                        fechaCreacion: product.fechaCreacion
                    });
                    productCount++;
                }
            }
            console.log(`✅ ${productCount} productos migrados`);
        } else {
            console.log('⚠️  No se encontró menu.json');
        }

        // Migrar pedidos
        console.log('\n📋 Migrando pedidos...');
        const ordersPath = path.join(__dirname, 'backend/orders.json');
        if (fs.existsSync(ordersPath)) {
            const ordersData = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
            const orderCount = ordersData.orders ? ordersData.orders.length : 0;

            if (ordersData.orders && ordersData.orders.length > 0) {
                await Order.insertMany(ordersData.orders);
                console.log(`✅ ${orderCount} pedidos migrados`);
            } else {
                console.log('ℹ️  No hay pedidos para migrar');
            }
        } else {
            console.log('ℹ️  No se encontró orders.json');
        }

        console.log('\n🎉 ¡Migración completada exitosamente!');
        console.log(`📊 Base de datos: ${mongoose.connection.name}`);
        console.log(`🌍 Host: ${mongoose.connection.host}`);

    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Conexión cerrada');
    }
}

migrateData();
