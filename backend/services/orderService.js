const Order = require('../models/Order');

function generateOrderId() {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.floor(Math.random() * 0xfff).toString(16).toUpperCase().padStart(3, '0');
    return `PED-${stamp}-${rand}`;
}

async function createOrder(payload) {
    const orderId = payload.orderId || generateOrderId();
    const doc = await Order.create({
        orderId,
        userId: payload.userId || null,
        cliente: payload.cliente,
        productos: payload.productos,
        totales: payload.totales || {},
        notas: payload.notas || '',
        tipo: payload.tipo || 'delivery',
        estado: 'pendiente',
        estadoHistorial: [{ estado: 'pendiente', fecha: new Date(), por: payload.userId ? 'cliente' : 'guest' }],
        fecha: new Date()
    });
    return doc.toPublic();
}

async function createLocalOrder(payload) {
    const orderId = generateOrderId();
    const doc = await Order.create({
        orderId,
        userId: null,
        cliente: {
            nombre: payload.cliente?.nombre || 'Cliente local',
            telefono: payload.cliente?.telefono || 'N/A',
            direccion: payload.cliente?.direccion || 'Local',
            email: payload.cliente?.email || ''
        },
        productos: payload.productos,
        totales: {
            subtotal: payload.total || 0,
            envio: 0,
            total: payload.total || 0,
            items: payload.productos.reduce((s, i) => s + (i.cantidad || 1), 0)
        },
        notas: payload.notas || '',
        tipo: 'local',
        estado: 'completado',
        estadoHistorial: [{ estado: 'completado', fecha: new Date(), por: 'admin' }],
        fecha: new Date()
    });
    return doc.toPublic();
}

async function listOrders(filter = {}) {
    const orders = await Order.find(filter).sort({ fecha: -1 }).lean();
    return orders.map((o) => ({
        id: o.orderId,
        orderId: o.orderId,
        userId: o.userId ? o.userId.toString() : null,
        cliente: o.cliente,
        productos: o.productos,
        totales: o.totales,
        notas: o.notas,
        tipo: o.tipo,
        estado: o.estado,
        estadoHistorial: o.estadoHistorial,
        fecha: o.fecha
    }));
}

async function listOrdersByUser(userId) {
    const orders = await Order.find({ userId }).sort({ fecha: -1 }).lean();
    return orders.map((o) => ({
        id: o.orderId,
        orderId: o.orderId,
        userId: o.userId ? o.userId.toString() : null,
        cliente: o.cliente,
        productos: o.productos,
        totales: o.totales,
        notas: o.notas,
        tipo: o.tipo,
        estado: o.estado,
        estadoHistorial: o.estadoHistorial,
        fecha: o.fecha
    }));
}

async function findOrder(orderId) {
    const doc = await Order.findOne({ orderId });
    return doc ? doc.toPublic() : null;
}

async function updateOrderStatus(orderId, estado, por = 'admin') {
    const doc = await Order.findOneAndUpdate(
        { orderId },
        {
            estado,
            $push: { estadoHistorial: { estado, fecha: new Date(), por } }
        },
        { new: true }
    );
    if (!doc) return null;
    return doc.toPublic();
}

async function deleteOrder(orderId) {
    const doc = await Order.findOneAndDelete({ orderId });
    return doc ? doc.toPublic() : null;
}

async function getOrderStats() {
    const [total, pendientes, enProceso, completados, cancelados, agg, localCount, deliveryCount] = await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ estado: 'pendiente' }),
        Order.countDocuments({ estado: 'proceso' }),
        Order.countDocuments({ estado: 'completado' }),
        Order.countDocuments({ estado: 'cancelado' }),
        Order.aggregate([
            {
                $group: {
                    _id: null,
                    revenue: {
                        $sum: {
                            $cond: [{ $eq: ['$estado', 'completado'] }, '$totales.total', 0]
                        }
                    },
                    avgTicket: { $avg: '$totales.total' }
                }
            }
        ]),
        Order.countDocuments({ tipo: 'local' }),
        Order.countDocuments({ tipo: 'delivery' })
    ]);

    const latest = await Order.findOne().sort({ fecha: -1 }).lean();

    return {
        total,
        porEstado: { pendientes, enProceso, completados, cancelados },
        revenue: agg[0]?.revenue || 0,
        avgTicket: agg[0]?.avgTicket || 0,
        latestOrderId: latest?.orderId || null,
        latestFecha: latest?.fecha || null,
        localCount,
        deliveryCount
    };
}

function startOfDay(d = new Date()) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function startOfWeek(d = new Date()) {
    const x = startOfDay(d);
    const day = x.getDay();
    x.setDate(x.getDate() - day);
    return x;
}

function startOfMonth(d = new Date()) {
    const x = startOfDay(d);
    x.setDate(1);
    return x;
}

function startOfYear(d = new Date()) {
    const x = startOfDay(d);
    x.setMonth(0, 1);
    return x;
}

async function getSalesAnalytics({ from, to } = {}) {
    const now = new Date();
    const rangeEnd = to ? new Date(to) : now;
    const dayStart = startOfDay(rangeEnd);
    const weekStart = startOfWeek(rangeEnd);
    const monthStart = startOfMonth(rangeEnd);
    const yearStart = startOfYear(rangeEnd);
    const rangeStart = from ? new Date(from) : monthStart;

    async function bucket(start, tipoFilter = null) {
        const match = { fecha: { $gte: start, $lte: rangeEnd } };
        if (tipoFilter) match.tipo = tipoFilter;
        const result = await Order.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$estado',
                    count: { $sum: 1 },
                    total: { $sum: '$totales.total' },
                    items: { $sum: '$totales.items' }
                }
            }
        ]);
        const summary = { count: 0, revenue: 0, items: 0, avg: 0 };
        for (const r of result) {
            summary.count += r.count;
            summary.items += r.items;
            if (r._id === 'completado') summary.revenue += r.total;
        }
        summary.avg = summary.count > 0 ? summary.revenue / summary.count : 0;
        return summary;
    }

    const [daily, weekly, monthly, yearly, custom, localDaily, localWeekly, localMonthly] = await Promise.all([
        bucket(dayStart),
        bucket(weekStart),
        bucket(monthStart),
        bucket(yearStart),
        bucket(rangeStart),
        bucket(dayStart, 'local'),
        bucket(weekStart, 'local'),
        bucket(monthStart, 'local')
    ]);

    const topProducts = await Order.aggregate([
        { $match: { fecha: { $gte: monthStart, $lte: rangeEnd } } },
        { $unwind: '$productos' },
        {
            $group: {
                _id: '$productos.nombre',
                cantidad: { $sum: '$productos.cantidad' },
                ingresos: { $sum: { $multiply: ['$productos.precio', '$productos.cantidad'] } }
            }
        },
        { $sort: { cantidad: -1 } },
        { $limit: 5 }
    ]);

    return {
        generatedAt: now.toISOString(),
        range: { from: rangeStart.toISOString(), to: rangeEnd.toISOString() },
        daily,
        weekly,
        monthly,
        yearly,
        custom,
        local: { daily: localDaily, weekly: localWeekly, monthly: localMonthly },
        topProducts: topProducts.map((p) => ({
            nombre: p._id,
            cantidad: p.cantidad,
            ingresos: p.ingresos
        }))
    };
}

module.exports = {
    createOrder,
    createLocalOrder,
    listOrders,
    listOrdersByUser,
    findOrder,
    updateOrderStatus,
    deleteOrder,
    getOrderStats,
    getSalesAnalytics,
    generateOrderId
};
