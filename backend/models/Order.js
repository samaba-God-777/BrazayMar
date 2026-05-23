const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
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

const orderSchema = new mongoose.Schema(
    {
        orderId: { type: String, required: true, unique: true, index: true },
        cliente: {
            nombre: { type: String, required: true },
            telefono: { type: String, required: true },
            direccion: { type: String, required: true }
        },
        productos: [orderItemSchema],
        totales: {
            subtotal: { type: Number, default: 0 },
            envio: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
            items: { type: Number, default: 0 }
        },
        estado: {
            type: String,
            enum: ['pendiente', 'proceso', 'completado', 'cancelado'],
            default: 'pendiente',
            index: true
        },
        fecha: { type: Date, default: Date.now, index: true }
    },
    { versionKey: false }
);

orderSchema.methods.toPublic = function toPublic() {
    return {
        id: this.orderId,
        orderId: this.orderId,
        cliente: this.cliente,
        productos: this.productos,
        totales: this.totales,
        estado: this.estado,
        fecha: this.fecha?.toISOString?.() || new Date().toISOString()
    };
};

module.exports = mongoose.model('Order', orderSchema);
