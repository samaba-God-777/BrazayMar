require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const authService = require('./services/authService');
const { connectDatabase } = require('./config/database');
const productService = require('./services/productService');
const orderService = require('./services/orderService');
const pdfService = require('./services/pdfService');
const categoryService = require('./services/categoryService');
const promoService = require('./services/promoService');
const contactService = require('./services/contactService');
const localSaleService = require('./services/localSaleService');

const app = express();

const corsOrigins = (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const frontendImagesDir = path.join(__dirname, '../frontend/images');
if (!fs.existsSync(frontendImagesDir)) {
    fs.mkdirSync(frontendImagesDir, { recursive: true });
}

const menuPath = path.join(dataDir, 'menu.json');

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uuidv4()}${ext}`);
    }
});

const fileFilter = (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

app.use('/uploads', express.static(uploadsDir));
app.use('/images', express.static(path.join(__dirname, '../frontend/images')));

function parseDestacado(value) {
    return value === 'true' || value === 'on' || value === true || value === '1';
}

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' }
});

const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api', generalLimiter);

// ============== AUTENTICACIÓN ==============

app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password, name, phone, address } = req.body || {};
        const user = await authService.registerCustomer({ username, email, password, name, phone, address });
        res.status(201).json({
            message: '✅ Cuenta creada correctamente',
            token: authService.createToken(user),
            user: user.toPublic()
        });
    } catch (error) {
        console.error('Error registrando usuario:', error.message);
        res.status(error.status || 500).json({ error: error.message || 'Error al registrar usuario' });
    }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { identifier, username, email, password } = req.body || {};
        const id = identifier || username || email;
        if (!id || !password) {
            return res.status(400).json({ error: 'Usuario/email y contraseña son requeridos' });
        }
        const user = await authService.authenticateUser(id, password);
        if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
        res.json({
            message: 'Sesión iniciada',
            token: authService.createToken(user),
            user: user.toPublic()
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

app.get('/api/auth/me', authService.requireAuth, async (req, res) => {
    const user = await authService.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user: user.toPublic() });
});

app.put('/api/auth/profile', authService.requireAuth, async (req, res) => {
    try {
        const user = await authService.updateProfile(req.user.id, req.body || {});
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ message: 'Perfil actualizado', user: user.toPublic() });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Error al actualizar perfil' });
    }
});

app.put('/api/auth/password', authService.requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        await authService.changePassword(req.user.id, currentPassword, newPassword);
        res.json({ message: 'Contraseña actualizada' });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Error al cambiar contraseña' });
    }
});

app.post('/api/auth/logout', (_req, res) => {
    res.json({ message: 'Sesión cerrada' });
});

// ============== MENÚ / PRODUCTOS ==============

app.get('/api/menu', async (_req, res) => {
    try {
        const menu = await productService.getMenuGrouped();
        res.json(menu);
    } catch (error) {
        console.error('Error leyendo menú:', error);
        res.status(500).json({ error: 'Error al cargar el menú' });
    }
});

// ============== CATEGORÍAS ==============

app.get('/api/categories', async (_req, res) => {
    try {
        const categories = await categoryService.listCategories();
        res.json(categories);
    } catch (error) {
        console.error('Error listando categorías:', error);
        res.status(500).json({ error: 'Error al listar categorías' });
    }
});

app.post('/api/categories', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const cat = await categoryService.createCategory(req.body || {});
        res.status(201).json({ message: '✅ Categoría creada', category: cat });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Error al crear categoría' });
    }
});

app.put('/api/categories/:id', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const cat = await categoryService.updateCategory(req.params.id, req.body || {});
        res.json({ message: 'Categoría actualizada', category: cat });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Error al actualizar categoría' });
    }
});

app.delete('/api/categories/:id', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const reassignTo = req.query.reassignTo || req.body?.reassignTo || null;
        const result = await categoryService.deleteCategory(req.params.id, { reassignTo });
        res.json({ message: 'Categoría eliminada', ...result });
    } catch (error) {
        res.status(error.status || 500).json({
            error: error.message,
            productCount: error.productCount
        });
    }
});

// ============== PROMOS ==============

app.get('/api/promos', async (req, res) => {
    try {
        const user = authService.getUserFromRequest(req);
        const isAdmin = user?.role === 'admin';
        const includeInactive = isAdmin && req.query.includeInactive === 'true';
        const promos = await promoService.listPromos({ includeInactive });
        res.json(promos);
    } catch (error) {
        console.error('Error listando promos:', error);
        res.status(500).json({ error: 'Error al listar promos' });
    }
});

app.get('/api/promos/:id', async (req, res) => {
    try {
        const promo = await promoService.getPromo(req.params.id);
        if (!promo) return res.status(404).json({ error: 'Promo no encontrada' });
        res.json(promo);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la promo' });
    }
});

app.post('/api/promos', authService.requireAuth, authService.requireRole('admin'), upload.single('image'), async (req, res) => {
    try {
        let imageUrl = req.body.image || '';
        if (req.file) imageUrl = `/uploads/${req.file.filename}`;
        const data = { ...req.body, image: imageUrl };
        if (typeof data.productIds === 'string' && data.productIds) {
            data.productIds = data.productIds.split(',').map((s) => s.trim()).filter(Boolean);
        }
        const promo = await promoService.createPromo(data);
        res.status(201).json({ message: '✅ Promo creada', promo });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Error al crear la promo' });
    }
});

app.put('/api/promos/:id', authService.requireAuth, authService.requireRole('admin'), upload.single('image'), async (req, res) => {
    try {
        const data = { ...req.body };
        if (req.file) data.image = `/uploads/${req.file.filename}`;
        if (typeof data.productIds === 'string') {
            data.productIds = data.productIds.split(',').map((s) => s.trim()).filter(Boolean);
        }
        const promo = await promoService.updatePromo(req.params.id, data);
        res.json({ message: '✅ Promo actualizada', promo });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Error al actualizar la promo' });
    }
});

app.delete('/api/promos/:id', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const result = await promoService.deletePromo(req.params.id);
        res.json({ message: 'Promo eliminada', ...result });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Error al eliminar la promo' });
    }
});

// ============== CONTACTO ==============

app.get('/api/contact', async (_req, res) => {
    try {
        const contact = await contactService.getContact();
        res.json(contact);
    } catch (error) {
        console.error('Error leyendo contacto:', error);
        res.status(500).json({ error: 'Error al cargar el contacto' });
    }
});

app.put('/api/contact', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const contact = await contactService.updateContact(req.body || {});
        res.json({ message: '✅ Contacto actualizado', contact });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Error al actualizar el contacto' });
    }
});

app.get('/api/products/:id', authService.requireAuth, async (req, res) => {
    try {
        const product = await productService.findByProductId(req.params.id);
        if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(product);
    } catch (error) {
        console.error('Error obteniendo producto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/products', authService.requireAuth, authService.requireRole('admin'), upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, category, destacado, featured, descuento, rating } = req.body;

        if (!name || !description || !price || !category) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }
        if (!await productService.isValidCategory(category)) {
            return res.status(400).json({ error: 'Categoría inválida o no existe' });
        }

        let imagenUrl = '/images/placeholder.png';
        if (req.file) imagenUrl = `/uploads/${req.file.filename}`;

        const newProduct = await productService.createProduct({
            nombre: name,
            descripcion: description,
            precio: parseFloat(price).toFixed(2),
            categoria: category,
            imagen: imagenUrl,
            destacado: parseDestacado(destacado ?? featured),
            descuento: descuento ? parseInt(descuento, 10) : 0,
            rating: rating || '4.5'
        });

        res.status(201).json({ message: '✅ Producto agregado correctamente', product: newProduct });
    } catch (error) {
        console.error('Error agregando producto:', error);
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
});

app.put('/api/products/:id', authService.requireAuth, authService.requireRole('admin'), upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, category, destacado, featured, descuento, rating } = req.body;

        if (!name || !description || !price || !category) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }
        if (!await productService.isValidCategory(category)) {
            return res.status(400).json({ error: 'Categoría inválida o no existe' });
        }

        const existing = await productService.findByProductId(id);
        if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

        const updateData = {
            nombre: name,
            descripcion: description,
            precio: parseFloat(price).toFixed(2),
            categoria: category,
            destacado: parseDestacado(destacado ?? featured),
            descuento: descuento ? parseInt(descuento, 10) : 0,
            rating: rating || existing.rating || '4.5'
        };

        if (req.file) {
            const oldImage = existing.imagen;
            if (oldImage && oldImage.startsWith('/uploads/')) {
                const oldPath = path.join(uploadsDir, path.basename(oldImage));
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            updateData.imagen = `/uploads/${req.file.filename}`;
        }

        const updated = await productService.updateProduct(id, updateData);
        res.json({ message: '✅ Producto actualizado correctamente', product: updated });
    } catch (error) {
        console.error('Error actualizando producto:', error);
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
});

app.delete('/api/products/:id', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const deleted = await productService.deleteProduct(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Producto no encontrado' });

        const imageToDelete = deleted.imagen;
        if (imageToDelete && imageToDelete.startsWith('/uploads/')) {
            const imagePath = path.join(uploadsDir, path.basename(imageToDelete));
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        }

        res.json({ message: '✅ Producto eliminado correctamente' });
    } catch (error) {
        console.error('Error eliminando producto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============== PEDIDOS ==============

app.post('/api/orders', authLimiter, async (req, res) => {
    try {
        const { cliente, productos, totales, notas, userId: bodyUserId } = req.body;

        if (!cliente?.nombre || !cliente?.telefono || !cliente?.direccion) {
            return res.status(400).json({ error: 'Datos del cliente incompletos' });
        }
        if (!Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ error: 'El pedido no tiene productos' });
        }

        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        const session = authService.verifyToken(token);
        const userId = session?.id || bodyUserId || null;

        const order = await orderService.createOrder({
            userId,
            cliente,
            productos,
            totales: totales || {},
            notas: notas || '',
            tipo: 'delivery'
        });

        console.log('📋 Nuevo pedido en MongoDB:', order.orderId, userId ? `(user ${userId})` : '(guest)');
        res.status(201).json({
            success: true,
            message: 'Pedido registrado correctamente',
            orderId: order.orderId,
            order
        });
    } catch (error) {
        console.error('Error creando pedido:', error);
        res.status(500).json({ error: 'No se pudo registrar el pedido' });
    }
});

app.get('/api/orders/stats', authService.requireAuth, authService.requireRole('admin'), async (_req, res) => {
    try {
        const stats = await orderService.getOrderStats();
        res.json(stats);
    } catch (error) {
        console.error('Error en stats pedidos:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

app.get('/api/orders', authService.requireAuth, async (req, res) => {
    try {
        const filter = {};
        if (req.query.tipo) filter.tipo = req.query.tipo;
        if (req.user.role === 'admin') {
            const orders = await orderService.listOrders(filter);
            return res.json(orders);
        }
        const orders = await orderService.listOrdersByUser(req.user.id);
        res.json(orders);
    } catch (error) {
        console.error('Error listando pedidos:', error);
        res.status(500).json({ error: 'Error al cargar pedidos' });
    }
});

app.get('/api/orders/:id', authService.requireAuth, async (req, res) => {
    try {
        const order = await orderService.findOrder(req.params.id);
        if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
        if (req.user.role !== 'admin' && order.userId !== req.user.id) {
            return res.status(403).json({ error: 'No autorizado para ver este pedido' });
        }
        res.json(order);
    } catch (error) {
        console.error('Error obteniendo pedido:', error);
        res.status(500).json({ error: 'Error al obtener pedido' });
    }
});

app.patch('/api/orders/:id/status', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const { estado } = req.body;
        const valid = ['pendiente', 'proceso', 'completado', 'cancelado'];
        if (!valid.includes(estado)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }

        const order = await orderService.updateOrderStatus(req.params.id, estado, req.user.username);
        if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

        res.json({ message: 'Estado actualizado', order });
    } catch (error) {
        console.error('Error actualizando pedido:', error);
        res.status(500).json({ error: 'Error al actualizar pedido' });
    }
});

app.delete('/api/orders/:id', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const deleted = await orderService.deleteOrder(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Pedido no encontrado' });
        res.json({ message: '✅ Pedido eliminado', order: deleted });
    } catch (error) {
        console.error('Error eliminando pedido:', error);
        res.status(500).json({ error: 'Error al eliminar pedido' });
    }
});

app.get('/api/orders/:id/invoice', authService.requireAuth, async (req, res) => {
    try {
        const order = await orderService.findOrder(req.params.id);
        if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
        if (req.user.role !== 'admin' && order.userId !== req.user.id) {
            return res.status(403).json({ error: 'No autorizado para este pedido' });
        }
        const pdf = await pdfService.buildInvoice(order);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="factura-${order.orderId}.pdf"`);
        res.send(pdf);
    } catch (error) {
        console.error('Error generando factura:', error);
        res.status(500).json({ error: 'Error al generar la factura' });
    }
});

