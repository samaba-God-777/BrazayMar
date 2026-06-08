const mongoose = require('mongoose');

const CATEGORIES = []; // Legacy: ahora las categorías son dinámicas (ver Category.js)

const productSchema = new mongoose.Schema(
    {
        productId: { type: String, required: true, unique: true, index: true },
        nombre: { type: String, required: true, trim: true },
        descripcion: { type: String, required: true, trim: true },
        precio: { type: String, required: true },
        categoria: { type: String, required: true, index: true, lowercase: true, trim: true },
        imagen: { type: String, default: '/images/placeholder.png' },
        destacado: { type: Boolean, default: false },
        descuento: { type: Number, default: 0, min: 0, max: 50 },
        rating: { type: String, default: '4.5' },
        fechaCreacion: { type: Date, default: Date.now },
        fechaActualizacion: { type: Date }
    },
    { versionKey: false }
);

productSchema.methods.toMenuItem = function toMenuItem() {
    return {
        id: this.productId,
        nombre: this.nombre,
        descripcion: this.descripcion,
        precio: this.precio,
        categoria: this.categoria,
        imagen: this.imagen,
        destacado: this.destacado,
        descuento: this.descuento,
        rating: this.rating,
        fechaCreacion: this.fechaCreacion?.toISOString?.() || new Date().toISOString(),
        fechaActualizacion: this.fechaActualizacion?.toISOString?.()
    };
};

module.exports = mongoose.model('Product', productSchema);
module.exports.CATEGORIES = CATEGORIES;
