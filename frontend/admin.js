const API_BASE_URL = window.AppConfig?.API_BASE_URL || (window.AuthService ? window.AuthService.getApiBase() : `${window.location.origin}/api`);

let products = [];
let filteredProducts = [];
let editMode = false;
let productToEdit = null;
let currentUser = null;

const form = document.getElementById('productForm');
const msg = document.getElementById('message');

const SECTION_META = {
    add: {
        title: 'Agregar Producto',
        description: 'Administra los productos del menú'
    },
    list: {
        title: 'Lista de Productos',
        description: 'Gestiona todos los productos del menú'
    },
    categories: {
        title: 'Categorías',
        description: 'Administra las categorías del menú'
    },
    pedidos: {
        title: 'Pedidos de clientes',
        description: 'Pedidos enviados desde la tienda en tiempo real'
    },
    'ventas-locales': {
        title: 'Ventas Locales',
        description: 'Registra ventas directas del restaurante'
    },
    'ventas-realizadas': {
        title: 'Ventas Realizadas Locales',
        description: 'Historial de ventas locales con edición y reorden'
    },
    analytics: {
        title: 'Analíticas de Ventas',
        description: 'Resumen de ventas y desempeño del negocio'
    }
};

function getServerOrigin() {
    return API_BASE_URL.replace(/\/api$/, '');
}

function buildImageUrl(imagen) {
    if (!imagen) return `${getServerOrigin()}/images/placeholder.png`;
    if (imagen.startsWith('http') || imagen.startsWith('//')) return imagen;
    if (imagen.startsWith('/')) return `${getServerOrigin()}${imagen}`;
    return `${getServerOrigin()}/uploads/${imagen}`;
}

function showToast(texto, tipo = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `
        <i class="fas fa-${tipo === 'success' ? 'check-circle' : tipo === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${texto}</span>
    `;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function mostrarMensaje(texto, tipo) {
    if (!msg) {
        showToast(texto, tipo);
        return;
    }

    msg.textContent = texto;
    msg.className = `message ${tipo}`;
    msg.style.display = 'block';
    showToast(texto, tipo);

    setTimeout(() => {
        msg.style.display = 'none';
    }, 5000);
}

function showSection(id) {
    document.querySelectorAll('.admin-section').forEach((sec) => {
        sec.classList.remove('active');
        sec.style.display = '';
    });

    const section = document.getElementById(id);
    if (section) {
        section.classList.add('active');
    }

    document.querySelectorAll('.sidebar-nav .nav-item').forEach((btn) => {
        const onclick = btn.getAttribute('onclick') || '';
        btn.classList.toggle('active', onclick.includes(`'${id}'`));
    });

    const meta = SECTION_META[id];
    if (meta) {
        const titleEl = document.getElementById('section-title');
        const descEl = document.getElementById('section-description');
        if (titleEl) titleEl.textContent = meta.title;
        if (descEl) descEl.textContent = meta.description;
    }

    if (id === 'list') {
        renderProducts();
    }
    if (id === 'pedidos') {
        if (typeof cargarPedidosAdmin === 'function') {
            cargarPedidosAdmin(true);
        }
    }
    if (id === 'add' && !editMode) {
        resetForm();
    }
    if (id === 'analytics') {
        // Load analytics data when section is shown
        if (typeof refreshAnalyticsData === 'function') {
            refreshAnalyticsData();
        }
    }
    if (id === 'ventas-locales') {
        if (typeof initVentasLocales === 'function') {
            initVentasLocales();
        }
    }
    if (id === 'ventas-realizadas') {
        if (typeof cargarVentasRealizadas === 'function') {
            cargarVentasRealizadas();
        }
    }
}

function updateDashboardStats(menuData) {
    const counts = {
        hamburguesas: menuData.hamburguesas?.length || 0,
        especiales: menuData.especiales?.length || 0,
        cerdo: menuData.cerdo?.length || 0
    };

    const total = products.length;
    const featured = products.filter((p) => p.destacado).length;
    const discounted = products.filter((p) => (p.descuento || 0) > 0).length;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText('total-products', total);
    setText('featured-products', featured);
    setText('discount-products', discounted);
    setText('counter-list', total);
    setText('counter-hamburguesas', counts.hamburguesas);
    setText('counter-especiales', counts.especiales);
    setText('counter-cerdo', counts.cerdo);
    setText('storage-used', `${total} producto${total === 1 ? '' : 's'}`);
    setText('last-update', new Date().toLocaleString('es-PA', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short'
    }));
}

function applyFilters() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const category = document.getElementById('filterCategory')?.value || '';
    const featuredFilter = document.getElementById('filterFeatured')?.value || '';

    filteredProducts = products.filter((producto) => {
        const matchesSearch = !search
            || producto.nombre?.toLowerCase().includes(search)
            || producto.descripcion?.toLowerCase().includes(search)
            || producto.categoria?.toLowerCase().includes(search);

        const matchesCategory = !category || producto.categoria === category;

        const matchesFeatured = featuredFilter === ''
            || (featuredFilter === 'true' && producto.destacado)
            || (featuredFilter === 'false' && !producto.destacado);

        return matchesSearch && matchesCategory && matchesFeatured;
    });

    renderProducts();
}

let allCategories = [];