// ============== ANALÍTICAS ==============

app.get('/api/analytics/sales', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const { from, to } = req.query;
        const data = await orderService.getSalesAnalytics({ from, to });
        res.json(data);
    } catch (error) {
        console.error('Error en analíticas:', error);
        res.status(500).json({ error: 'Error al obtener analíticas' });
    }
});

// ============== VENTAS LOCALES (admin) ==============

app.post('/api/local-sales', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const { cliente, productos, total, notas, mesa } = req.body;

        if (!cliente?.nombre) {
            return res.status(400).json({ error: 'Nombre del cliente requerido' });
        }
        if (!Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ error: 'Debe incluir al menos un producto' });
        }

        const sale = await localSaleService.createLocalSale({
            cliente,
            productos,
            total: parseFloat(total) || 0,
            notas: notas || '',
            mesa: mesa || ''
        });

        console.log('💰 Venta local registrada:', sale.saleId);
        res.status(201).json({
            success: true,
            message: 'Venta local registrada correctamente',
            saleId: sale.saleId,
            sale
        });
    } catch (error) {
        console.error('Error creando venta local:', error);
        res.status(500).json({ error: 'No se pudo registrar la venta local' });
    }
});

app.get('/api/local-sales', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const sales = await localSaleService.listLocalSales();
        res.json(sales);
    } catch (error) {
        console.error('Error listando ventas locales:', error);
        res.status(500).json({ error: 'Error al cargar ventas locales' });
    }
});

