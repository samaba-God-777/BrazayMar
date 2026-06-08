const mongoose = require('mongoose');

const localSaleItemSchema = new mongoose.Schema(
    {
        id: String,
        nombre: String,
        precio: Number,
        cantidad: Number,
        categoria: String,
        imagen: String
    },
    { _id: false }
);

const localSaleSchema = new mongoose.Schema(
    {
        saleId: { type: String, required: true, unique: true, index: true },
        mesa: { type: String, trim: true, default: '' },
        cliente: {
            nombre: { type: String, required: true, trim: true }
        },
        productos: [localSaleItemSchema],
        totales: {
            subtotal: { type: Number, default: 0 },
            envio: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
            items: { type: Number, default: 0 }
        },
        notas: { type: String, trim: true, default: '' },
        estado: {
            type: String,
            enum: ['completado', 'cancelado'],
            default: 'completado',
            index: true
        },
        fecha: { type: Date, default: Date.now, index: true }
    },
    { versionKey: false }
);

localSaleSchema.methods.toPublic = function toPublic() {
    return {
        id: this.saleId,
        saleId: this.saleId,
        mesa: this.mesa,
        cliente: this.cliente,
        productos: this.productos,
        totales: this.totales,
        notas: this.notas,
        estado: this.estado,
        fecha: this.fecha?.toISOString?.() || new Date().toISOString()
    };
};

module.exports = mongoose.model('LocalSale', localSaleSchema);
