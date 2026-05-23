<!-- products-sidebar.js -->
/**
 * Sidebar de productos - Muestra catálogo completo con precios
 * Se actualiza automáticamente cuando se agregan productos desde el dashboard
 */

(function() {
    // Estado del sidebar
    let isSidebarCollapsed = false;
    let allProducts = [];
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

    // Función para obtener productos desde el backend
    async function fetchProducts() {
        try {
            const response = await fetch(`${API_BASE_URL}/menu`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const menu = await response.json();
            
            // Convertir el objeto menu a un array plano de productos
            const products = [];
            for (const categoria in menu) {
                if (Array.isArray(menu[categoria])) {
                    menu[categoria].forEach(producto => {
                        products.push({
                            ...producto,
                            categoria: categoria
                        });
                    });
                }
            }
            
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

    // Renderizar productos en el sidebar
    function renderSidebarProducts() {
        if (!sidebarBody) return;

        // Agrupar productos por categoría
        const grouped = {
            hamburguesas: [],
            especiales: [],
            cerdo: []
        };

        allProducts.forEach(product => {
            const cat = product.categoria || 'hamburguesas';
            if (grouped[cat]) {
                grouped[cat].push(product);
            } else {
                grouped.hamburguesas.push(product);
            }
        });

        // Definir íconos y títulos por categoría
        const categoryConfig = {
            hamburguesas: { icon: 'fa-burger', title: '🍔 Hamburguesas', color: '#ff6b00' },
            especiales: { icon: 'fa-star', title: '⭐ Especiales', color: '#ff9a3c' },
            cerdo: { icon: 'fa-drumstick-bite', title: '🐷 Combo Cerdo', color: '#e63946' }
        };

        // Aplicar filtro de búsqueda si existe
        const searchTerm = sidebarSearch?.value?.toLowerCase().trim() || '';
        
        let html = '';
        let hasResults = false;

        for (const [cat, products] of Object.entries(grouped)) {
            const filteredProducts = searchTerm 
                ? products.filter(p => 
                    p.nombre?.toLowerCase().includes(searchTerm) || 
                    p.descripcion?.toLowerCase().includes(searchTerm)
                  )
                : products;
            
            if (filteredProducts.length === 0) continue;
            hasResults = true;
            
            const config = categoryConfig[cat] || categoryConfig.hamburguesas;
            
            html += `
                <div class="psidebar-category" data-category="${cat}">
                    <div class="psidebar-category__header">
                        <i class="fas ${config.icon}"></i>
                        <h3>${config.title}</h3>
                        <span class="psidebar-category__count">${filteredProducts.length}</span>
                    </div>
                    <div class="psidebar-category__items">
            `;
            
            filteredProducts.forEach(product => {
                const imageUrl = buildProductImageUrl(product.imagen);
                const hasDiscount = product.descuento && product.descuento > 0;
                const finalPrice = hasDiscount 
                    ? product.precio * (1 - product.descuento / 100)
                    : product.precio;
                const discountPercent = product.descuento || 0;
                
                html += `
                    <div class="psidebar-item" data-product-id="${product.id}" data-product='${JSON.stringify({
                        id: product.id,
                        nombre: product.nombre,
                        precio: product.precio,
                        descuento: discountPercent,
                        categoria: cat,
                        imagen: product.imagen
                    }).replace(/'/g, "&#39;")}'>
                        <div class="psidebar-item__image">
                            <img src="${imageUrl}" alt="${escapeHtml(product.nombre)}" loading="lazy"
                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23ccc\'%3E%3Cpath d=\'M4 16l4-4 4 4 4-4 4 4\'/%3E%3C/svg%3E'">
                            ${discountPercent > 0 ? `<span class="psidebar-item__discount">-${discountPercent}%</span>` : ''}
                        </div>
                        <div class="psidebar-item__info">
                            <div class="psidebar-item__name">${escapeHtml(product.nombre)}</div>
                            <div class="psidebar-item__price">
                                ${hasDiscount ? `<span class="original-price">B/ ${product.precio.toFixed(2)}</span>` : ''}
                                <span class="current-price">B/ ${finalPrice.toFixed(2)}</span>
                            </div>
                            <button class="psidebar-item__add" onclick="window.addToCartFromSidebar && window.addToCartFromSidebar('${product.id}')">
                                <i class="fas fa-plus"></i> Agregar
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
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
    }

    // Helper: construir URL de imagen
    function buildProductImageUrl(imagen) {
        if (!imagen) return '/images/placeholder.png';
        if (imagen.startsWith('http')) return imagen;
        if (imagen.startsWith('/')) return imagen;
        return `/uploads/${imagen}`;
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
        if (sidebarProductCount) {
            sidebarProductCount.textContent = `${allProducts.length} producto${allProducts.length !== 1 ? 's' : ''}`;
        }
    }

    // Alternar colapso del sidebar
    function toggleSidebar() {
        const sidebar = document.getElementById('productsSidebar');
        const openBtn = document.getElementById('sidebarOpenBtn');
        
        if (!sidebar) return;
        
        isSidebarCollapsed = !isSidebarCollapsed;
        
        if (isSidebarCollapsed) {
            sidebar.classList.add('collapsed');
            if (openBtn) openBtn.hidden = false;
            localStorage.setItem('sidebarCollapsed', 'true');
        } else {
            sidebar.classList.remove('collapsed');
            if (openBtn) openBtn.hidden = true;
            localStorage.setItem('sidebarCollapsed', 'false');
        }
    }

    // Función global para agregar al carrito desde sidebar
    window.addToCartFromSidebar = function(productId) {
        const product = allProducts.find(p => p.id == productId);
        if (product && window.addToCart) {
            window.addToCart(product.id);
            // Mostrar notificación
            showSidebarNotification(`✓ ${product.nombre} agregado al carrito`);
        } else if (!window.addToCart) {
            console.warn('Función addToCart no disponible aún');
            // Intentar de nuevo después
            setTimeout(() => {
                if (window.addToCart) {
                    const p = allProducts.find(p => p.id == productId);
                    if (p) window.addToCart(productId);
                }
            }, 500);
        }
    };

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

    // Escuchar cambios en localStorage (cuando se actualiza el menú desde admin)
    function listenForMenuUpdates() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'menu_updated') {
                fetchProducts();
                showSidebarNotification('Menú actualizado automáticamente');
            }
        });
        
        // También verificar periódicamente (cada 10 segundos) para cambios en la misma pestaña
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
        
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', toggleSidebar);
        }
        
        if (sidebarOpenBtn) {
            sidebarOpenBtn.addEventListener('click', () => {
                const sidebar = document.getElementById('productsSidebar');
                if (sidebar) {
                    sidebar.classList.remove('collapsed');
                    if (sidebarOpenBtn) sidebarOpenBtn.hidden = true;
                    localStorage.setItem('sidebarCollapsed', 'false');
                    isSidebarCollapsed = false;
                }
            });
        }
        
        if (sidebarSearch) {
            sidebarSearch.addEventListener('input', () => {
                renderSidebarProducts();
            });
        }
        
        // Cargar estado guardado
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'true') {
            setTimeout(() => {
                const sidebar = document.getElementById('productsSidebar');
                const openBtn = document.getElementById('sidebarOpenBtn');
                if (sidebar) sidebar.classList.add('collapsed');
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
        
        // Si hay función global de actualización de menú, sincronizar
        if (typeof window.actualizarMenu === 'function') {
            const originalUpdate = window.actualizarMenu;
            window.actualizarMenu = function() {
                originalUpdate();
                fetchProducts();
            };
        }
    }

    // Exportar funciones globales
    window.refreshSidebarProducts = fetchProducts;
    
    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
})();