app.get('/api/local-sales/stats', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const stats = await localSaleService.getLocalSalesStats();
        res.json(stats);
    } catch (error) {
        console.error('Error en stats ventas locales:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

app.get('/api/local-sales/:id/invoice', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const sale = await localSaleService.findLocalSale(req.params.id);
        if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
        const pdf = await pdfService.buildLocalSaleInvoice(sale);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="factura-${sale.saleId}.pdf"`);
        res.send(pdf);
    } catch (error) {
        console.error('Error generando factura:', error);
        res.status(500).json({ error: 'Error al generar la factura' });
    }
});

app.get('/api/local-sales/:id', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const sale = await localSaleService.findLocalSale(req.params.id);
        if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
        res.json(sale);
    } catch (error) {
        console.error('Error obteniendo venta local:', error);
        res.status(500).json({ error: 'Error al obtener venta' });
    }
});

app.put('/api/local-sales/:id', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const { cliente, productos, total, notas, mesa, estado } = req.body;
        const updated = await localSaleService.updateLocalSale(req.params.id, {
            cliente, productos, total: parseFloat(total) || 0, notas, mesa, estado
        });
        if (!updated) return res.status(404).json({ error: 'Venta no encontrada' });
        res.json({ message: '✅ Venta actualizada', sale: updated });
    } catch (error) {
        console.error('Error actualizando venta local:', error);
        res.status(500).json({ error: 'Error al actualizar venta' });
    }
});

app.post('/api/local-sales/:id/reorder', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const original = await localSaleService.findLocalSale(req.params.id);
        if (!original) return res.status(404).json({ error: 'Venta original no encontrada' });

        const newSale = await localSaleService.createLocalSale({
            cliente: original.cliente,
            productos: original.productos,
            total: original.totales?.total || 0,
            notas: `Reorden de ${original.saleId}${original.notas ? ' - ' + original.notas : ''}`,
            mesa: original.mesa || ''
        });

        console.log('🔄 Reorden creado:', newSale.saleId, 'desde', original.saleId);
        res.status(201).json({
            success: true,
            message: 'Reorden creado correctamente',
            saleId: newSale.saleId,
            sale: newSale
        });
    } catch (error) {
        console.error('Error creando reorden:', error);
        res.status(500).json({ error: 'Error al crear reorden' });
    }
});

app.delete('/api/local-sales/:id', authService.requireAuth, authService.requireRole('admin'), async (req, res) => {
    try {
        const deleted = await localSaleService.deleteLocalSale(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Venta no encontrada' });
        res.json({ message: '✅ Venta eliminada', sale: deleted });
    } catch (error) {
        console.error('Error eliminando venta local:', error);
        res.status(500).json({ error: 'Error al eliminar venta' });
    }
});

// ============== PÁGINAS ==============

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/admin', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('/login', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/registro', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/register.html'));
});

app.get('/mi-cuenta', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/account.html'));
});

app.get('/admin/pedidos', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin-pedidos.html'));
});

app.get('/api/images', (_req, res) => {
    try {
        res.json(fs.readdirSync(uploadsDir));
    } catch {
        res.json([]);
    }
});

app.use('/api', (req, res) => {
    res.status(404).json({ error: `Ruta API no encontrada: ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message || 'Error en la solicitud' });
    }
    next();
});

app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 4000;

async function start() {
    try {
        await connectDatabase();
        await authService.ensureDefaultAdmin();
        await categoryService.ensureDefaults();
        await productService.seedFromJsonIfEmpty(menuPath);

        app.listen(PORT, () => {
            console.log(`🚀 Servidor en http://localhost:${PORT}`);
            console.log(`🍃 Productos, pedidos y usuarios en MongoDB`);
            console.log(`👨‍💼 Admin: http://localhost:${PORT}/admin`);
            console.log(`👤 Login unificado: http://localhost:${PORT}/login`);
        });
    } catch (error) {
        console.error('❌ No se pudo iniciar el servidor:', error.message);
        console.error('   Asegúrate de que MongoDB esté corriendo (mongod) o define MONGODB_URI en .env');
        process.exit(1);
    }
}

start();
