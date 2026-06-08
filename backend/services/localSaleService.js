const LocalSale = require('../models/LocalSale');

function generateSaleId() {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.floor(Math.random() * 0xfff).toString(16).toUpperCase().padStart(3, '0');
    return `VL-${stamp}-${rand}`;
}

async function createLocalSale(payload) {
    const saleId = generateSaleId();
    const doc = await LocalSale.create({
        saleId,
        mesa: payload.mesa || '',
        cliente: {
            nombre: payload.cliente?.nombre || 'Cliente local'
        },
        productos: payload.productos,
        totales: {
            subtotal: payload.total || 0,
            envio: 0,
            total: payload.total || 0,
            items: payload.productos.reduce((s, i) => s + (i.cantidad || 1), 0)
        },
        notas: payload.notas || '',
        estado: 'completado',
        fecha: new Date()
    });
    return doc.toPublic();
}

async function listLocalSales(filter = {}) {
    const sales = await LocalSale.find(filter).sort({ fecha: -1 }).lean();
    return sales.map((s) => ({
        id: s.saleId,
        saleId: s.saleId,
        mesa: s.mesa,
        cliente: s.cliente,
        productos: s.productos,
        totales: s.totales,
        notas: s.notas,
        estado: s.estado,
        fecha: s.fecha
    }));
}

async function findLocalSale(saleId) {
    const doc = await LocalSale.findOne({ saleId });
    return doc ? doc.toPublic() : null;
}

async function updateLocalSale(saleId, data) {
    const update = {};
    if (data.mesa !== undefined) update.mesa = data.mesa;
    if (data.cliente) update.cliente = data.cliente;
    if (data.productos) update.productos = data.productos;
    if (data.notas !== undefined) update.notas = data.notas;
    if (data.estado) update.estado = data.estado;

    if (data.productos && data.total !== undefined) {
        update.totales = {
            subtotal: data.total,
            envio: 0,
            total: data.total,
            items: data.productos.reduce((s, i) => s + (i.cantidad || 1), 0)
        };
    }

    const doc = await LocalSale.findOneAndUpdate(
        { saleId },
        { $set: update },
        { new: true }
    );
    return doc ? doc.toPublic() : null;
}

async function deleteLocalSale(saleId) {
    const doc = await LocalSale.findOneAndDelete({ saleId });
    return doc ? doc.toPublic() : null;
}

async function getLocalSalesStats() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalSales, todaySales, monthSales, agg] = await Promise.all([
        LocalSale.countDocuments(),
        LocalSale.aggregate([
            { $match: { fecha: { $gte: todayStart }, estado: 'completado' } },
            { $group: { _id: null, total: { $sum: '$totales.total' }, count: { $sum: 1 } } }
        ]),
        LocalSale.aggregate([
            { $match: { fecha: { $gte: monthStart }, estado: 'completado' } },
            { $group: { _id: null, total: { $sum: '$totales.total' }, count: { $sum: 1 } } }
        ]),
        LocalSale.aggregate([
            { $match: { estado: 'completado' } },
            { $group: { _id: null, total: { $sum: '$totales.total' }, count: { $sum: 1 } } }
        ])
    ]);

    return {
        totalSales,
        todayTotal: todaySales[0]?.total || 0,
        todayCount: todaySales[0]?.count || 0,
        monthTotal: monthSales[0]?.total || 0,
        monthCount: monthSales[0]?.count || 0,
        allTimeTotal: agg[0]?.total || 0,
        allTimeCount: agg[0]?.count || 0
    };
}

module.exports = {
    createLocalSale,
    listLocalSales,
    findLocalSale,
    updateLocalSale,
    deleteLocalSale,
    getLocalSalesStats
};
