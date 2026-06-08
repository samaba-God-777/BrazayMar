/**
 * Sidebar de productos - Muestra catálogo completo con precios
 * Se actualiza automáticamente cuando se agregan productos desde el dashboard
 * Usa categorías dinámicas desde /api/categories
 */

(function() {
    // Estado del sidebar
    let isSidebarCollapsed = false;
    let allProducts = [];
    let categories = [];
    let currentUser = null;

    // Elementos DOM
    let sidebarToggle, sidebarOpenBtn, sidebarBody, sidebarSearch, sidebarProductCount;

    // API Base URL
    const API_BASE_URL = window.AppConfig?.API_BASE_URL || (() => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return `http://${window.location.hostname}:4000/api`;
        }
        return `${window.location.origin}/api`;
    })();

    // Traer categorías desde la API
    async function fetchCategories() {
        try {
            const res = await fetch(`${API_BASE_URL}/categories`);
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    // Traer productos + categorías desde el backend
    async function fetchProducts() {
        try {
            const response = await fetch(`${API_BASE_URL}/menu`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const menu = await response.json();
            const cats = (menu.categories && menu.categories.length)
                ? menu.categories
                : await fetchCategories();
            categories = cats;

            const items = menu.items || {};
            const products = [];
            for (const cat of cats) {
                const list = items[cat.id] || [];
                list.forEach((producto) => {
                    products.push({
                        ...producto,
                        categoria: cat.id,
                        categoriaName: cat.name,
                        categoriaIcon: cat.icon
                    });
                });
            }
            // Categorías huérfanas (productos con categoria que ya no existe en /categories)
            Object.keys(items).forEach((catId) => {
                if (!cats.some((c) => c.id === catId)) {
                    items[catId].forEach((producto) => {
                        products.push({
                            ...producto,
                            categoria: catId,
                            categoriaName: catId,
                            categoriaIcon: 'fa-utensils'
                        });
                    });
                }
            });

            allProducts = products;
            renderSidebarProducts();
            updateProductCount();
            return products;
        } catch (error) {
            console.error('Error cargando productos para sidebar:', error);
            if (sidebarBody) {
                sidebarBody.innerHTML = `
                    <div class="psidebar__error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error al cargar productos</p>
                        <button onclick="window.location.reload()">Reintentar</button>
                    </div>
                `;
            }
            return [];
        }
    }

    function getCategoryConfig(catId) {
        const cat = categories.find((c) => c.id === catId);
        return {
            id: catId,
            name: cat?.name || catId,
            icon: cat?.icon || 'fa-utensils',
            color: '#ff6b00'
        };
    }

    // Renderizar productos en el sidebar
    function renderSidebarProducts() {
        if (!sidebarBody) return;

        // Agrupar productos por categoría
        const grouped = {};
        allProducts.forEach((product) => {
            const cat = product.categoria || 'otros';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(product);
        });

        // Orden de las categorías según el array `categories`
        const orderedIds = [
            ...categories.map((c) => c.id),
            ...Object.keys(grouped).filter((id) => !categories.some((c) => c.id === id))
        ];

        const searchTerm = sidebarSearch?.value?.toLowerCase().trim() || '';

        let html = '';
        let hasResults = false;

        orderedIds.forEach((catId) => {
            const products = grouped[catId];
            if (!products || products.length === 0) return;

            const filteredProducts = searchTerm
                ? products.filter((p) =>
                    p.nombre?.toLowerCase().includes(searchTerm) ||
                    p.descripcion?.toLowerCase().includes(searchTerm) ||
                    p.categoriaName?.toLowerCase().includes(searchTerm)
                  )
                : products;

            if (filteredProducts.length === 0) return;
            hasResults = true;

            const config = getCategoryConfig(catId);

            html += `
                <div class="psidebar-category" data-category="${catId}">
                    <div class="psidebar-category__header">
                        <i class="fas ${config.icon}"></i>
                        <h3>${escapeHtml(config.name)}</h3>
                        <span class="psidebar-category__count">${filteredProducts.length}</span>
                    </div>
                    <div class="psidebar-category__items">
            `;

            filteredProducts.forEach((product) => {
                const imageUrl = buildProductImageUrl(product.imagen);
                const originalPrice = parseFloat(product.precio) || 0;
                const hasDiscount = product.descuento && product.descuento > 0;
                const finalPrice = hasDiscount
                    ? originalPrice * (1 - product.descuento / 100)
                    : originalPrice;
                const discountPercent = product.descuento || 0;

                const dataStr = JSON.stringify({
                    id: product.id,
                    nombre: product.nombre,
                    precio: product.precio,
                    descuento: discountPercent,
                    categoria: catId,
                    imagen: product.imagen
                }).replace(/'/g, '&#39;');

                html += `
                    <div class="psidebar-item" data-product-id="${product.id}" data-product='${dataStr}'>
                        <div class="psidebar-item__image">
                            <img src="${imageUrl}" alt="${escapeHtml(product.nombre)}" loading="lazy"
                                 onerror="this.onerror=null;this.src='/images/placeholder.png'">
                            ${discountPercent > 0 ? `<span class="psidebar-item__discount">-${discountPercent}%</span>` : ''}
                        </div>
                        <div class="psidebar-item__info">
                            <div class="psidebar-item__name">${escapeHtml(product.nombre)}</div>
                            <div class="psidebar-item__price">
                                ${hasDiscount ? `<span class="original-price">B/ ${originalPrice.toFixed(2)}</span>` : ''}
                                <span class="current-price">B/ ${finalPrice.toFixed(2)}</span>
                            </div>
                            <div class="psidebar-item__add-wrap">
                                <button type="button" class="psidebar-item__add" data-add-id="${product.id}" aria-label="Agregar al carrito" title="Agregar al carrito">
                                    <i class="fas fa-cart-plus"></i>
                                </button>
                                <span class="psidebar-item__add-badge" data-badge-id="${product.id}">0</span>
                                <span class="psidebar-item__add-float">+1</span>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        if (!hasResults && searchTerm) {
            html = `
                <div class="psidebar__no-results">
                    <i class="fas fa-search"></i>
                    <p>No se encontraron productos para "<strong>${escapeHtml(searchTerm)}</strong>"</p>
                </div>
            `;
        } else if (allProducts.length === 0) {
            html = `
                <div class="psidebar__empty">
                    <i class="fas fa-utensils"></i>
                    <p>No hay productos disponibles</p>
                    <small>Los productos aparecerán aquí cuando los agregues desde el panel de administración</small>
                </div>
            `;
        }

        sidebarBody.innerHTML = html;
        // Sincronizar badges con el carrito actual
        if (typeof syncAddBadges === 'function') syncAddBadges();
    }

    // Helper: construir URL de imagen
    function buildProductImageUrl(imagen) {
        if (!imagen) return `${(window.AppConfig?.SERVER_ORIGIN) || ''}/images/placeholder.png`;
        if (imagen.startsWith('http')) return imagen;
        if (imagen.startsWith('/')) {
            if (imagen.startsWith('//')) return imagen;
            return `${(window.AppConfig?.SERVER_ORIGIN) || ''}${imagen}`;
        }
        return `${(window.AppConfig?.SERVER_ORIGIN) || ''}/uploads/${imagen}`;
    }

    // Helper: escape HTML
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Actualizar contador de productos
    function updateProductCount() {
        const label = `${allProducts.length} producto${allProducts.length !== 1 ? 's' : ''}`;
        if (sidebarProductCount) sidebarProductCount.textContent = label;
        const headerCount = document.getElementById('sidebarProductCountHeader');
        if (headerCount) headerCount.textContent = label;
    }

    // Alternar colapso del sidebar
    function toggleSidebar() {
        const sidebar = document.getElementById('productsSidebar');
        const openBtn = document.getElementById('sidebarOpenBtn');
        const toggleIcon = sidebar?.querySelector('#sidebarToggle i');
        const tabIcon = document.getElementById('sidebarTabIcon');
        const tabLabel = document.getElementById('sidebarTabLabel');

        if (!sidebar) return;

        isSidebarCollapsed = !isSidebarCollapsed;

        if (isSidebarCollapsed) {
            sidebar.classList.add('collapsed');
            sidebar.classList.remove('is-open');
            document.body.classList.remove('sidebar-open');
            document.body.style.overflow = '';
            if (openBtn) openBtn.hidden = false;
            if (toggleIcon) toggleIcon.className = 'fas fa-chevron-left';
            if (tabIcon) tabIcon.className = 'fas fa-chevron-left';
            if (tabLabel) tabLabel.textContent = 'Mostrar';
            localStorage.setItem('sidebarCollapsed', 'true');
        } else {
            sidebar.classList.remove('collapsed');
            if (openBtn) openBtn.hidden = true;
            if (toggleIcon) toggleIcon.className = 'fas fa-chevron-right';
            if (tabIcon) tabIcon.className = 'fas fa-chevron-right';
            if (tabLabel) tabLabel.textContent = 'Ocultar';
            localStorage.setItem('sidebarCollapsed', 'false');
        }
    }

    // Cerrar el drawer en mobile (limpia estado + backdrop + scroll lock)
    function closeMobileDrawer() {
        const sidebar = document.getElementById('productsSidebar');
        if (!sidebar) return;
        sidebar.classList.remove('is-open');
        document.body.classList.remove('sidebar-open');
        document.body.style.overflow = '';
    }

    // Abrir el drawer en mobile (con backdrop + scroll lock)
    function openMobileDrawer() {
        const sidebar = document.getElementById('productsSidebar');
        if (!sidebar) return;
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('is-open');
        document.body.classList.add('sidebar-open');
        document.body.style.overflow = 'hidden';
    }

    // Estado actual del viewport
    function isMobileViewport() {
        return window.matchMedia('(max-width: 900px)').matches;
    }

    // Agregar al carrito desde el sidebar
    function addToCartFromSidebar(productId) {
        const product = allProducts.find((p) => p.id === productId);
        if (!product) return;

        // Animaciones: pulse + float
        const btn = document.querySelector(`[data-add-id="${productId}"]`);
        const wrap = btn?.closest('.psidebar-item__add-wrap');
        const float = wrap?.querySelector('.psidebar-item__add-float');
        if (btn) {
            btn.classList.remove('is-pulsing');
            void btn.offsetWidth; // restart anim
            btn.classList.add('is-pulsing');
            setTimeout(() => btn.classList.remove('is-pulsing'), 700);
        }
        if (float) {
            float.classList.remove('is-floating');
            void float.offsetWidth;
            float.classList.add('is-floating');
            setTimeout(() => float.classList.remove('is-floating'), 900);
        }

        const doAdd = () => {
            if (typeof window.agregarAlCarrito === 'function') {
                window.agregarAlCarrito(product.id, product.categoria, 1);
                showSidebarNotification(`✓ ${product.nombre} agregado al carrito`);
                // Actualizamos el badge después de que el carrito se actualice
                setTimeout(syncAddBadges, 50);
            } else {
                showSidebarNotification('Aún no se puede agregar al carrito', 'warning');
            }
        };

        if (typeof window.agregarAlCarrito === 'function') {
            doAdd();
        } else {
            // app.js aún no cargó; reintento en 300ms
            setTimeout(() => {
                if (typeof window.agregarAlCarrito === 'function') {
                    doAdd();
                } else {
                    showSidebarNotification('Aún no se puede agregar al carrito', 'warning');
                }
            }, 300);
        }
    }

    // Sincronizar los badges con la cantidad actual del carrito
    function syncAddBadges() {
        let cart = [];
        try {
            const key = (window.AuthService && typeof window.AuthService.cartKey === 'function')
                ? window.AuthService.cartKey()
                : 'brazasmar_cart';
            cart = JSON.parse(localStorage.getItem(key)) || [];
        } catch { cart = []; }

        document.querySelectorAll('.psidebar-item__add-badge').forEach((badge) => {
            const id = badge.dataset.badgeId;
            const item = cart.find((c) => c.id === id);
            const qty = item ? (item.cantidad || item.qty || 1) : 0;
            badge.textContent = qty;
            badge.classList.toggle('is-visible', qty > 0);
        });
    }
    window.syncAddBadges = syncAddBadges;

    // Mostrar notificación temporal
    function showSidebarNotification(message) {
        let container = document.getElementById('sidebarNotificationContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'sidebarNotificationContainer';
            container.className = 'sidebar-notification-container';
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = 'sidebar-notification';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        container.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2500);
    }

    // Escuchar cambios en el menú
    function listenForMenuUpdates() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'menu_updated') {
                fetchProducts();
                showSidebarNotification('Menú actualizado automáticamente');
            }
        });

        // Escuchar evento custom de carrito actualizado (disparado por app.js)
        window.addEventListener('cart:updated', () => {
            if (typeof syncAddBadges === 'function') syncAddBadges();
        });

        // Escuchar storage changes del carrito (multi-tab)
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.includes('cart')) {
                if (typeof syncAddBadges === 'function') syncAddBadges();
            }
        });

        setInterval(() => {
            const lastUpdate = localStorage.getItem('menu_updated');
            if (lastUpdate && lastUpdate !== window._lastMenuUpdate) {
                window._lastMenuUpdate = lastUpdate;
                fetchProducts();
            }
        }, 10000);
    }

    // Configurar event listeners
    function setupEventListeners() {
        sidebarToggle = document.getElementById('sidebarToggle');
        sidebarOpenBtn = document.getElementById('sidebarOpenBtn');
        sidebarSearch = document.getElementById('sidebarSearch');

        if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);

        // Tab lateral: toggle prominente que sobresale del sidebar
        const sidebarTab = document.getElementById('sidebarTab');
        if (sidebarTab) sidebarTab.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSidebar();
        });

        if (sidebarOpenBtn) {
            sidebarOpenBtn.addEventListener('click', () => {
                const sidebar = document.getElementById('productsSidebar');
                if (sidebar) {
                    if (isMobileViewport()) {
                        openMobileDrawer();
                    } else {
                        sidebar.classList.remove('collapsed');
                    }
                    if (sidebarOpenBtn) sidebarOpenBtn.hidden = true;
                    localStorage.setItem('sidebarCollapsed', 'false');
                    isSidebarCollapsed = false;
                    const toggleIcon = sidebar.querySelector('#sidebarToggle i');
                    if (toggleIcon) toggleIcon.className = 'fas fa-chevron-right';
                    const tabIcon = document.getElementById('sidebarTabIcon');
                    const tabLabel = document.getElementById('sidebarTabLabel');
                    if (tabIcon) tabIcon.className = 'fas fa-chevron-right';
                    if (tabLabel) tabLabel.textContent = 'Ocultar';
                }
            });
        }

        // === CERRAR AL TOCAR EL BACKDROP (mobile) ===
        document.addEventListener('click', (e) => {
            if (!isMobileViewport()) return;
            const sidebar = document.getElementById('productsSidebar');
            if (!sidebar || !sidebar.classList.contains('is-open')) return;
            if (sidebar.contains(e.target)) return;
            if (e.target.closest('#sidebarOpenBtn')) return;
            if (e.target.closest('#sidebarTab')) return;
            closeMobileDrawer();
        });

        // === ESC PARA CERRAR (mobile) ===
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isMobileViewport()) {
                const sidebar = document.getElementById('productsSidebar');
                if (sidebar && sidebar.classList.contains('is-open')) {
                    closeMobileDrawer();
                }
            }
        });

        // === SWIPE HACIA LA DERECHA PARA CERRAR (mobile) ===
        let touchStartX = 0;
        let touchStartY = 0;
        let touchCurrentX = 0;
        let isSwiping = false;
        const sidebar = document.getElementById('productsSidebar');

        if (sidebar) {
            sidebar.addEventListener('touchstart', (e) => {
                if (!isMobileViewport()) return;
                if (!sidebar.classList.contains('is-open')) return;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                isSwiping = true;
                sidebar.style.transition = 'none';
            }, { passive: true });

            sidebar.addEventListener('touchmove', (e) => {
                if (!isSwiping) return;
                touchCurrentX = e.touches[0].clientX;
                const touchCurrentY = e.touches[0].clientY;
                const diffX = touchCurrentX - touchStartX;
                const diffY = Math.abs(touchCurrentY - touchStartY);
                if (diffX > 0 && diffY < 60) {
                    e.preventDefault();
                    sidebar.style.transform = `translateX(${diffX}px)`;
                } else {
                    isSwiping = false;
                }
            }, { passive: false });

            sidebar.addEventListener('touchend', () => {
                if (!isSwiping) return;
                isSwiping = false;
                sidebar.style.transition = '';
                const diffX = touchCurrentX - touchStartX;
                if (diffX > 80) {
                    closeMobileDrawer();
                } else {
                    sidebar.style.transform = '';
                }
            });
        }

        // === RESET EN RESIZE (mobile ↔ desktop) ===
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const sb = document.getElementById('productsSidebar');
                if (!sb) return;
                if (isMobileViewport()) {
                    // Pasamos a mobile: limpio backdrop y scroll lock
                    if (!sb.classList.contains('is-open')) {
                        sb.classList.add('collapsed');
                    }
                } else {
                    // Pasamos a desktop: quito clases mobile y dejo el estado guardado
                    sb.classList.remove('is-open');
                    document.body.classList.remove('sidebar-open');
                    document.body.style.overflow = '';
                    const saved = localStorage.getItem('sidebarCollapsed');
                    if (saved === 'true') {
                        sb.classList.add('collapsed');
                        isSidebarCollapsed = true;
                    } else {
                        sb.classList.remove('collapsed');
                        isSidebarCollapsed = false;
                    }
                }
            }, 150);
        });

        if (sidebarSearch) {
            sidebarSearch.addEventListener('input', () => {
                renderSidebarProducts();
            });
        }

        // Delegación de clicks para botones "Agregar" (funciona aunque se re-renderice)
        if (sidebarBody) {
            sidebarBody.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-add-id]');
                if (!btn) return;
                e.preventDefault();
                addToCartFromSidebar(btn.dataset.addId);
            });
        }

        // Estado guardado del colapso
        const savedState = localStorage.getItem('sidebarCollapsed');
        const isMobile = window.matchMedia('(max-width: 900px)').matches;
        if (savedState === 'true' && !isMobile) {
            setTimeout(() => {
                const sidebar = document.getElementById('productsSidebar');
                const openBtn = document.getElementById('sidebarOpenBtn');
                if (sidebar) {
                    sidebar.classList.add('collapsed');
                    const toggleIcon = sidebar.querySelector('#sidebarToggle i');
                    if (toggleIcon) toggleIcon.className = 'fas fa-chevron-left';
                    const tabIcon = document.getElementById('sidebarTabIcon');
                    const tabLabel = document.getElementById('sidebarTabLabel');
                    if (tabIcon) tabIcon.className = 'fas fa-chevron-left';
                    if (tabLabel) tabLabel.textContent = 'Mostrar';
                }
                if (openBtn) openBtn.hidden = false;
                isSidebarCollapsed = true;
            }, 100);
        }
    }

    // Inicializar el sidebar
    async function initSidebar() {
        sidebarBody = document.getElementById('sidebarBody');
        sidebarProductCount = document.getElementById('sidebarProductCount');

        if (!sidebarBody) {
            console.warn('Sidebar body no encontrado');
            return;
        }

        setupEventListeners();
        await fetchProducts();
        listenForMenuUpdates();

        if (typeof window.actualizarMenu === 'function') {
            const originalUpdate = window.actualizarMenu;
            window.actualizarMenu = function() {
                originalUpdate();
                fetchProducts();
            };
        }
    }

    window.refreshSidebarProducts = fetchProducts;
    window.addToCartFromSidebar = addToCartFromSidebar;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
})();
