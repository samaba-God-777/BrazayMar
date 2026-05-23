require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const authService = require('./services/authService');
const { connectDatabase } = require('./config/database');
const productService = require('./services/productService');
const orderService = require('./services/orderService');

const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// --- Autenticación ---
app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }
        const user = authService.authenticate(username.trim(), password);
        if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

        res.json({
            message: 'Sesión iniciada',
            token: authService.createToken(user),
            user: { id: user.id, username: user.username, name: user.name, role: user.role }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

app.get('/api/auth/me', authService.requireAuth, (req, res) => {
    res.json({ user: req.user });
});

app.post('/api/auth/logout', (_req, res) => {
    res.json({ message: 'Sesión cerrada' });
});

// --- Menú y productos (MongoDB) ---
app.get('/api/menu', async (_req, res) => {
    try {
        const menu = await productService.getMenuGrouped();
        console.log('📦 Menú desde MongoDB:', {
            hamburguesas: menu.hamburguesas?.length || 0,
            especiales: menu.especiales?.length || 0,
            cerdo: menu.cerdo?.length || 0
        });
        res.json(menu);
    } catch (error) {
        console.error('Error leyendo menú:', error);
        res.status(500).json({ error: 'Error al cargar el menú' });
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

app.post('/api/products', authService.requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, category, destacado, featured, descuento, rating } = req.body;

        if (!name || !description || !price || !category) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }
        if (!productService.isValidCategory(category)) {
            return res.status(400).json({ error: 'Categoría inválida' });
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

app.put('/api/products/:id', authService.requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, category, destacado, featured, descuento, rating } = req.body;

        if (!name || !description || !price || !category) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }
        if (!productService.isValidCategory(category)) {
            return res.status(400).json({ error: 'Categoría inválida' });
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

app.delete('/api/products/:id', authService.requireAuth, async (req, res) => {
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

// --- Pedidos (MongoDB) ---
app.post('/api/orders', async (req, res) => {
    try {
        const { cliente, productos, totales } = req.body;

        if (!cliente?.nombre || !cliente?.telefono || !cliente?.direccion) {
            return res.status(400).json({ error: 'Datos del cliente incompletos' });
        }
        if (!Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ error: 'El pedido no tiene productos' });
        }

        const order = await orderService.createOrder({
            cliente,
            productos,
            totales: totales || {}
        });

        console.log('📋 Nuevo pedido en MongoDB:', order.orderId);
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

app.get('/api/orders/stats', authService.requireAuth, async (_req, res) => {
    try {
        const stats = await orderService.getOrderStats();
        res.json(stats);
    } catch (error) {
        console.error('Error en stats pedidos:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

app.get('/api/orders', authService.requireAuth, async (_req, res) => {
    try {
        const orders = await orderService.listOrders();
        res.json(orders);
    } catch (error) {
        console.error('Error listando pedidos:', error);
        res.status(500).json({ error: 'Error al cargar pedidos' });
    }
});

app.patch('/api/orders/:id/status', authService.requireAuth, async (req, res) => {
    try {
        const { estado } = req.body;
        const valid = ['pendiente', 'proceso', 'completado', 'cancelado'];
        if (!valid.includes(estado)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }

        const order = await orderService.updateOrderStatus(req.params.id, estado);
        if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

        res.json({ message: 'Estado actualizado', order });
    } catch (error) {
        console.error('Error actualizando pedido:', error);
        res.status(500).json({ error: 'Error al actualizar pedido' });
    }
});

// Páginas
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/admin', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('/login', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
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
        await productService.seedFromJsonIfEmpty(menuPath);

        app.listen(PORT, () => {
            console.log(`🚀 Servidor en http://localhost:${PORT}`);
            console.log(`🍃 Productos y pedidos en MongoDB`);
            console.log(`👨‍💼 Admin: http://localhost:${PORT}/admin`);
        });
    } catch (error) {
        console.error('❌ No se pudo iniciar el servidor:', error.message);
        console.error('   Asegúrate de que MongoDB esté corriendo (mongod) o define MONGODB_URI en .env');
        process.exit(1);
    }
}

start();
