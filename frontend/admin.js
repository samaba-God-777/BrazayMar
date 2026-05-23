const API_BASE_URL = window.AppConfig?.API_BASE_URL || AuthService.getApiBase();

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
    pedidos: {
        title: 'Pedidos de clientes',
        description: 'Pedidos enviados desde la tienda en tiempo real'
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

async function cargarProductos() {
    try {
        const response = await fetch(`${API_BASE_URL}/menu`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const menu = await AppConfig.parseJsonResponse(response);
        products = [];

        for (const categoria in menu) {
            if (Array.isArray(menu[categoria])) {
                menu[categoria].forEach((producto) => {
                    products.push({ ...producto, categoria });
                });
            }
        }

        filteredProducts = [...products];
        updateDashboardStats(menu);
        applyFilters();
    } catch (error) {
        console.error('Error cargando productos:', error);
        mostrarMensaje(error.message || 'Error al cargar productos. Verifica el servidor.', 'error');
    }
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
    currentUser = await AuthService.requireAuth();
    if (!currentUser) return;

    setupForm();
    setupFilters();
    setupImagePreview();
    await cargarProductos();
    if (typeof initAdminOrders === 'function') {
        initAdminOrders();
    }
    showSection('add');

    window.addEventListener('storage', (e) => {
        if (e.key === 'menu_updated') cargarProductos();
    });
});

window.showSection = showSection;
window.deleteProduct = deleteProduct;
window.editarProducto = editarProducto;
window.resetForm = resetForm;
window.refreshData = refreshData;
window.logout = logout;