async function cargarProductos() {
    try {
        const response = await fetch(`${API_BASE_URL}/menu`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const menu = await AppConfig.parseJsonResponse(response);
        allCategories = menu.categories || [];
        products = [];

        const items = menu.items || {};
        for (const categoria of allCategories) {
            const list = items[categoria.id] || [];
            list.forEach((producto) => {
                products.push({ ...producto, categoria: categoria.id, categoriaName: categoria.name });
            });
        }

        populateCategorySelects();
        filteredProducts = [...products];
        updateDashboardStats(menu);
        applyFilters();
    } catch (error) {
        console.error('Error cargando productos:', error);
        mostrarMensaje(error.message || 'Error al cargar productos. Verifica el servidor.', 'error');
    }
}

function populateCategorySelects() {
    const selects = ['category', 'filterCategory'];
    selects.forEach((id) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const current = sel.value;
        const isFilter = id === 'filterCategory';
        sel.innerHTML = isFilter
            ? '<option value="">Todas las categorías</option>' + allCategories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
            : allCategories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
        if (current && [...sel.options].some((o) => o.value === current)) {
            sel.value = current;
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function refreshData() {
    cargarProductos();
    showToast('Datos actualizados', 'success');
}

function logout() {
    AuthService.logout();
}

function renderProducts() {
    const list = document.getElementById('productList');
    if (!list) return;

    list.innerHTML = '';

    if (filteredProducts.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-box-open"></i>
                </div>
                <h3>${products.length === 0 ? 'No hay productos' : 'Sin resultados'}</h3>
                <p>${products.length === 0 ? 'Agrega tu primer producto usando el formulario' : 'Prueba con otros filtros de búsqueda'}</p>
                <button class="btn-secondary" onclick="showSection('add')">
                    <i class="fas fa-plus"></i> Agregar Producto
                </button>
            </div>
        `;
        return;
    }

    filteredProducts.forEach((producto) => {
        const item = document.createElement('div');
        item.className = 'product-item';
        const imageUrl = buildImageUrl(producto.imagen);
        const fecha = producto.fechaCreacion
            ? new Date(producto.fechaCreacion).toLocaleDateString()
            : '—';

        item.innerHTML = `
            <div class="product-image">
                <img src="${imageUrl}" alt="${producto.nombre}"
                     onerror="this.src='${getServerOrigin()}/images/placeholder.png'">
            </div>
            <div class="product-info">
                <h3>${producto.nombre}</h3>
                <p class="product-desc">${producto.descripcion}</p>
                <div class="product-meta">
                    <span class="category-badge">${producto.categoria}</span>
                    <span class="price">B/ ${producto.precio}</span>
                    ${producto.destacado ? '<span class="featured-badge">★ Destacado</span>' : ''}
                    ${producto.descuento > 0 ? `<span class="discount-badge">-${producto.descuento}%</span>` : ''}
                    <span class="rating">⭐ ${producto.rating || '4.5'}</span>
                </div>
                <div class="product-date"><small>${fecha}</small></div>
            </div>
            <div class="product-actions">
                <button class="btn-edit" onclick="editarProducto('${producto.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn-delete" onclick="deleteProduct('${producto.id}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        `;

        list.appendChild(item);
    });
}

function resetForm() {
    if (form) form.reset();

    const preview = document.getElementById('imagePreview');
    if (preview) {
        preview.innerHTML = '';
        preview.style.display = 'none';
    }

    const discountRange = document.getElementById('discountRange');
    const discountInput = document.getElementById('discount');
    if (discountRange) discountRange.value = 0;
    if (discountInput) discountInput.value = 0;

    editMode = false;
    productToEdit = null;

    const sectionTitle = document.getElementById('section-title');
    const submitBtn = document.getElementById('submitBtn');
    if (sectionTitle) sectionTitle.textContent = 'Agregar Producto';
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-plus"></i> Agregar Producto';

    if (msg) {
        msg.innerHTML = '';
        msg.style.display = 'none';
    }
}

async function editarProducto(id) {
    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/products/${id}`);
        if (!response.ok) throw new Error('Producto no encontrado');

        const producto = await AppConfig.parseJsonResponse(response);

        document.getElementById('name').value = producto.nombre || '';
        document.getElementById('description').value = producto.descripcion || '';
        document.getElementById('price').value = producto.precio || '';
        document.getElementById('category').value = producto.categoria || 'hamburguesas';
        document.getElementById('featured').checked = !!producto.destacado;
        document.getElementById('discount').value = producto.descuento || 0;
        document.getElementById('rating').value = producto.rating || '4.5';

        const discountRange = document.getElementById('discountRange');
        if (discountRange) discountRange.value = producto.descuento || 0;

        const preview = document.getElementById('imagePreview');
        if (preview && producto.imagen) {
            preview.innerHTML = `<img src="${buildImageUrl(producto.imagen)}" alt="Preview" style="max-width:200px; max-height:150px; border-radius:8px;">`;
            preview.style.display = 'block';
        }

        editMode = true;
        productToEdit = id;

        const sectionTitle = document.getElementById('section-title');
        const submitBtn = document.getElementById('submitBtn');
        if (sectionTitle) sectionTitle.textContent = 'Editar Producto';
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';

        showSection('add');
    } catch (error) {
        console.error('Error cargando producto:', error);
        mostrarMensaje('Error al cargar producto para editar', 'error');
    }
}

async function deleteProduct(id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/products/${id}`, {
            method: 'DELETE'
        });
        const result = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(result.error || 'Error al eliminar');

        mostrarMensaje(result.message, 'success');
        await cargarProductos();
        localStorage.setItem('menu_updated', Date.now().toString());

        if (window.opener?.actualizarMenu) {
            window.opener.actualizarMenu();
        }
    } catch (error) {
        console.error('Error eliminando:', error);
        mostrarMensaje(error.message, 'error');
    }
}

function setupForm() {
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        if (formData.get('featured')) {
            formData.set('destacado', 'true');
        } else {
            formData.set('destacado', 'false');
        }

        if (!formData.get('name') || !formData.get('description') || !formData.get('price') || !formData.get('category')) {
            mostrarMensaje('Completa todos los campos requeridos', 'error');
            return;
        }

        const url = editMode && productToEdit
            ? `${API_BASE_URL}/products/${productToEdit}`
            : `${API_BASE_URL}/products`;
        const method = editMode && productToEdit ? 'PUT' : 'POST';

        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        }

        try {
            const response = await AuthService.fetchWithAuth(url, {
                method,
                body: formData
            });
            const result = await AppConfig.parseJsonResponse(response);

            if (!response.ok) throw new Error(result.error || 'Error en la operación');

            mostrarMensaje(result.message, 'success');
            resetForm();
            await cargarProductos();
            localStorage.setItem('menu_updated', Date.now().toString());

            if (window.opener?.actualizarMenu) {
                window.opener.actualizarMenu();
            }
        } catch (error) {
            console.error('Error en formulario:', error);
            mostrarMensaje(error.message, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = editMode
                    ? '<i class="fas fa-save"></i> Guardar Cambios'
                    : '<i class="fas fa-plus"></i> Agregar Producto';
            }
        }
    });
}

function setupFilters() {
    document.getElementById('searchInput')?.addEventListener('input', applyFilters);
    document.getElementById('filterCategory')?.addEventListener('change', applyFilters);
    document.getElementById('filterFeatured')?.addEventListener('change', applyFilters);

    const discountRange = document.getElementById('discountRange');
    const discountInput = document.getElementById('discount');

    if (discountRange && discountInput) {
        discountRange.addEventListener('input', () => {
            discountInput.value = discountRange.value;
        });
        discountInput.addEventListener('input', () => {
            const value = Math.min(50, Math.max(0, Number(discountInput.value) || 0));
            discountInput.value = value;
            discountRange.value = value;
        });
    }
}

