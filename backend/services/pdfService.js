const PDFDocument = require('pdfkit');

function buildInvoice(order, options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const chunks = [];
            doc.on('data', (c) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const accent = '#ff6b35';
            const dark = '#1f2937';
            const muted = '#6b7280';
            const light = '#f3f4f6';

            const fecha = order.fecha ? new Date(order.fecha) : new Date();

            doc.fillColor(dark).fontSize(26).text('Brazas$Mar', { align: 'left' });
            doc.moveDown(0.1);
            doc.fillColor(accent).fontSize(11).text('Sabor auténtico a la brasa', { align: 'left' });
            doc.moveDown(0.5);
            doc.fillColor(muted).fontSize(10).text('+507 6978-8286  |  Panamá, Darién, Metetí', { align: 'left' });
            doc.moveDown(1);

            doc.fillColor(dark).fontSize(20).text('Factura', { align: 'right' });
            doc.moveDown(0.1);
            doc.fillColor(muted).fontSize(10)
                .text(`Pedido: ${order.orderId}`, { align: 'right' })
                .text(`Fecha: ${fecha.toLocaleString('es-PA')}`, { align: 'right' })
                .text(`Estado: ${(order.estado || 'pendiente').toUpperCase()}`, { align: 'right' })
                .text(`Tipo: ${order.tipo === 'local' ? 'VENTA LOCAL' : 'DELIVERY'}`, { align: 'right' });
            doc.moveDown(1);

            doc.fillColor(dark).fontSize(13).text('Cliente', { underline: false });
            doc.moveDown(0.3);
            doc.fillColor(dark).fontSize(11)
                .text(order.cliente?.nombre || '—')
                .fillColor(muted)
                .text(`Tel: ${order.cliente?.telefono || '—'}`)
                .text(`Dir: ${order.cliente?.direccion || '—'}`);
            if (order.cliente?.email) {
                doc.fillColor(muted).text(`Email: ${order.cliente.email}`);
            }
            doc.moveDown(1);

            const tableTop = doc.y;
            const col = { name: 50, qty: 310, price: 380, total: 470 };
            doc.rect(50, tableTop, 500, 22).fill(accent);
            doc.fillColor('#ffffff').fontSize(11);
            doc.text('Producto', col.name, tableTop + 6, { width: 250 });
            doc.text('Cant.', col.qty, tableTop + 6, { width: 60, align: 'right' });
            doc.text('Precio', col.price, tableTop + 6, { width: 80, align: 'right' });
            doc.text('Total', col.total, tableTop + 6, { width: 80, align: 'right' });

            let y = tableTop + 28;
            doc.fillColor(dark).fontSize(10);
            (order.productos || []).forEach((p, i) => {
                if (i % 2 === 0) {
                    doc.rect(50, y - 4, 500, 22).fill(light);
                    doc.fillColor(dark);
                }
                const total = (p.precio || 0) * (p.cantidad || 0);
                doc.text(p.nombre || 'Producto', col.name, y, { width: 250 });
                doc.text(String(p.cantidad || 0), col.qty, y, { width: 60, align: 'right' });
                doc.text(`B/ ${(p.precio || 0).toFixed(2)}`, col.price, y, { width: 80, align: 'right' });
                doc.text(`B/ ${total.toFixed(2)}`, col.total, y, { width: 80, align: 'right' });
                y += 22;
            });

            y += 10;
            const totales = order.totales || {};
            const lineX = 320;
            const isLocal = order.tipo === 'local';
            doc.fillColor(muted);
            doc.text('Subtotal:', lineX, y, { width: 100, align: 'right' });
            doc.fillColor(dark).text(`B/ ${(totales.subtotal || 0).toFixed(2)}`, 430, y, { width: 120, align: 'right' });
            y += 18;
            if (!isLocal) {
                doc.fillColor(muted).text('Envío:', lineX, y, { width: 100, align: 'right' });
                doc.fillColor(dark).text(`B/ ${(totales.envio || 0).toFixed(2)}`, 430, y, { width: 120, align: 'right' });
                y += 18;
            }
            doc.fillColor(accent).fontSize(13).text('TOTAL:', lineX, y, { width: 100, align: 'right' });
            doc.fillColor(accent).text(`B/ ${(totales.total || 0).toFixed(2)}`, 430, y, { width: 120, align: 'right' });

            doc.moveDown(4);
            doc.fillColor(muted).fontSize(9)
                .text('Gracias por tu compra. Este documento es una representación impresa de tu pedido.', 50, 720, { align: 'center', width: 500 });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

function buildLocalSaleInvoice(sale) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const chunks = [];
            doc.on('data', (c) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const accent = '#ff6b35';
            const dark = '#1f2937';
            const muted = '#6b7280';
            const light = '#f3f4f6';

            const fecha = sale.fecha ? new Date(sale.fecha) : new Date();

            doc.fillColor(dark).fontSize(26).text('Brazas$Mar', { align: 'left' });
            doc.moveDown(0.1);
            doc.fillColor(accent).fontSize(11).text('Sabor auténtico a la brasa', { align: 'left' });
            doc.moveDown(0.5);
            doc.fillColor(muted).fontSize(10).text('+507 6978-8286  |  Panamá, Darién, Metetí', { align: 'left' });
            doc.moveDown(1);

            doc.fillColor(dark).fontSize(20).text('Factura - Venta Local', { align: 'right' });
            doc.moveDown(0.1);
            doc.fillColor(muted).fontSize(10)
                .text(`Venta: ${sale.saleId}`, { align: 'right' })
                .text(`Fecha: ${fecha.toLocaleString('es-PA')}`, { align: 'right' })
                .text(`Estado: ${(sale.estado || 'completado').toUpperCase()}`, { align: 'right' });
            if (sale.mesa) {
                doc.fillColor(muted).text(`Mesa: ${sale.mesa}`, { align: 'right' });
            }
            doc.moveDown(1);

            doc.fillColor(dark).fontSize(13).text('Cliente', { underline: false });
            doc.moveDown(0.3);
            doc.fillColor(dark).fontSize(11)
                .text(sale.cliente?.nombre || '—');
            if (sale.mesa) {
                doc.fillColor(muted).text(`Mesa: ${sale.mesa}`);
            }
            doc.moveDown(1);

            const tableTop = doc.y;
            const col = { name: 50, qty: 310, price: 380, total: 470 };
            doc.rect(50, tableTop, 500, 22).fill(accent);
            doc.fillColor('#ffffff').fontSize(11);
            doc.text('Producto', col.name, tableTop + 6, { width: 250 });
            doc.text('Cant.', col.qty, tableTop + 6, { width: 60, align: 'right' });
            doc.text('Precio', col.price, tableTop + 6, { width: 80, align: 'right' });
            doc.text('Total', col.total, tableTop + 6, { width: 80, align: 'right' });

            let y = tableTop + 28;
            doc.fillColor(dark).fontSize(10);
            (sale.productos || []).forEach((p, i) => {
                if (i % 2 === 0) {
                    doc.rect(50, y - 4, 500, 22).fill(light);
                    doc.fillColor(dark);
                }
                const total = (p.precio || 0) * (p.cantidad || 0);
                doc.text(p.nombre || 'Producto', col.name, y, { width: 250 });
                doc.text(String(p.cantidad || 0), col.qty, y, { width: 60, align: 'right' });
                doc.text(`B/ ${(p.precio || 0).toFixed(2)}`, col.price, y, { width: 80, align: 'right' });
                doc.text(`B/ ${total.toFixed(2)}`, col.total, y, { width: 80, align: 'right' });
                y += 22;
            });

            y += 10;
            const totales = sale.totales || {};
            const lineX = 320;
            doc.fillColor(muted);
            doc.text('Subtotal:', lineX, y, { width: 100, align: 'right' });
            doc.fillColor(dark).text(`B/ ${(totales.subtotal || 0).toFixed(2)}`, 430, y, { width: 120, align: 'right' });
            y += 18;
            doc.fillColor(accent).fontSize(13).text('TOTAL:', lineX, y, { width: 100, align: 'right' });
            doc.fillColor(accent).text(`B/ ${(totales.total || 0).toFixed(2)}`, 430, y, { width: 120, align: 'right' });

            if (sale.notas) {
                y += 30;
                doc.fillColor(muted).fontSize(9).text(`Notas: ${sale.notas}`, 50, y, { width: 500 });
            }

            doc.moveDown(4);
            doc.fillColor(muted).fontSize(9)
                .text('Gracias por tu compra. Este documento es una representación impresa de tu venta.', 50, 720, { align: 'center', width: 500 });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { buildInvoice, buildLocalSaleInvoice };
