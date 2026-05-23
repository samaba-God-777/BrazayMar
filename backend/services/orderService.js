const Order = require('../models/Order');

function generateOrderId() {
    return `PED-${Date.now().toString().slice(-8)}`;
}

async function createOrder(payload) {
    const orderId = payload.orderId || generateOrderId();

    const doc = await Order.create({
        orderId,
        cliente: payload.cliente,
        productos: payload.productos,
        totales: payload.totales,
        estado: 'pendiente',
        fecha: new Date()
    });

    return doc.toPublic();
}

async function listOrders() {
    const orders = await Order.find().sort({ fecha: -1 }).lean();
    return orders.map((o) => ({
        id: o.orderId,
        orderId: o.orderId,
        cliente: o.cliente,
        productos: o.productos,
        totales: o.totales,
        estado: o.estado,
        fecha: o.fecha
    }));
}

async function updateOrderStatus(orderId, estado) {
    const doc = await Order.findOneAndUpdate(
        { orderId },
        { estado },
        { new: true }
    );
    if (!doc) return null;
    return doc.toPublic();
}

async function getOrderStats() {
    const [total, pendientes] = await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ estado: 'pendiente' })
    ]);

    const latest = await Order.findOne().sort({ fecha: -1 }).lean();

    return {
        total,
        pendientes,
        latestOrderId: latest?.orderId || null,
        latestFecha: latest?.fecha || null
    };
}

module.exports = {
    createOrder,
    listOrders,
    updateOrderStatus,
    generateOrderId,
    getOrderStats
};
