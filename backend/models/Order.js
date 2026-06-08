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
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
        cliente: {
            nombre: { type: String, required: true, trim: true },
            telefono: { type: String, required: true, trim: true },
            direccion: { type: String, required: true, trim: true },
            email: { type: String, trim: true, lowercase: true, default: '' }
        },
        productos: [orderItemSchema],
        totales: {
            subtotal: { type: Number, default: 0 },
            envio: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
            items: { type: Number, default: 0 }
        },
        notas: { type: String, trim: true, default: '' },
        tipo: { type: String, enum: ['local', 'delivery'], default: 'delivery', index: true },
        estado: {
            type: String,
            enum: ['pendiente', 'proceso', 'completado', 'cancelado'],
            default: 'pendiente',
            index: true
        },
        estadoHistorial: [{
            estado: String,
            fecha: { type: Date, default: Date.now },
            por: String
        }],
        fecha: { type: Date, default: Date.now, index: true }
    },
    { versionKey: false }
);

orderSchema.methods.toPublic = function toPublic() {
    return {
        id: this.orderId,
        orderId: this.orderId,
        userId: this.userId ? this.userId.toString() : null,
        cliente: this.cliente,
        productos: this.productos,
        totales: this.totales,
        notas: this.notas,
        tipo: this.tipo,
        estado: this.estado,
        estadoHistorial: this.estadoHistorial,
        fecha: this.fecha?.toISOString?.() || new Date().toISOString()
    };
};

module.exports = mongoose.model('Order', orderSchema);