function setupImagePreview() {
    const imageInput = document.getElementById('image');
    if (!imageInput) return;

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const preview = document.getElementById('imagePreview');

        if (file && preview) {
            const reader = new FileReader();
            reader.onload = (event) => {
                preview.innerHTML = `<img src="${event.target.result}" alt="Preview" style="max-width:200px; max-height:150px; border-radius:8px;">`;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else if (preview) {
            preview.innerHTML = '';
            preview.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await AuthService.requireRole('admin');
    if (!currentUser) return;

    renderAdminHeader();
    setupForm();
    setupFilters();
    setupImagePreview();
    setupCategoryForm();
    setupPromoForm();
    setupContactForm();
    await cargarProductos();
    await loadCategories();
    await loadPromosAdmin();
    await loadContactAdmin();
    if (typeof initAdminOrders === 'function') {
        initAdminOrders();
    }
    showSection('add');
    refreshAnalyticsData();

    window.addEventListener('storage', (e) => {
        if (e.key === 'menu_updated') cargarProductos();
    });
});

function renderAdminHeader() {
    const slot = document.getElementById('adminUserSlot');
    if (slot && currentUser) {
        const initial = (currentUser.name || currentUser.username).charAt(0).toUpperCase();
        slot.innerHTML = `
            <a href="/mi-cuenta" class="user-chip" title="Mi cuenta">
                <span class="user-chip__avatar">${initial}</span>
                <span class="user-chip__name">${currentUser.name || currentUser.username}</span>
            </a>
        `;
    }
}

// Analytics functions
let analyticsData = null;

async function refreshAnalyticsData() {
    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/analytics/sales`);
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al cargar analíticas');

        analyticsData = data;
        updateAnalyticsDisplay();
    } catch (err) {
        console.error('Error loading analytics:', err);
    }
}

function filterAnalyticsByDate() {
    updateAnalyticsDisplay();
}

function getSelectedPeriod() {
    const period = document.getElementById('date-range')?.value || 'month';
    const map = { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly', custom: 'custom' };
    return map[period] || 'monthly';
}

function updateAnalyticsDisplay() {
    if (!analyticsData) return;
    const period = getSelectedPeriod();
    const bucket = analyticsData[period] || analyticsData.monthly;

    const fmtB = (n) => `B/ ${(n || 0).toFixed(2)}`;

    const totalSalesEl = document.getElementById('total-sales');
    const totalOrdersEl = document.getElementById('total-orders');
    const avgOrderValueEl = document.getElementById('avg-order-value');
    const itemsEl = document.getElementById('total-items');
    const periodLabel = document.getElementById('period-label');

    if (totalSalesEl) totalSalesEl.textContent = fmtB(bucket.revenue);
    if (totalOrdersEl) totalOrdersEl.textContent = bucket.count;
    if (avgOrderValueEl) avgOrderValueEl.textContent = fmtB(bucket.avg);
    if (itemsEl) itemsEl.textContent = bucket.items;

    const localBucket = analyticsData.local?.[period] || { count: 0, revenue: 0, items: 0, avg: 0 };
    const deliveryRevenue = (bucket.revenue || 0) - (localBucket.revenue || 0);
    const deliveryCount = (bucket.count || 0) - (localBucket.count || 0);

    const localSalesEl = document.getElementById('local-sales');
    const localOrdersEl = document.getElementById('local-orders');
    const deliverySalesEl = document.getElementById('delivery-sales');
    const deliveryOrdersEl = document.getElementById('delivery-orders');

    if (localSalesEl) localSalesEl.textContent = fmtB(localBucket.revenue);
    if (localOrdersEl) localOrdersEl.textContent = localBucket.count;
    if (deliverySalesEl) deliverySalesEl.textContent = fmtB(deliveryRevenue);
    if (deliveryOrdersEl) deliveryOrdersEl.textContent = deliveryCount;

    const labels = { daily: 'Hoy', weekly: 'Esta semana', monthly: 'Este mes', yearly: 'Este año', custom: 'Periodo' };
    if (periodLabel) periodLabel.textContent = labels[period] || 'Este mes';

    renderAnalyticsCharts(analyticsData, period, bucket);
}

function renderAnalyticsCharts(data, period, bucket) {
    const dailyChart = document.getElementById('daily-sales-chart');
    if (dailyChart) {
        const width = dailyChart.clientWidth || 320;
        const periods = ['daily', 'weekly', 'monthly', 'yearly'];
        const maxRev = Math.max(...periods.map((p) => data[p]?.revenue || 0), 1);
        dailyChart.innerHTML = periods.map((p) => {
            const b = data[p] || { revenue: 0, count: 0 };
            const h = Math.max(8, Math.round((b.revenue / maxRev) * 100));
            const labels = { daily: 'Hoy', weekly: 'Semana', monthly: 'Mes', yearly: 'Año' };
            return `
                <div class="bar-row" title="${labels[p]}: B/ ${b.revenue.toFixed(2)}">
                    <span class="bar-label">${labels[p]}</span>
                    <div class="bar-track"><div class="bar-fill" style="height:${h}%"></div></div>
                    <span class="bar-value">B/ ${b.revenue.toFixed(2)}</span>
                </div>
            `;
        }).join('');
    }

    const topList = document.getElementById('top-products-list');
    if (topList) {
        const items = data.topProducts || [];
        if (items.length === 0) {
            topList.innerHTML = '<p class="muted">Sin datos aún</p>';
        } else {
            topList.innerHTML = items.map((p, i) => `
                <li>
                    <span class="rank">${i + 1}</span>
                    <span class="name">${p.nombre}</span>
                    <span class="qty">${p.cantidad} uds</span>
                    <span class="rev">B/ ${(p.ingresos || 0).toFixed(2)}</span>
                </li>
            `).join('');
        }
    }
}

window.showSection = showSection;
window.deleteProduct = deleteProduct;
window.editarProducto = editarProducto;
window.resetForm = resetForm;
window.refreshData = refreshData;
window.logout = logout;
window.refreshAnalyticsData = refreshAnalyticsData;
window.filterAnalyticsByDate = filterAnalyticsByDate;
window.loadCategories = loadCategories;
window.deleteCategory = deleteCategory;

// ============== CATEGORIES ==============

async function loadCategories() {
    const list = document.getElementById('categoriesList');
    const counter = document.getElementById('counter-categories');
    if (!list) return;
    list.innerHTML = '<p class="muted"><i class="fas fa-spinner fa-spin"></i> Cargando categorías...</p>';

    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/categories`);
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al cargar categorías');

        if (counter) counter.textContent = data.length;

        if (!data.length) {
            list.innerHTML = '<p class="muted">No hay categorías.</p>';
            return;
        }

        list.innerHTML = data.map((c) => `
            <div class="category-card" data-id="${c.id}">
                <div class="category-card__icon"><i class="fas ${c.icon || 'fa-utensils'}"></i></div>
                <div class="category-card__info">
                    <h4>${escapeHtml(c.name)}</h4>
                    <small>id: <code>${escapeHtml(c.id)}</code> · orden: ${c.order}</small>
                </div>
                <div class="category-card__actions">
                    <button type="button" class="btn-icon" onclick="deleteCategory('${c.id}', '${escapeHtml(c.name)}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = `<p class="muted" style="color:#ef4444;">${err.message}</p>`;
    }
}

function setupCategoryForm() {
    const form = document.getElementById('categoryForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('categoryMessage');
        const btn = document.getElementById('catSubmitBtn');
        const name = document.getElementById('catName').value.trim();
        const icon = document.getElementById('catIcon').value;
        if (!name) {
            showCategoryMsg(msg, 'El nombre es requerido', 'error');
            return;
        }
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';
        try {
            const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, icon })
            });
            const data = await AppConfig.parseJsonResponse(response);
            if (!response.ok) throw new Error(data.error || 'Error al crear');

            showCategoryMsg(msg, `✅ Categoría "${data.category.name}" creada`, 'success');
            document.getElementById('catName').value = '';
            await loadCategories();
            await cargarProductos();
        } catch (err) {
            showCategoryMsg(msg, err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus"></i> Crear categoría';
        }
    });
}

function showCategoryMsg(box, message, type) {
    if (!box) return;
    box.textContent = message;
    box.className = `auth-message ${type}`;
    box.hidden = false;
    setTimeout(() => { box.hidden = true; }, 3500);
}

async function deleteCategory(id, name) {
    const productCount = products.filter((p) => p.categoria === id).length;
    let confirmMsg = `¿Eliminar la categoría "${name}"?`;
    let reassignTo = null;
    if (productCount > 0) {
        const others = allCategories.filter((c) => c.id !== id);
        if (!others.length) {
            showToast('No se puede eliminar: es la única categoría y tiene productos', 'error');
            return;
        }
        const options = others.map((c) => `${c.id}`).join(', ');
        const choice = prompt(`La categoría "${name}" tiene ${productCount} producto(s).\n\nEscribe el ID de la categoría a la que reasignarlos:\n${options}`, others[0].id);
        if (!choice) return;
        reassignTo = choice.trim();
    } else if (!confirm(confirmMsg)) {
        return;
    } else {
        reassignTo = null;
    }

    try {
        const url = reassignTo
            ? `${API_BASE_URL}/categories/${id}?reassignTo=${encodeURIComponent(reassignTo)}`
            : `${API_BASE_URL}/categories/${id}`;
        const response = await AuthService.fetchWithAuth(url, { method: 'DELETE' });
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al eliminar');

        showToast(`Categoría "${name}" eliminada`, 'success');
        await loadCategories();
        await cargarProductos();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==================== PROMOS ====================

async function loadPromosAdmin() {
    const list = document.getElementById('promosListAdmin');
    const counter = document.getElementById('counter-promos');
    if (!list) return;
    list.innerHTML = '<p class="muted"><i class="fas fa-spinner fa-spin"></i> Cargando promos...</p>';

    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/promos?includeInactive=true`);
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al cargar promos');

        if (counter) counter.textContent = data.length;

        if (!data.length) {
            list.innerHTML = '<p class="muted">No hay promos creadas. Crea la primera con el formulario de arriba.</p>';
            return;
        }

        list.innerHTML = data.map((p) => {
            const validity = (p.validFrom || p.validUntil)
                ? `<small><i class="far fa-calendar"></i> ${p.validFrom ? new Date(p.validFrom).toLocaleDateString('es-PA') : '∞'} → ${p.validUntil ? new Date(p.validUntil).toLocaleDateString('es-PA') : '∞'}</small>`
                : '<small><i class="fas fa-infinity"></i> Sin vencimiento</small>';

            // Calcular estado real: activa (publicada), programada, expirada
            const now = new Date();
            let statusBadge;
            if (!p.active) {
                statusBadge = '<span class="promo-status promo-status--inactive">● Inactiva</span>';
            } else if (p.validFrom && new Date(p.validFrom) > now) {
                statusBadge = '<span class="promo-status promo-status--scheduled">● Programada</span>';
            } else if (p.validUntil && new Date(p.validUntil) < now) {
                statusBadge = '<span class="promo-status promo-status--expired">● Expirada</span>';
            } else {
                statusBadge = '<span class="promo-status promo-status--active">● Activa</span>';
            }

            return `
                <div class="category-card" data-id="${p.id}">
                    <div class="category-card__icon"><i class="fas ${p.icon || 'fa-fire'}"></i></div>
                    <div class="category-card__info">
                        <h4>${escapeHtml(p.title)}</h4>
                        <small>id: <code>${escapeHtml(p.id)}</code></small>
                        ${validity}
                        ${statusBadge}
                    </div>
                    <div class="category-card__actions">
                        <button type="button" class="btn-icon" onclick="editPromo('${p.id}')" title="Editar">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button type="button" class="btn-icon" onclick="deletePromo('${p.id}', '${escapeHtml(p.title)}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        list.innerHTML = `<p class="muted" style="color:#ef4444;">${err.message}</p>`;
    }
}

function setupPromoForm() {
    const form = document.getElementById('promoForm');
    const imageInput = document.getElementById('promoImage');
    const preview = document.getElementById('promoImagePreview');

    if (imageInput && preview) {
        imageInput.addEventListener('change', () => {
            const file = imageInput.files?.[0];
            preview.innerHTML = '';
            if (!file) return;
            const url = URL.createObjectURL(file);
            preview.innerHTML = `<img src="${url}" alt="preview">`;
        });
    }

    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('promoId').value;
        const submitBtn = document.getElementById('promoSubmitBtn');
        const message = document.getElementById('promoMessage');

        const fd = new FormData();
        fd.append('title', document.getElementById('promoTitle').value.trim());
        fd.append('description', document.getElementById('promoDescription').value.trim());
        fd.append('icon', document.getElementById('promoIcon').value);
        fd.append('badgeText', document.getElementById('promoBadge').value.trim());
        fd.append('discountPercent', document.getElementById('promoDiscount').value || 0);
        fd.append('originalPrice', document.getElementById('promoOriginalPrice').value || '');
        fd.append('promoPrice', document.getElementById('promoPrice').value || '');
        fd.append('validFrom', document.getElementById('promoValidFrom').value || '');
        fd.append('validUntil', document.getElementById('promoValidUntil').value || '');
        fd.append('active', document.getElementById('promoActive').checked ? 'true' : 'false');
        const file = imageInput?.files?.[0];
        if (file) fd.append('image', file);

        submitBtn.disabled = true;
        const originalLabel = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        message.hidden = true;

        try {
            const url = id ? `${API_BASE_URL}/promos/${id}` : `${API_BASE_URL}/promos`;
            const method = id ? 'PUT' : 'POST';
            const response = await AuthService.fetchWithAuth(url, { method, body: fd });
            const data = await AppConfig.parseJsonResponse(response);
            if (!response.ok) throw new Error(data.error || 'Error al guardar la promo');

            showToast(id ? '✅ Promo actualizada' : '🔥 Promo creada', 'success');
            resetPromoForm();
            await loadPromosAdmin();
        } catch (err) {
            message.hidden = false;
            message.className = 'message message-error';
            message.textContent = err.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalLabel;
        }
    });
}

async function editPromo(id) {
    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/promos/${id}`);
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al cargar la promo');

        document.getElementById('promoId').value = data.id;
        document.getElementById('promoTitle').value = data.title || '';
        document.getElementById('promoDescription').value = data.description || '';
        document.getElementById('promoIcon').value = data.icon || 'fa-fire';
        document.getElementById('promoBadge').value = data.badgeText || '';
        document.getElementById('promoDiscount').value = data.discountPercent || 0;
        document.getElementById('promoOriginalPrice').value = data.originalPrice || '';
        document.getElementById('promoPrice').value = data.promoPrice || '';
        document.getElementById('promoValidFrom').value = data.validFrom ? new Date(data.validFrom).toISOString().slice(0, 10) : '';
        document.getElementById('promoValidUntil').value = data.validUntil ? new Date(data.validUntil).toISOString().slice(0, 10) : '';
        document.getElementById('promoActive').checked = data.active !== false;
        const preview = document.getElementById('promoImagePreview');
        preview.innerHTML = data.image ? `<img src="${data.image.startsWith('/') ? data.image : '/uploads/' + data.image}" alt="preview">` : '';

        document.getElementById('promoSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Actualizar promo';
        document.getElementById('promoForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast(`Editando: ${data.title}`, 'info');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deletePromo(id, name) {
    if (!confirm(`¿Eliminar la promo "${name}"?`)) return;
    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/promos/${id}`, { method: 'DELETE' });
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al eliminar');

        showToast(`Promo "${name}" eliminada`, 'success');
        await loadPromosAdmin();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function resetPromoForm() {
    document.getElementById('promoForm').reset();
    document.getElementById('promoId').value = '';
    document.getElementById('promoActive').checked = true;
    document.getElementById('promoImagePreview').innerHTML = '';
    document.getElementById('promoSubmitBtn').innerHTML = '<i class="fas fa-plus"></i> Crear promo';
    document.getElementById('promoMessage').hidden = true;
}

// ==================== CONTACTO ====================

const DEFAULT_SCHEDULE = [
    { day: 'Lunes', open: '11:00', close: '22:00', closed: false },
    { day: 'Martes', open: '11:00', close: '22:00', closed: false },
    { day: 'Miércoles', open: '11:00', close: '22:00', closed: false },
    { day: 'Jueves', open: '11:00', close: '22:00', closed: false },
    { day: 'Viernes', open: '11:00', close: '23:00', closed: false },
    { day: 'Sábado', open: '11:00', close: '23:00', closed: false },
    { day: 'Domingo', open: '11:00', close: '22:00', closed: false }
];

function renderScheduleEditor(hours) {
    const host = document.getElementById('contactScheduleEditor');
    if (!host) return;
    const data = (hours && hours.length) ? hours : DEFAULT_SCHEDULE;
    host.innerHTML = data.map((h, i) => `
        <div class="schedule-row" data-idx="${i}">
            <span class="schedule-row__day">${escapeHtml(h.day)}</span>
            <label class="schedule-row__closed">
                <input type="checkbox" data-field="closed" ${h.closed ? 'checked' : ''}>
                Cerrado
            </label>
            <input type="time" data-field="open" value="${h.open || ''}" class="form-control" style="max-width:120px;">
            <span class="schedule-row__sep">a</span>
            <input type="time" data-field="close" value="${h.close || ''}" class="form-control" style="max-width:120px;">
        </div>
    `).join('');
}

function readScheduleFromEditor() {
    const rows = document.querySelectorAll('#contactScheduleEditor .schedule-row');
    return [...rows].map((row) => ({
        day: row.querySelector('[data-field="day"]')?.value || row.querySelector('.schedule-row__day')?.textContent || '',
        closed: row.querySelector('[data-field="closed"]')?.checked || false,
        open: row.querySelector('[data-field="open"]')?.value || '',
        close: row.querySelector('[data-field="close"]')?.value || ''
    }));
}

async function loadContactAdmin() {
    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/contact`);
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al cargar contacto');

        document.getElementById('contactBusinessName').value = data.businessName || '';
        document.getElementById('contactTagline').value = data.tagline || '';
        document.getElementById('contactPhone').value = data.phone || '';
        document.getElementById('contactWhatsapp').value = data.whatsapp || '';
        document.getElementById('contactEmail').value = data.email || '';
        document.getElementById('contactAddress').value = data.address || '';
        document.getElementById('contactMapsUrl').value = data.mapsUrl || '';
        document.getElementById('contactFacebook').value = data.facebook || '';
        document.getElementById('contactInstagram').value = data.instagram || '';
        document.getElementById('contactTiktok').value = data.tiktok || '';
        renderScheduleEditor(data.hours);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function setupContactForm() {
    renderScheduleEditor();
    const form = document.getElementById('contactForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('contactSubmitBtn');
        const message = document.getElementById('contactMessage');

        const payload = {
            businessName: document.getElementById('contactBusinessName').value.trim(),
            tagline: document.getElementById('contactTagline').value.trim(),
            phone: document.getElementById('contactPhone').value.trim(),
            whatsapp: document.getElementById('contactWhatsapp').value.trim(),
            email: document.getElementById('contactEmail').value.trim(),
            address: document.getElementById('contactAddress').value.trim(),
            mapsUrl: document.getElementById('contactMapsUrl').value.trim(),
            facebook: document.getElementById('contactFacebook').value.trim(),
            instagram: document.getElementById('contactInstagram').value.trim(),
            tiktok: document.getElementById('contactTiktok').value.trim(),
            hours: readScheduleFromEditor()
        };

        submitBtn.disabled = true;
        const originalLabel = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        message.hidden = true;

        try {
            const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/contact`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await AppConfig.parseJsonResponse(response);
            if (!response.ok) throw new Error(data.error || 'Error al guardar contacto');

            showToast('✅ Contacto actualizado', 'success');
        } catch (err) {
            message.hidden = false;
            message.className = 'message message-error';
            message.textContent = err.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalLabel;
        }
    });
}

window.loadPromosAdmin = loadPromosAdmin;
window.setupPromoForm = setupPromoForm;
window.editPromo = editPromo;
window.deletePromo = deletePromo;
window.resetPromoForm = resetPromoForm;
window.loadContactAdmin = loadContactAdmin;
window.setupContactForm = setupContactForm;

// ============== VENTAS LOCALES ==============

let vlProductosMenu = [];
let vlItemsAgregados = [];

function getServerOriginVL() {
    return API_BASE_URL.replace(/\/api$/, '');
}

function buildImageUrlVL(imagen) {
    if (!imagen) return `${getServerOriginVL()}/images/placeholder.png`;
    if (imagen.startsWith('http') || imagen.startsWith('//')) return imagen;
    if (imagen.startsWith('/')) return `${getServerOriginVL()}${imagen}`;
    return `${getServerOriginVL()}/uploads/${imagen}`;
}

async function initVentasLocales() {
    await cargarProductosParaVentaLocal();
    await cargarHistorialVentasLocales();
}

function actualizarNombreCliente() {
    const nombre = document.getElementById('vlClienteNombre')?.value?.trim() || '';
    const preview = document.getElementById('vlClientePreview');
    const previewText = document.getElementById('vlClientePreviewText');
    if (preview && previewText) {
        if (nombre.length > 0) {
            preview.style.display = 'flex';
            previewText.textContent = nombre;
        } else {
            preview.style.display = 'none';
        }
    }
}

async function cargarProductosParaVentaLocal() {
    const grid = document.getElementById('vlProductosGrid');
    if (grid) grid.innerHTML = '<p class="muted"><i class="fas fa-spinner fa-spin"></i> Cargando productos...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/menu`);
        const menu = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error('Error al cargar menú');

        vlProductosMenu = [];
        const categories = menu.categories || [];
        const items = menu.items || {};

        for (const cat of categories) {
            const list = items[cat.id] || [];
            list.forEach((p) => {
                vlProductosMenu.push({
                    ...p,
                    categoria: cat.id,
                    _catName: cat.name
                });
            });
        }

        renderProductosGrid(vlProductosMenu);
    } catch (err) {
        console.error('Error loading menu for local sales:', err);
        if (grid) grid.innerHTML = '<p class="muted">Error al cargar productos</p>';
    }
}

function renderProductosGrid(productos) {
    const grid = document.getElementById('vlProductosGrid');
    const countEl = document.getElementById('vlProductosCount');
    if (!grid) return;

    if (countEl) countEl.textContent = `${productos.length} producto${productos.length === 1 ? '' : 's'}`;

    if (productos.length === 0) {
        grid.innerHTML = '<div class="vl-empty"><i class="fas fa-search"></i><p>No se encontraron productos</p></div>';
        return;
    }

    grid.innerHTML = productos.map((p) => {
        const img = buildImageUrlVL(p.imagen);
        const precio = Number(p.precio) || 0;
        const catLabel = (p._catName || p.categoria || '').charAt(0).toUpperCase() + (p._catName || p.categoria || '').slice(1);
        const inCart = vlItemsAgregados.find((i) => i.id === p.id);
        const cartQty = inCart ? inCart.cantidad : 0;
        const cartBadge = cartQty > 0 ? `<span class="vl-prod-cart-badge">${cartQty}</span>` : '';
        const descuento = Number(p.descuento) || 0;
        const precioFinal = descuento > 0 ? precio * (1 - descuento / 100) : precio;

        return `
            <div class="vl-prod-card ${cartQty > 0 ? 'vl-prod-card--in-cart' : ''}" onclick="agregarProductoAlCarrito('${p.id}')" title="${p.nombre} - Clic para agregar">
                <div class="vl-prod-img-wrap">
                    <img src="${img}" alt="${p.nombre}" class="vl-prod-img" loading="lazy" onerror="this.src='${getServerOriginVL()}/images/placeholder.png'">
                    ${cartBadge}
                    ${descuento > 0 ? `<span class="vl-prod-discount">-${descuento}%</span>` : ''}
                </div>
                <div class="vl-prod-info">
                    <span class="vl-prod-name" title="${p.nombre}">${p.nombre}</span>
                    <span class="vl-prod-cat">${catLabel}</span>
                    <div class="vl-prod-prices">
                        ${descuento > 0 ? `<span class="vl-prod-old-price">B/ ${precio.toFixed(2)}</span>` : ''}
                        <span class="vl-prod-price">B/ ${precioFinal.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function filtrarProductosVentaLocal() {
    const search = (document.getElementById('vlSearchInput')?.value || '').toLowerCase().trim();
    if (!search) {
        renderProductosGrid(vlProductosMenu);
        return;
    }
    const filtered = vlProductosMenu.filter((p) =>
        p.nombre.toLowerCase().includes(search) ||
        (p.categoria || '').toLowerCase().includes(search) ||
        (p._catName || '').toLowerCase().includes(search)
    );
    renderProductosGrid(filtered);
}

function agregarProductoAlCarrito(productId) {
    const producto = vlProductosMenu.find((p) => p.id === productId);
    if (!producto) return;

    const precio = Number(producto.precio) || 0;
    const descuento = Number(producto.descuento) || 0;
    const precioFinal = descuento > 0 ? precio * (1 - descuento / 100) : precio;

    const existIndex = vlItemsAgregados.findIndex((i) => i.id === productId);
    if (existIndex >= 0) {
        vlItemsAgregados[existIndex].cantidad += 1;
    } else {
        vlItemsAgregados.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: precioFinal,
            cantidad: 1,
            categoria: producto.categoria || producto._catName || '',
            imagen: producto.imagen || ''
        });
    }

    renderCartItems();
    renderProductosGrid(
        document.getElementById('vlSearchInput')?.value?.trim()
            ? vlProductosMenu.filter((p) => p.nombre.toLowerCase().includes(document.getElementById('vlSearchInput').value.toLowerCase().trim()))
            : vlProductosMenu
    );
}

function aumentarCantidadItem(index) {
    if (vlItemsAgregados[index]) {
        vlItemsAgregados[index].cantidad += 1;
        renderCartItems();
        renderProductosGrid(
            document.getElementById('vlSearchInput')?.value?.trim()
                ? vlProductosMenu.filter((p) => p.nombre.toLowerCase().includes(document.getElementById('vlSearchInput').value.toLowerCase().trim()))
                : vlProductosMenu
        );
    }
}

function disminuirCantidadItem(index) {
    if (vlItemsAgregados[index]) {
        vlItemsAgregados[index].cantidad -= 1;
        if (vlItemsAgregados[index].cantidad <= 0) {
            vlItemsAgregados.splice(index, 1);
        }
        renderCartItems();
        renderProductosGrid(
            document.getElementById('vlSearchInput')?.value?.trim()
                ? vlProductosMenu.filter((p) => p.nombre.toLowerCase().includes(document.getElementById('vlSearchInput').value.toLowerCase().trim()))
                : vlProductosMenu
        );
    }
}

function removerItemVentaLocal(index) {
    vlItemsAgregados.splice(index, 1);
    renderCartItems();
    renderProductosGrid(
        document.getElementById('vlSearchInput')?.value?.trim()
            ? vlProductosMenu.filter((p) => p.nombre.toLowerCase().includes(document.getElementById('vlSearchInput').value.toLowerCase().trim()))
            : vlProductosMenu
    );
}

function renderCartItems() {
    const container = document.getElementById('vlCartItems');
    const totalEl = document.getElementById('vlTotalDisplay');
    const countEl = document.getElementById('vlCartCount');
    if (!container) return;

    const totalItems = vlItemsAgregados.reduce((s, i) => s + i.cantidad, 0);
    if (countEl) countEl.textContent = `${totalItems} item${totalItems === 1 ? '' : 's'}`;

    if (vlItemsAgregados.length === 0) {
        container.innerHTML = `
            <div class="vl-cart-empty">
                <i class="fas fa-cart-plus"></i>
                <p>Haz clic en un producto para agregarlo</p>
            </div>`;
        if (totalEl) totalEl.textContent = 'B/ 0.00';
        return;
    }

    container.innerHTML = vlItemsAgregados.map((item, i) => {
        const sub = item.precio * item.cantidad;
        return `
            <div class="vl-cart-item">
                <div class="vl-cart-item-info">
                    <span class="vl-cart-item-name">${item.nombre}</span>
                    <span class="vl-cart-item-price">B/ ${item.precio.toFixed(2)} c/u</span>
                </div>
                <div class="vl-cart-item-controls">
                    <button type="button" class="vl-qty-btn" onclick="disminuirCantidadItem(${i})" title="Quitar uno">
                        <i class="fas fa-minus"></i>
                    </button>
                    <span class="vl-qty-value">${item.cantidad}</span>
                    <button type="button" class="vl-qty-btn" onclick="aumentarCantidadItem(${i})" title="Agregar uno">
                        <i class="fas fa-plus"></i>
                    </button>
                    <span class="vl-cart-item-sub">B/ ${sub.toFixed(2)}</span>
                    <button type="button" class="vl-item-remove" onclick="removerItemVentaLocal(${i})" title="Eliminar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    const total = vlItemsAgregados.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    if (totalEl) totalEl.textContent = `B/ ${total.toFixed(2)}`;
}

async function registrarVentaLocal() {
    if (vlItemsAgregados.length === 0) {
        showToast('Agrega al menos un producto', 'error');
        return;
    }

    const nombre = document.getElementById('vlClienteNombre')?.value?.trim();
    if (!nombre) {
        showToast('Ingresa el nombre del cliente', 'error');
        document.getElementById('vlClienteNombre')?.focus();
        return;
    }

    const submitBtn = document.getElementById('vlSubmitBtn');
    const message = document.getElementById('vlMessage');
    const notas = document.getElementById('vlNotas')?.value?.trim() || '';

    const total = vlItemsAgregados.reduce((s, i) => s + (i.precio * i.cantidad), 0);

    const payload = {
        cliente: { nombre },
        productos: vlItemsAgregados.map((i) => ({
            id: i.id,
            nombre: i.nombre,
            precio: i.precio,
            cantidad: i.cantidad,
            categoria: i.categoria,
            imagen: i.imagen
        })),
        total,
        notas,
        mesa: document.getElementById('vlMesa')?.value?.trim() || ''
    };

    submitBtn.disabled = true;
    const originalLabel = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
    if (message) message.hidden = true;

    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/local-sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al registrar venta');

        mostrarConfirmacionVenta(data.saleId || data.sale?.saleId, nombre, vlItemsAgregados, total, notas);

        showToast(`✅ Venta ${data.saleId || data.sale?.saleId} registrada - B/ ${total.toFixed(2)}`, 'success');

        vlItemsAgregados = [];
        renderCartItems();
        document.getElementById('vlClienteNombre').value = '';
        document.getElementById('vlNotas').value = '';
        renderProductosGrid(vlProductosMenu);

        await cargarHistorialVentasLocales();
    } catch (err) {
        if (message) {
            message.hidden = false;
            message.className = 'message message-error';
            message.textContent = err.message;
        }
        showToast(err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalLabel;
    }
}

function mostrarConfirmacionVenta(orderId, cliente, items, total, notas) {
    const existing = document.getElementById('vlConfirmacionVenta');
    if (existing) existing.remove();

    const itemsHtml = items.map((i) => `
        <div class="vl-conf-item">
            <span class="vl-conf-item-qty">${i.cantidad}x</span>
            <span class="vl-conf-item-name">${i.nombre}</span>
            <span class="vl-conf-item-sub">B/ ${(i.precio * i.cantidad).toFixed(2)}</span>
        </div>
    `).join('');

    const now = new Date().toLocaleString('es-PA');

    const html = `
        <div id="vlConfirmacionVenta" class="vl-confirmacion">
            <div class="vl-conf-header">
                <div class="vl-conf-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div>
                    <h3>Venta Registrada</h3>
                    <span class="vl-conf-id">${orderId}</span>
                </div>
                <button type="button" class="vl-conf-close" onclick="cerrarConfirmacionVenta()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="vl-conf-body">
                <div class="vl-conf-row">
                    <i class="fas fa-user"></i>
                    <span><strong>Cliente:</strong> ${cliente}</span>
                </div>
                <div class="vl-conf-row">
                    <i class="fas fa-clock"></i>
                    <span><strong>Fecha:</strong> ${now}</span>
                </div>
                <div class="vl-conf-row">
                    <i class="fas fa-store"></i>
                    <span><strong>Tipo:</strong> Venta Local (sin envío)</span>
                </div>
                ${notas ? `<div class="vl-conf-row"><i class="fas fa-sticky-note"></i><span><strong>Notas:</strong> ${notas}</span></div>` : ''}
                <div class="vl-conf-items">
                    <h4><i class="fas fa-shopping-cart"></i> Productos</h4>
                    ${itemsHtml}
                </div>
                <div class="vl-conf-total">
                    <span>TOTAL COBRADO</span>
                    <strong>B/ ${total.toFixed(2)}</strong>
                </div>
            </div>
            <div class="vl-conf-footer">
                <button type="button" class="btn-secondary" onclick="imprimirFactura('${orderId}')">
                    <i class="fas fa-print"></i> Imprimir Factura
                </button>
                <button type="button" class="btn-primary" onclick="cerrarConfirmacionVenta()">
                    <i class="fas fa-check"></i> Aceptar
                </button>
            </div>
        </div>
    `;

    document.querySelector('.ventas-locales-left').insertAdjacentHTML('afterbegin', html);
}

function cerrarConfirmacionVenta() {
    const el = document.getElementById('vlConfirmacionVenta');
    if (el) el.remove();
}

async function imprimirFactura(saleId) {
    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/local-sales/${saleId}/invoice`);
        if (!response.ok) throw new Error('Error al generar factura');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (err) {
        showToast(err.message || 'Error al abrir factura', 'error');
    }
}

async function cargarHistorialVentasLocales() {
    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/local-sales`);
        const sales = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error('Error al cargar historial');

        renderHistorialVentasLocales(sales);
        calcularResumenVentasLocales(sales);
    } catch (err) {
        console.error('Error loading local sales history:', err);
    }
}

function renderHistorialVentasLocales(orders) {
    const container = document.getElementById('vlHistorialList');
    if (!container) return;

    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="vl-empty">
                <i class="fas fa-cash-register"></i>
                <p>No hay ventas locales registradas</p>
            </div>`;
        return;
    }

    container.innerHTML = orders.slice(0, 50).map((o) => {
        const fecha = o.fecha ? new Date(o.fecha).toLocaleString('es-PA') : '—';
        const totalItems = (o.productos || []).reduce((s, p) => s + (p.cantidad || 0), 0);
        const itemsHtml = (o.productos || []).map((p) => {
            const sub = (Number(p.precio) || 0) * (p.cantidad || 0);
            return `<div class="vl-hist-item"><span class="vl-hist-item-qty">${p.cantidad}x</span> <span class="vl-hist-item-name">${p.nombre}</span> <span class="vl-hist-item-sub">B/ ${sub.toFixed(2)}</span></div>`;
        }).join('');

        return `
            <div class="vl-historial-item">
                <div class="vl-historial-header">
                    <div class="vl-historial-header-left">
                        <span class="vl-historial-id">${o.orderId || o.id}</span>
                        <span class="vl-historial-badge">LOCAL</span>
                    </div>
                    <span class="vl-historial-fecha">${fecha}</span>
                </div>
                <div class="vl-historial-cliente">
                    <i class="fas fa-user"></i> <strong>${o.cliente?.nombre || '—'}</strong>
                    <span class="vl-historial-items-count">${totalItems} producto${totalItems === 1 ? '' : 's'}</span>
                </div>
                <div class="vl-historial-products">${itemsHtml}</div>
                ${o.notas ? `<div class="vl-historial-notas-row"><i class="fas fa-sticky-note"></i> ${o.notas}</div>` : ''}
                <div class="vl-historial-footer">
                    <button type="button" class="vl-hist-invoice-btn" onclick="imprimirFactura('${o.orderId || o.id}')" title="Ver factura">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <strong class="vl-historial-total">B/ ${Number(o.totales?.total || 0).toFixed(2)}</strong>
                </div>
            </div>
        `;
    }).join('');
}

function calcularResumenVentasLocales(orders) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let hoyTotal = 0;
    let mesTotal = 0;

    (orders || []).forEach((o) => {
        if (o.estado === 'cancelado') return;
        const total = Number(o.totales?.total) || 0;
        const fecha = new Date(o.fecha);
        if (fecha >= todayStart) hoyTotal += total;
        if (fecha >= monthStart) mesTotal += total;
    });

    const hoyEl = document.getElementById('vlHoyTotal');
    const mesEl = document.getElementById('vlMesTotal');
    if (hoyEl) hoyEl.textContent = `B/ ${hoyTotal.toFixed(2)}`;
    if (mesEl) mesEl.textContent = `B/ ${mesTotal.toFixed(2)}`;
}

// ============== VENTAS REALIZADAS LOCALES ==============

let vrVentasRealizadas = [];

async function cargarVentasRealizadas() {
    const container = document.getElementById('vrListaVentas');
    if (container) container.innerHTML = '<p class="muted"><i class="fas fa-spinner fa-spin"></i> Cargando ventas...</p>';

    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/local-sales`);
        const sales = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error('Error al cargar ventas');

        vrVentasRealizadas = sales;
        renderVentasRealizadas(sales);
        actualizarStatsVentasRealizadas(sales);
    } catch (err) {
        console.error('Error loading completed sales:', err);
        if (container) container.innerHTML = '<p class="muted">Error al cargar ventas</p>';
    }
}

function filtrarVentasRealizadas() {
    const search = (document.getElementById('vrSearchInput')?.value || '').toLowerCase().trim();
    if (!search) {
        renderVentasRealizadas(vrVentasRealizadas);
        return;
    }
    const filtered = vrVentasRealizadas.filter((s) =>
        (s.cliente?.nombre || '').toLowerCase().includes(search) ||
        (s.saleId || '').toLowerCase().includes(search) ||
        (s.mesa || '').toLowerCase().includes(search)
    );
    renderVentasRealizadas(filtered);
}

function renderVentasRealizadas(sales) {
    const container = document.getElementById('vrListaVentas');
    if (!container) return;

    if (!sales || sales.length === 0) {
        container.innerHTML = '<div class="vl-empty"><i class="fas fa-history"></i><p>No hay ventas realizadas</p></div>';
        return;
    }

    container.innerHTML = sales.map((s) => {
        const fecha = s.fecha ? new Date(s.fecha).toLocaleString('es-PA') : '—';
        const totalItems = (s.productos || []).reduce((sum, p) => sum + (p.cantidad || 0), 0);
        const itemsHtml = (s.productos || []).map((p) => {
            const sub = (Number(p.precio) || 0) * (p.cantidad || 0);
            return `<div class="vr-item"><span class="vr-item-qty">${p.cantidad}x</span> <span class="vr-item-name">${p.nombre}</span> <span class="vr-item-sub">B/ ${sub.toFixed(2)}</span></div>`;
        }).join('');

        return `
            <div class="vr-sale-card">
                <div class="vr-sale-header">
                    <div class="vr-sale-header-left">
                        <span class="vr-sale-id">${s.saleId}</span>
                        ${s.mesa ? `<span class="vr-sale-mesa"><i class="fas fa-chair"></i> Mesa ${s.mesa}</span>` : ''}
                    </div>
                    <span class="vr-sale-fecha">${fecha}</span>
                </div>
                <div class="vr-sale-cliente">
                    <i class="fas fa-user"></i> <strong>${s.cliente?.nombre || '—'}</strong>
                    <span class="vr-sale-count">${totalItems} producto${totalItems === 1 ? '' : 's'}</span>
                </div>
                <div class="vr-sale-products">${itemsHtml}</div>
                ${s.notas ? `<div class="vr-sale-notas"><i class="fas fa-sticky-note"></i> ${s.notas}</div>` : ''}
                <div class="vr-sale-footer">
                    <strong class="vr-sale-total">B/ ${Number(s.totales?.total || 0).toFixed(2)}</strong>
                    <div class="vr-sale-actions">
                        <button type="button" class="vr-action-btn vr-action-btn--invoice" onclick="verFacturaLocal('${s.saleId}')" title="Ver factura">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                        <button type="button" class="vr-action-btn vr-action-btn--reorder" onclick="reordenarVenta('${s.saleId}')" title="Reordenar">
                            <i class="fas fa-redo"></i>
                        </button>
                        <button type="button" class="vr-action-btn vr-action-btn--edit" onclick="editarVentaLocal('${s.saleId}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="vr-action-btn vr-action-btn--delete" onclick="eliminarVentaRealizada('${s.saleId}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function actualizarStatsVentasRealizadas(sales) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    let totalIngresos = 0;
    let hoyIngresos = 0;

    (sales || []).forEach((s) => {
        if (s.estado === 'cancelado') return;
        const total = Number(s.totales?.total) || 0;
        totalIngresos += total;
        if (new Date(s.fecha) >= todayStart) hoyIngresos += total;
    });

    const totalEl = document.getElementById('vrTotalVentas');
    const ingresosEl = document.getElementById('vrTotalIngresos');
    const hoyEl = document.getElementById('vrHoyIngresos');

    if (totalEl) totalEl.textContent = sales?.length || 0;
    if (ingresosEl) ingresosEl.textContent = `B/ ${totalIngresos.toFixed(2)}`;
    if (hoyEl) hoyEl.textContent = `B/ ${hoyIngresos.toFixed(2)}`;
}

async function verFacturaLocal(saleId) {
    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/local-sales/${saleId}/invoice`);
        if (!response.ok) throw new Error('Error al generar factura');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (err) {
        showToast(err.message || 'Error al abrir factura', 'error');
    }
}

async function reordenarVenta(saleId) {
    if (!confirm('¿Crear una nueva venta con los mismos productos?')) return;

    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/local-sales/${saleId}/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al reordenar');

        showToast(`✅ Reorden ${data.saleId} creado`, 'success');
        await cargarVentasRealizadas();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function editarVentaLocal(saleId) {
    const sale = vrVentasRealizadas.find((s) => s.saleId === saleId);
    if (!sale) {
        showToast('Venta no encontrada', 'error');
        return;
    }

    showSection('ventas-locales');

    setTimeout(() => {
        const nombreInput = document.getElementById('vlClienteNombre');
        const mesaInput = document.getElementById('vlMesa');
        const notasInput = document.getElementById('vlNotas');

        if (nombreInput) nombreInput.value = sale.cliente?.nombre || '';
        if (mesaInput) mesaInput.value = sale.mesa || '';
        if (notasInput) notasInput.value = sale.notas || '';

        vlItemsAgregados = (sale.productos || []).map((p) => ({
            id: p.id,
            nombre: p.nombre,
            precio: Number(p.precio) || 0,
            cantidad: p.cantidad || 1,
            categoria: p.categoria || '',
            imagen: p.imagen || ''
        }));

        renderCartItems();
        renderProductosGrid(vlProductosMenu);
        actualizarNombreCliente();

        showToast('Venta cargada para edición. Modifica y registra como nueva.', 'info');
    }, 300);
}

async function eliminarVentaRealizada(saleId) {
    if (!confirm('¿Eliminar esta venta? Esta acción no se puede deshacer.')) return;

    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/local-sales/${saleId}`, {
            method: 'DELETE'
        });
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al eliminar');

        showToast('Venta eliminada', 'success');
        await cargarVentasRealizadas();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.initVentasLocales = initVentasLocales;
window.actualizarNombreCliente = actualizarNombreCliente;
window.agregarProductoAlCarrito = agregarProductoAlCarrito;
window.aumentarCantidadItem = aumentarCantidadItem;
window.disminuirCantidadItem = disminuirCantidadItem;
window.removerItemVentaLocal = removerItemVentaLocal;
window.registrarVentaLocal = registrarVentaLocal;
window.filtrarProductosVentaLocal = filtrarProductosVentaLocal;
window.cargarHistorialVentasLocales = cargarHistorialVentasLocales;
window.cerrarConfirmacionVenta = cerrarConfirmacionVenta;
window.imprimirFactura = imprimirFactura;
window.cargarVentasRealizadas = cargarVentasRealizadas;
window.filtrarVentasRealizadas = filtrarVentasRealizadas;
window.verFacturaLocal = verFacturaLocal;
window.reordenarVenta = reordenarVenta;
window.editarVentaLocal = editarVentaLocal;
window.eliminarVentaRealizada = eliminarVentaRealizada;
