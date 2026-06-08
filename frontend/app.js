// Configuración (backend en el mismo origen — ver config.js)
const API_BASE_URL = window.AppConfig?.API_BASE_URL || `${window.location.origin}/api`;
const SERVER_ORIGIN = window.AppConfig?.SERVER_ORIGIN || window.location.origin;

// Variables globales
let currentUser = null;
function cargarCarrito() {
    try {
        return JSON.parse(localStorage.getItem(AuthService.cartKey())) || [];
    } catch {
        return [];
    }
}
let carrito = cargarCarrito();
let currentSlide = {};
let productosCantidad = {}; // Almacena cantidades temporales por producto

// Categorías (se cargan dinámicamente desde /api/categories)
let categorias = {}; // { id: { name, icon, order } }
let categoriasList = []; // [{ id, name, icon, order }]

const slideshowIntervals = {};
const showcaseState = {};

// DEBUG: Verificar que las funciones están disponibles
console.log('✅ App.js cargado');

// Inicializar
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Inicializando aplicación...');

    currentUser = await AuthService.verifySession();
    if (!currentUser) {
        window.location.href = AppConfig.LOGIN_URL;
        return;
    }

    carrito = cargarCarrito();
    renderUserChip();
    renderAccountNav();

    // Si es admin, mostrar banner y botón "Volver al panel"
    if (currentUser.role === 'admin') {
        renderAdminBanner();
    }

    // Actualizar año
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // Cargar menú
    cargarMenu();

    // Inicializar carrito
    inicializarCarrito();

    // Configurar eventos
    configurarEventos();

    // Configurar botón de email
    configurarBotonEmail();

    initMenuNavbar();

    // Hacer funciones globales disponibles
    hacerFuncionesGlobales();
});

function renderAdminBanner() {
    const banner = document.createElement('div');
    banner.className = 'admin-mode-banner';
    banner.innerHTML = `
        <div class="admin-mode-banner__inner">
            <i class="fas fa-user-shield"></i>
            <span><strong>Modo administrador</strong> — Estás viendo la tienda como admin. Los pedidos que hagas también aparecerán en el panel.</span>
            <a href="${AppConfig.ADMIN_DASHBOARD_URL}" class="admin-mode-banner__btn">
                <i class="fas fa-arrow-left"></i> Volver al panel
            </a>
        </div>
    `;
    document.body.prepend(banner);
}

function renderUserChip() {
    const host = document.getElementById('userChip');
    if (!host) return;
    if (!currentUser) {
        host.innerHTML = '';
        return;
    }
    const initial = (currentUser.name || currentUser.username || 'U').charAt(0).toUpperCase();
    const isAdmin = currentUser.role === 'admin';
    const displayName = currentUser.name || currentUser.username;
    const roleLabel = isAdmin ? 'Administrador' : 'Cliente';

    host.innerHTML = `
        <div class="user-chip-wrap" id="userChipWrap">
            <button type="button" class="user-chip ${isAdmin ? 'is-admin' : ''}" id="userChipBtn" aria-haspopup="menu" aria-expanded="false">
                <span class="user-chip__avatar">${initial}</span>
                <span class="user-chip__name">${displayName}</span>
                <i class="fas fa-chevron-down user-chip__caret"></i>
            </button>
            <div class="user-menu" role="menu" id="userMenu">
                <div class="user-menu__header">
                    <div class="user-menu__name">${displayName}</div>
                    <div class="user-menu__role ${isAdmin ? 'user-menu__role--admin' : ''}">${roleLabel}</div>
                </div>
                <a href="${AppConfig.ACCOUNT_URL}" class="user-menu__item" role="menuitem">
                    <i class="fas fa-user"></i> Mi cuenta
                </a>
                <a href="${AppConfig.ACCOUNT_URL}#orders" class="user-menu__item" role="menuitem">
                    <i class="fas fa-receipt"></i> Mis pedidos
                </a>
                ${isAdmin ? `
                <div class="user-menu__divider"></div>
                <a href="${AppConfig.ADMIN_DASHBOARD_URL}" class="user-menu__item user-menu__item--admin" role="menuitem">
                    <i class="fas fa-tachometer-alt"></i> Panel admin
                </a>
                ` : ''}
                <div class="user-menu__divider"></div>
                <button type="button" class="user-menu__item user-menu__item--danger" id="userLogoutBtn" role="menuitem">
                    <i class="fas fa-sign-out-alt"></i> Cerrar sesión
                </button>
            </div>
        </div>
    `;

    const wrap = document.getElementById('userChipWrap');
    const btn = document.getElementById('userChipBtn');
    btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = wrap.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.getElementById('userLogoutBtn')?.addEventListener('click', () => {
        if (confirm('¿Cerrar sesión?')) AuthService.logout();
    });
    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) {
            wrap.classList.remove('is-open');
            btn?.setAttribute('aria-expanded', 'false');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && wrap.classList.contains('is-open')) {
            wrap.classList.remove('is-open');
            btn?.setAttribute('aria-expanded', 'false');
            btn.focus();
        }
    });
}

function renderAccountNav() {
    const link = document.getElementById('accountNavLink');
    const label = document.getElementById('accountNavLabel');
    if (!link || !label) return;
    if (!currentUser) {
        link.href = AppConfig.LOGIN_URL;
        link.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span id="accountNavLabel">Ingresar</span>';
        link.style.display = '';
        return;
    }
    // Si hay sesión, ocultamos el botón "Ingresar/Mi cuenta" del topbar
    // porque ya mostramos el user-chip con dropdown.
    link.style.display = 'none';
}

// Hacer funciones disponibles globalmente
function hacerFuncionesGlobales() {
    window.agregarAlCarrito = agregarAlCarrito;
    window.toggleCantidadProducto = toggleCantidadProducto;
    window.cambiarCantidadProducto = cambiarCantidadProducto;
    window.confirmarCantidadProducto = confirmarCantidadProducto;
    window.toggleCart = toggleCart;
    window.clearCart = clearCart;
    window.checkout = checkout;
    window.cambiarCantidad = cambiarCantidad;
    window.eliminarDelCarrito = eliminarDelCarrito;
    window.cerrarModalCliente = cerrarModalCliente;
    window.confirmarInformacionCliente = confirmarInformacionCliente;
    window.cambiarSlide = cambiarSlide;
    window.irASlide = irASlide;
    window.actualizarMenu = cargarMenu;
}

// ==================== CARRITO CORREGIDO ====================

// Inicializar carrito
function inicializarCarrito() {
    console.log('🛒 Inicializando carrito...');
    console.log('📊 Carrito cargado:', carrito.length, 'productos');
    
    // Verificar que los elementos del DOM existan
    const cartCount = document.querySelector('.cart-count');
    if (cartCount) {
        console.log('✅ Elemento cart-count encontrado');
    } else {
        console.error('❌ Elemento cart-count NO encontrado');
    }
    
    actualizarContadorCarrito();
    actualizarCarritoUI();
}

// Calcular total de items
function calcularTotalItems() {
    return carrito.reduce((total, item) => total + item.cantidad, 0);
}

// Guardar carrito en localStorage
function guardarCarrito() {
    localStorage.setItem(AuthService.cartKey(), JSON.stringify(carrito));
    console.log('💾 Carrito guardado:', carrito);
}

// Agregar producto al carrito (SIMPLIFICADO PARA PRUEBAS)
async function agregarAlCarrito(productId, categoria, cantidad = 1) {
    console.log('➕ Agregando al carrito:', { productId, categoria, cantidad });
    
    try {
        let nombre, precio, imagen;

        // Buscar producto en el DOM del showcase
        const card = document.querySelector(`.menu-card[data-id="${productId}"]`);
        if (card) {
            nombre = card.querySelector('.product-showcase__title, .card-title')?.textContent || 'Producto';
            const precioTexto = card.querySelector('.product-showcase__price, .card-price')?.textContent || '0.00';
            precio = parseFloat(precioTexto.replace('B/ ', '').trim());
            imagen = card.querySelector('.product-showcase__media img, .card-img')?.src
                || `${SERVER_ORIGIN}/images/placeholder.png`;
        } else {
            // Fallback: buscar en el DOM del sidebar
            const sidebarItem = document.querySelector(`.psidebar-item[data-product-id="${productId}"]`);
            if (sidebarItem) {
                try {
                    const productData = JSON.parse(sidebarItem.getAttribute('data-product'));
                    nombre = productData.nombre;
                    const discount = productData.descuento || 0;
                    precio = discount > 0
                        ? productData.precio * (1 - discount / 100)
                        : productData.precio;
                    imagen = productData.imagen;
                    if (imagen) {
                        if (!imagen.startsWith('http') && !imagen.startsWith('/')) {
                            imagen = `${SERVER_ORIGIN}/uploads/${imagen}`;
                        } else if (imagen.startsWith('/')) {
                            imagen = `${SERVER_ORIGIN}${imagen}`;
                        }
                    } else {
                        imagen = `${SERVER_ORIGIN}/images/placeholder.png`;
                    }
                    categoria = productData.categoria;
                } catch (e) {
                    console.error('Error parsing product data from sidebar:', e);
                }
            }
        }

        if (!nombre) {
            console.error('❌ Producto no encontrado:', productId);
            mostrarNotificacion('Error: Producto no encontrado', 'error');
            return;
        }
        
        console.log('📦 Información del producto:', { nombre, precio, cantidad });
        
        // Buscar si ya está en el carrito
        const itemExistente = carrito.find(item => item.id === productId);
        
        if (itemExistente) {
            itemExistente.cantidad += cantidad;
            console.log('📈 Cantidad actualizada:', itemExistente.cantidad);
        } else {
            carrito.push({
                id: productId,
                nombre: nombre,
                precio: precio,
                imagen: imagen,
                categoria: categoria,
                cantidad: cantidad,
                agregadoEn: new Date().toISOString()
            });
            console.log('🆕 Nuevo producto agregado');
        }
        
        // Guardar en localStorage
        guardarCarrito();
        
        // Actualizar interfaz
        actualizarCarritoUI();
        actualizarContadorCarrito();
        
        // Mostrar notificación
        mostrarNotificacion(`✅ ${cantidad}x "${nombre}" agregado al carrito`, 'success');
        
        // Animación del icono
        animarIconoCarrito();
        
        // Mostrar carrito si es el primer item
        if (carrito.length === 1) {
            setTimeout(() => toggleCart(), 500);
        }
        
    } catch (error) {
        console.error('❌ Error agregando al carrito:', error);
        mostrarNotificacion('Error al agregar producto', 'error');
    }
}

// Vaciar DOM del carrito y liberar imágenes (evita fantasmas al eliminar)
function limpiarContenedorCarrito(container) {
    if (!container) return;
    container.querySelectorAll('img').forEach((img) => {
        img.onload = null;
        img.onerror = null;
        img.removeAttribute('src');
        img.src = '';
    });
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}

// Actualizar interfaz del carrito
function actualizarCarritoUI() {
    const cartItems = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartShipping = document.getElementById('cartShipping');
    const cartTotal = document.getElementById('cartTotal');

    if (!cartItems || !emptyCart) {
        console.error('❌ Elementos del carrito no encontrados en el DOM');
        return;
    }

    limpiarContenedorCarrito(cartItems);

    if (carrito.length === 0) {
        emptyCart.style.display = 'flex';
        emptyCart.hidden = false;
        cartItems.hidden = true;

        if (cartSubtotal) cartSubtotal.textContent = 'B/ 0.00';
        if (cartShipping) cartShipping.textContent = 'B/ 0.00';
        if (cartTotal) cartTotal.textContent = 'B/ 0.00';
        return;
    }

    emptyCart.style.display = 'none';
    emptyCart.hidden = true;
    cartItems.hidden = false;

    const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const envio = subtotal > 0 ? 2.00 : 0;
    const total = subtotal + envio;
    const placeholder = `${SERVER_ORIGIN}/images/placeholder.png`;

    carrito.forEach((item, index) => {
        const itemTotal = item.precio * item.cantidad;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.dataset.cartIndex = String(index);

        const imageWrap = document.createElement('div');
        imageWrap.className = 'cart-item-image';

        const img = document.createElement('img');
        img.alt = item.nombre;
        img.src = item.imagen || placeholder;
        img.onerror = () => {
            img.onerror = null;
            img.src = placeholder;
        };
        imageWrap.appendChild(img);

        if (item.cantidad > 1) {
            const badge = document.createElement('span');
            badge.className = 'item-quantity-badge';
            badge.textContent = String(item.cantidad);
            imageWrap.appendChild(badge);
        }

        const details = document.createElement('div');
        details.className = 'cart-item-details';
        details.innerHTML = `
            <h4>${item.nombre}</h4>
            <p>${item.cantidad} x B/ ${item.precio.toFixed(2)}</p>
            <div class="cart-item-total">B/ ${itemTotal.toFixed(2)}</div>
        `;

        const actions = document.createElement('div');
        actions.className = 'cart-item-actions';
        actions.innerHTML = `
            <div class="quantity-controls">
                <button type="button" class="btn-qty minus" aria-label="Menos">
                    <i class="fas fa-minus"></i>
                </button>
                <span class="quantity">${item.cantidad}</span>
                <button type="button" class="btn-qty plus" aria-label="Más">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <button type="button" class="btn-remove" aria-label="Eliminar">
                <i class="fas fa-trash"></i>
            </button>
        `;

        actions.querySelector('.minus').addEventListener('click', () => cambiarCantidad(index, -1));
        actions.querySelector('.plus').addEventListener('click', () => cambiarCantidad(index, 1));
        actions.querySelector('.btn-remove').addEventListener('click', () => eliminarDelCarrito(index));

        cartItem.append(imageWrap, details, actions);
        cartItems.appendChild(cartItem);
    });

    if (cartSubtotal) cartSubtotal.textContent = `B/ ${subtotal.toFixed(2)}`;
    if (cartShipping) cartShipping.textContent = `B/ ${envio.toFixed(2)}`;
    if (cartTotal) cartTotal.textContent = `B/ ${total.toFixed(2)}`;
}

// Cambiar cantidad
function cambiarCantidad(index, cambio) {
    console.log('🔄 Cambiando cantidad:', { index, cambio });
    
    if (index < 0 || index >= carrito.length) return;
    
    const item = carrito[index];
    const nuevaCantidad = item.cantidad + cambio;
    
    if (nuevaCantidad < 1) {
        eliminarDelCarrito(index);
        return;
    }
    
    if (nuevaCantidad > 99) {
        mostrarNotificacion('Máximo 99 unidades por producto', 'warning');
        return;
    }
    
    item.cantidad = nuevaCantidad;
    guardarCarrito();
    actualizarCarritoUI();
    actualizarContadorCarrito();
    
    mostrarNotificacion(`Cantidad actualizada: ${nuevaCantidad}x ${item.nombre}`, 'info');
}

// Eliminar del carrito
function eliminarDelCarrito(index) {
    if (index < 0 || index >= carrito.length) return;
    
    const item = carrito[index];
    const confirmar = confirm(`¿Eliminar ${item.cantidad}x "${item.nombre}" del carrito?`);
    
    if (confirmar) {
        carrito.splice(index, 1);
        guardarCarrito();
        actualizarCarritoUI();
        actualizarContadorCarrito();
        mostrarNotificacion(`🗑️ ${item.nombre} eliminado del carrito`, 'warning');
    }
}

// Vaciar carrito
function clearCart() {
    if (carrito.length === 0) {
        mostrarNotificacion('El carrito ya está vacío', 'info');
        return;
    }
    
    const totalItems = calcularTotalItems();
    const confirmar = confirm(`¿Vaciar carrito?\nSe eliminarán ${totalItems} productos.`);
    
    if (confirmar) {
        carrito = [];
        guardarCarrito();
        actualizarCarritoUI();
        actualizarContadorCarrito();
        mostrarNotificacion('Carrito vaciado', 'warning');
    }
}

// Actualizar contador
function actualizarContadorCarrito() {
    const totalItems = calcularTotalItems();
    document.querySelectorAll('.cart-count').forEach((el) => {
        el.textContent = totalItems;
        el.style.display = totalItems > 0 ? 'flex' : 'none';
    });
    const top = document.getElementById('topbarCartCount');
    if (top) {
        top.textContent = totalItems;
        top.style.display = totalItems > 0 ? 'inline-flex' : 'none';
    }
    // Notificar al sidebar (y otros listeners) que el carrito cambió
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { totalItems } }));
    console.log('🔢 Contador actualizado:', totalItems);
}

// Animación del icono
function animarIconoCarrito() {
    const cartIcon = document.querySelector('.cart-floating');
    if (cartIcon) {
        cartIcon.style.transform = 'scale(1.2)';
        setTimeout(() => {
            cartIcon.style.transform = 'scale(1)';
        }, 300);
    }
}

// Mostrar/ocultar carrito
function toggleCart() {
    const cartModal = document.getElementById('cartModal');
    if (!cartModal) {
        console.error('❌ Modal del carrito no encontrado');
        return;
    }
    
    cartModal.classList.toggle('active');
    console.log('🎪 Modal del carrito:', cartModal.classList.contains('active') ? 'abierto' : 'cerrado');
    
    // Bloquear scroll
    document.body.style.overflow = cartModal.classList.contains('active') ? 'hidden' : 'auto';
}

// ==================== CHECKOUT CORREGIDO ====================

// Finalizar pedido
async function checkout() {
    console.log('🚀 Iniciando checkout...');

    if (!currentUser) {
        mostrarNotificacion('Inicia sesión para finalizar tu pedido', 'warning');
        setTimeout(() => { window.location.href = AppConfig.LOGIN_URL; }, 800);
        return;
    }

    if (carrito.length === 0) {
        mostrarNotificacion('El carrito está vacío', 'warning');
        return;
    }

    try {
        // Obtener información del cliente
        const clienteInfo = await obtenerInformacionCliente();
        if (!clienteInfo) {
            console.log('❌ Usuario canceló el checkout');
            return;
        }

        // Generar resumen
        const resumen = generarResumenPedido(clienteInfo);

        // Mostrar confirmación
        const confirmar = confirm(`${resumen.mensaje}\n\n¿Confirmar y enviar pedido?`);

        if (confirmar) {
            // Enviar al administrador
            const resultado = await enviarPedidoAlAdmin(resumen);

            if (resultado.success) {
                // Limpiar carrito
                carrito = [];
                guardarCarrito();
                actualizarCarritoUI();
                actualizarContadorCarrito();

                // Mostrar éxito
                mostrarNotificacion('✅ Pedido enviado al administrador', 'success');
                toggleCart();

                // Mostrar confirmación final
                alert(`🎉 ¡Pedido confirmado!\n\nID: ${resultado.orderId}\nTotal: B/ ${resumen.totales.total.toFixed(2)}\n\nEl administrador te contactará pronto.`);
            } else {
                throw new Error(resultado.error);
            }
        }

    } catch (error) {
        console.error('❌ Error en checkout:', error);
        mostrarNotificacion(`Error: ${error.message}`, 'error');
    }
}

// Obtener información del cliente
async function obtenerInformacionCliente() {
    return new Promise((resolve) => {
        const modalHTML = `
            <div class="checkout-modal" id="clienteModal">
                <div class="modal-content checkout-modal__panel">
                    <h3><i class="fas fa-paper-plane"></i> Datos de entrega</h3>
                    <p class="checkout-modal__subtitle">Confirma tu información para enviar el pedido al administrador</p>
                    <div class="form-group">
                        <label>Nombre completo *</label>
                        <input type="text" id="clienteNombre" required placeholder="Tu nombre" value="${(currentUser?.name || '').replace(/"/g, '&quot;')}">
                    </div>
                    <div class="form-group">
                        <label>Teléfono *</label>
                        <input type="tel" id="clienteTelefono" required placeholder="Tu teléfono" value="${(currentUser?.phone || '').replace(/"/g, '&quot;')}">
                    </div>
                    <div class="form-group">
                        <label>Dirección *</label>
                        <textarea id="clienteDireccion" required placeholder="Dirección completa">${(currentUser?.address || '').replace(/</g, '&lt;')}</textarea>
                    </div>
                    <div class="modal-actions">
                        <button onclick="cerrarModalCliente()" class="btn-cancelar">Cancelar</button>
                        <button onclick="confirmarCliente()" class="btn-confirmar">Confirmar</button>
                    </div>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.id = 'clienteModalContainer';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
        let informacionCliente = null;
        let resuelto = false;
        
        // Función global para cerrar
        window.cerrarModalCliente = function() {
            document.getElementById('clienteModalContainer')?.remove();
            if (!resuelto) {
                resolve(null);
                resuelto = true;
            }
        };
        
        // Función global para confirmar
        window.confirmarCliente = function() {
            const nombre = document.getElementById('clienteNombre').value.trim();
            const telefono = document.getElementById('clienteTelefono').value.trim();
            const direccion = document.getElementById('clienteDireccion').value.trim();
            
            if (!nombre || !telefono || !direccion) {
                alert('Por favor completa todos los campos');
                return;
            }
            
            informacionCliente = {
                nombre: nombre,
                telefono: telefono,
                direccion: direccion,
                fecha: new Date().toISOString()
            };
            
            document.getElementById('clienteModalContainer')?.remove();
            if (!resuelto) {
                resolve(informacionCliente);
                resuelto = true;
            }
        };
    });
}

// Generar resumen del pedido
function generarResumenPedido(clienteInfo) {
    const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const envio = subtotal > 0 ? 2.00 : 0;
    const total = subtotal + envio;
    const totalItems = calcularTotalItems();
    
    let resumenTexto = '=== PEDIDO BRAZAS$MAR ===\n\n';
    
    carrito.forEach((item, index) => {
        resumenTexto += `${index + 1}. ${item.nombre}\n`;
        resumenTexto += `   Cantidad: ${item.cantidad} unidades\n`;
        resumenTexto += `   Precio: B/ ${item.precio.toFixed(2)} c/u\n`;
        resumenTexto += `   Total: B/ ${(item.precio * item.cantidad).toFixed(2)}\n\n`;
    });
    
    resumenTexto += `Subtotal: B/ ${subtotal.toFixed(2)}\n`;
    resumenTexto += `Envío: B/ ${envio.toFixed(2)}\n`;
    resumenTexto += `TOTAL: B/ ${total.toFixed(2)}\n\n`;
    resumenTexto += '=== CLIENTE ===\n';
    resumenTexto += `Nombre: ${clienteInfo.nombre}\n`;
    resumenTexto += `Teléfono: ${clienteInfo.telefono}\n`;
    resumenTexto += `Dirección: ${clienteInfo.direccion}\n`;
    resumenTexto += `Fecha: ${new Date(clienteInfo.fecha).toLocaleString()}\n`;
    resumenTexto += `ID: PED-${Date.now().toString().slice(-8)}`;
    
    const mensajeAlert = `📦 Total productos: ${totalItems}\n💰 Total a pagar: B/ ${total.toFixed(2)}\n\n👤 Cliente: ${clienteInfo.nombre}\n📞 Tel: ${clienteInfo.telefono}\n📍 Dir: ${clienteInfo.direccion}`;
    
    return {
        resumen: resumenTexto,
        mensaje: mensajeAlert,
        cliente: clienteInfo,
        totales: { subtotal, envio, total, items: totalItems },
        productos: [...carrito]
    };
}

// Enviar pedido al administrador (MongoDB vía API)
async function enviarPedidoAlAdmin(resumen) {
    try {
        const payload = {
            cliente: {
                nombre: resumen.cliente.nombre,
                telefono: resumen.cliente.telefono,
                direccion: resumen.cliente.direccion,
                email: currentUser?.email || ''
            },
            productos: resumen.productos.map((item) => ({
                id: item.id,
                nombre: item.nombre,
                precio: item.precio,
                cantidad: item.cantidad,
                categoria: item.categoria,
                imagen: item.imagen
            })),
            totales: resumen.totales
        };

        const headers = { 'Content-Type': 'application/json' };
        const token = AuthService.getToken();
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        const data = await AppConfig.parseJsonResponse(response);

        if (!response.ok) {
            throw new Error(data.error || 'No se pudo enviar el pedido');
        }

        window.dispatchEvent(new CustomEvent('pedidoNuevo', { detail: data.order }));

        return {
            success: true,
            orderId: data.orderId,
            message: data.message || 'Pedido registrado correctamente'
        };
    } catch (error) {
        console.error('❌ Error guardando pedido:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Configurar botón de email
function configurarBotonEmail() {
    const emailBtn = document.getElementById('emailOrderBtn');
    if (!emailBtn) {
        console.warn('⚠️ Botón de email no encontrado');
        return;
    }
    
    emailBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        if (carrito.length === 0) {
            mostrarNotificacion('El carrito está vacío', 'warning');
            return;
        }
        
        // Generar cuerpo del email
        let body = 'Hola Brazas$Mar,%0D%0A%0D%0A';
        body += 'Quiero hacer el siguiente pedido:%0D%0A%0D%0A';
        
        carrito.forEach((item, index) => {
            body += `${index + 1}. ${item.nombre} x${item.cantidad} = B/ ${(item.precio * item.cantidad).toFixed(2)}%0D%0A`;
        });
        
        const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
        const envio = 2.00;
        const total = subtotal + envio;
        
        body += `%0D%0ATotal: B/ ${total.toFixed(2)}%0D%0A%0D%0A`;
        body += 'Información de contacto:%0D%0A';
        body += 'Nombre: [COMPLETAR]%0D%0A';
        body += 'Teléfono: [COMPLETAR]%0D%0A';
        body += 'Dirección: [COMPLETAR]%0D%0A';
        
        window.location.href = `mailto:pedidos@brazasmar.com?subject=Pedido Brazas$Mar&body=${body}`;
    });
}

// ==================== FUNCIONES AUXILIARES ====================

// Mostrar notificación
function mostrarNotificacion(mensaje, tipo = 'info') {
    const notificacion = document.createElement('div');
    notificacion.className = `notification ${tipo}`;
    notificacion.innerHTML = `
        <i class="fas ${tipo === 'error' ? 'fa-exclamation-circle' : 
                         tipo === 'warning' ? 'fa-exclamation-triangle' : 
                         tipo === 'success' ? 'fa-check-circle' : 
                         'fa-info-circle'}"></i>
        <span>${mensaje}</span>
    `;
    
    document.body.appendChild(notificacion);
    
    setTimeout(() => {
        notificacion.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notificacion.classList.remove('show');
        setTimeout(() => {
            notificacion.remove();
        }, 300);
    }, 3000);
}

// Configurar eventos
function configurarEventos() {
    // Cerrar carrito haciendo clic fuera
    document.addEventListener('click', function(e) {
        const cartModal = document.getElementById('cartModal');
        if (cartModal && cartModal.classList.contains('active') && e.target === cartModal) {
            toggleCart();
        }
    });
    
    // Cerrar carrito con ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const cartModal = document.getElementById('cartModal');
            if (cartModal && cartModal.classList.contains('active')) {
                toggleCart();
            }
        }
    });
    
    // Escuchar nuevos pedidos (para admin)
    window.addEventListener('pedidoNuevo', function(e) {
        console.log('📢 Nuevo pedido recibido:', e.detail);
        mostrarNotificacion('📦 Nuevo pedido recibido', 'success');
    });

    window.addEventListener('storage', function(e) {
        if (e.key === 'menu_updated') {
            cargarMenu();
        }
    });
}

// ==================== FUNCIONES DEL MENÚ ====================

// Conteo de productos por categoría (cacheado en el cliente)
let productosPorCategoria = {};
// Mapa de productos por categoría (id → array de productos) — para slideshows
let productosPorCategoriaLista = {};

// Cargar menú desde API
async function cargarMenu() {
    try {
        const response = await fetch(`${API_BASE_URL}/menu`);
        if (!response.ok) throw new Error('Error al cargar menú');

        const menu = await AppConfig.parseJsonResponse(response);
        categoriasList = menu.categories || [];
        categorias = {};
        productosPorCategoria = {};
        productosPorCategoriaLista = {};
        categoriasList.forEach((c) => { categorias[c.id] = c; });

        // Guardar productos por categoría (necesario ANTES de renderizar las secciones)
        for (const cat of categoriasList) {
            const productos = (menu.items && menu.items[cat.id]) || [];
            productosPorCategoria[cat.id] = productos.length;
            productosPorCategoriaLista[cat.id] = productos;
        }

        // 1) Primero pintamos el navbar (con conteos) y las secciones (con la estructura de slideshow)
        renderNavbarCategorias();
        renderMenuSections();

        // 2) Después, ya con los tracks en el DOM, llenamos los slideshows
        for (const cat of categoriasList) {
            mostrarProductosEnSlideshow(cat.id, productosPorCategoriaLista[cat.id] || []);
        }

        // 3) Cargar promos y contacto (en paralelo)
        await Promise.all([cargarPromos(), cargarContacto()]);
    } catch (error) {
        console.error('Error cargando menú:', error);
        mostrarProductosDeEjemplo();
        // Aún así intentamos cargar promos y contacto
        cargarPromos().catch(() => {});
        cargarContacto().catch(() => {});
    }
}

// ============== PROMOS ==============
let promosList = [];

async function cargarPromos() {
    const host = document.getElementById('promosGrid');
    if (!host) return;
    try {
        const response = await fetch(`${API_BASE_URL}/promos`, {
            headers: AuthService.authHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        promosList = await AppConfig.parseJsonResponse(response);
        renderPromos();
    } catch (error) {
        console.error('Error cargando promos:', error);
        if (host) {
            host.innerHTML = `
                <div class="promos-empty">
                    <i class="fas fa-fire"></i>
                    <p>Pronto publicaremos nuevas promociones</p>
                </div>
            `;
        }
    }
}

function renderPromos() {
    const host = document.getElementById('promosGrid');
    if (!host) return;
    if (!promosList.length) {
        host.innerHTML = `
            <div class="promos-empty">
                <i class="fas fa-fire"></i>
                <p>No hay promociones activas en este momento</p>
                <small>Vuelve pronto para descubrir nuevas ofertas</small>
            </div>
        `;
        return;
    }

    host.innerHTML = promosList.map((p) => {
        const imageUrl = buildPromoImageUrl(p);
        const hasDiscount = p.discountPercent > 0;
        const hasPrice = p.promoPrice != null && p.promoPrice > 0;
        const validity = formatPromoValidity(p);
        const now = new Date();
        const startsInFuture = p.validFrom && new Date(p.validFrom) > now;

        return `
            <article class="promo-card${startsInFuture ? ' promo-card--scheduled' : ''}">
                <div class="promo-card__media">
                    ${imageUrl
                        ? `<img src="${imageUrl}" alt="${escapeHtml(p.title)}" loading="lazy" onerror="this.onerror=null;this.parentNode.innerHTML='<div class=\\'promo-card__media-placeholder\\'><i class=\\'fas ${p.icon || 'fa-fire'}\\'></i></div>'">`
                        : `<div class="promo-card__media-placeholder"><i class="fas ${p.icon || 'fa-fire'}"></i></div>`}
                    ${p.badgeText ? `<span class="promo-card__badge">${escapeHtml(p.badgeText)}</span>` : ''}
                    ${hasDiscount ? `<span class="promo-card__discount">-${p.discountPercent}<small>%</small></span>` : ''}
                    ${startsInFuture ? `<span class="promo-card__scheduled-badge"><i class="far fa-clock"></i> Próximamente</span>` : ''}
                </div>
                <div class="promo-card__body">
                    <h3 class="promo-card__title">${escapeHtml(p.title)}</h3>
                    ${p.description ? `<p class="promo-card__desc">${escapeHtml(p.description)}</p>` : ''}
                    ${hasPrice ? `
                    <div class="promo-card__prices">
                        ${p.originalPrice ? `<span class="promo-card__price-old">B/ ${Number(p.originalPrice).toFixed(2)}</span>` : ''}
                        <span class="promo-card__price-new">B/ ${Number(p.promoPrice).toFixed(2)}</span>
                    </div>
                    ` : ''}
                    ${validity ? `<div class="promo-card__validity"><i class="far fa-clock"></i> ${validity}</div>` : ''}
                    <button type="button" class="promo-card__cta" onclick="document.getElementById('menu')?.scrollIntoView({behavior:'smooth'})">
                        <i class="fas fa-utensils"></i> Ver en el menú
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

function buildPromoImageUrl(promo) {
    if (!promo.image) return '';
    if (promo.image.startsWith('http')) return promo.image;
    if (promo.image.startsWith('/')) return `${SERVER_ORIGIN}${promo.image}`;
    return `${SERVER_ORIGIN}/uploads/${promo.image}`;
}

function formatPromoValidity(p) {
    const fmt = (d) => {
        if (!d) return null;
        const date = new Date(d);
        if (isNaN(date.getTime())) return null;
        return date.toLocaleDateString('es-PA', { day: '2-digit', month: 'short' });
    };
    const from = fmt(p.validFrom);
    const to = fmt(p.validUntil);
    if (from && to) return `Válido del ${from} al ${to}`;
    if (to) return `Válido hasta ${to}`;
    if (from) return `Válido desde ${from}`;
    return '';
}

// ============== CONTACTO ==============
let contactData = null;

async function cargarContacto() {
    const host = document.getElementById('contactoGrid');
    if (!host) return;
    try {
        const response = await fetch(`${API_BASE_URL}/contact`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        contactData = await AppConfig.parseJsonResponse(response);
        renderContacto();
    } catch (error) {
        console.error('Error cargando contacto:', error);
        host.innerHTML = `
            <div class="promos-empty">
                <i class="fas fa-headset"></i>
                <p>No se pudo cargar la información de contacto</p>
            </div>
        `;
    }
}

function renderContacto() {
    const host = document.getElementById('contactoGrid');
    if (!host || !contactData) return;
    const c = contactData;
    const waClean = String(c.whatsapp || '').replace(/\D/g, '');
    const waLink = waClean ? `https://wa.me/${waClean}` : null;
    const phoneLink = c.phone ? `tel:${c.phone.replace(/\s/g, '')}` : null;
    const emailLink = c.email ? `mailto:${c.email}` : null;
    const mapsLink = c.mapsUrl || (c.address ? `https://www.google.com/maps/search/${encodeURIComponent(c.address)}` : null);

    const scheduleHtml = (c.hours || []).map((h) => {
        if (h.closed) return `<li><span class="day">${escapeHtml(h.day)}</span><span class="closed">Cerrado</span></li>`;
        return `<li><span class="day">${escapeHtml(h.day)}</span><span class="hours">${escapeHtml(h.open || '—')} – ${escapeHtml(h.close || '—')}</span></li>`;
    }).join('');

    const hasSocial = c.facebook || c.instagram || c.tiktok || waLink;
    const socialsHtml = hasSocial ? `
        <div class="contacto-card contacto-social">
            <h3 class="contacto-social__title"><i class="fas fa-share-alt"></i> Síguenos</h3>
            <div class="contacto-social__links">
                ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener" class="contacto-social__link contacto-social__link--wa" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>` : ''}
                ${c.facebook ? `<a href="${c.facebook}" target="_blank" rel="noopener" class="contacto-social__link contacto-social__link--fb" title="Facebook"><i class="fab fa-facebook-f"></i></a>` : ''}
                ${c.instagram ? `<a href="${c.instagram}" target="_blank" rel="noopener" class="contacto-social__link contacto-social__link--ig" title="Instagram"><i class="fab fa-instagram"></i></a>` : ''}
                ${c.tiktok ? `<a href="${c.tiktok}" target="_blank" rel="noopener" class="contacto-social__link contacto-social__link--tk" title="TikTok"><i class="fab fa-tiktok"></i></a>` : ''}
            </div>
        </div>
    ` : '';

    host.innerHTML = `
        ${phoneLink ? `
        <a href="${phoneLink}" class="contacto-card">
            <div class="contacto-card__icon"><i class="fas fa-phone"></i></div>
            <h3 class="contacto-card__title">Teléfono</h3>
            <p class="contacto-card__value">${escapeHtml(c.phone)}</p>
            <p class="contacto-card__sub">Llámanos para hacer tu pedido</p>
        </a>` : ''}
        ${waLink ? `
        <a href="${waLink}" target="_blank" rel="noopener" class="contacto-card">
            <div class="contacto-card__icon contacto-card__icon--green"><i class="fab fa-whatsapp"></i></div>
            <h3 class="contacto-card__title">WhatsApp</h3>
            <p class="contacto-card__value">${escapeHtml(c.phone || c.whatsapp)}</p>
            <p class="contacto-card__sub">Escríbenos y te respondemos rápido</p>
        </a>` : ''}
        ${emailLink ? `
        <a href="${emailLink}" class="contacto-card">
            <div class="contacto-card__icon contacto-card__icon--blue"><i class="fas fa-envelope"></i></div>
            <h3 class="contacto-card__title">Email</h3>
            <p class="contacto-card__value">${escapeHtml(c.email)}</p>
            <p class="contacto-card__sub">Envíanos tus consultas</p>
        </a>` : ''}
        ${mapsLink ? `
        <a href="${mapsLink}" target="_blank" rel="noopener" class="contacto-card">
            <div class="contacto-card__icon contacto-card__icon--red"><i class="fas fa-map-marker-alt"></i></div>
            <h3 class="contacto-card__title">Ubicación</h3>
            <p class="contacto-card__value">${escapeHtml(c.address)}</p>
            <p class="contacto-card__sub">Ver en Google Maps</p>
        </a>` : ''}
        ${scheduleHtml ? `
        <div class="contacto-card contacto-card--schedule">
            <div class="contacto-card__icon contacto-card__icon--slate"><i class="fas fa-clock"></i></div>
            <h3 class="contacto-card__title">Horario de atención</h3>
            <ul class="contacto-card__schedule-list">${scheduleHtml}</ul>
        </div>` : ''}
        ${socialsHtml}
    `;
}

function renderNavbarCategorias() {
    const host = document.getElementById('menuNavbarCategories');
    if (!host) return;
    if (!categoriasList.length) {
        host.innerHTML = '';
        return;
    }

    // Total de productos (para el chip "Todo")
    const total = Object.values(productosPorCategoria).reduce((a, b) => a + b, 0);

    const items = categoriasList.map((c) => {
        const count = productosPorCategoria[c.id] || 0;
        return `
            <a href="#menu-${c.id}" class="topbar__chip" data-menu="${c.id}">
                <span class="topbar__chip-icon"><i class="fas ${c.icon || 'fa-utensils'}"></i></span>
                <span class="topbar__chip-label">${escapeHtml(c.name)}</span>
                <span class="topbar__chip-count">${count}</span>
            </a>
        `;
    }).join('');

    host.innerHTML = `
        <a href="#menu" class="topbar__chip topbar__chip--all active" data-menu="all">
            <span class="topbar__chip-icon"><i class="fas fa-th-large"></i></span>
            <span class="topbar__chip-label">Todo</span>
            <span class="topbar__chip-count">${total}</span>
        </a>
        <span class="topbar__chips-divider" aria-hidden="true"></span>
        ${items}
    `;
}

function renderMenuSections() {
    const host = document.getElementById('menuSections');
    if (!host) return;
    if (!categoriasList.length) {
        host.innerHTML = `
            <div class="menu-empty">
                <i class="fas fa-store"></i>
                <h2>Próximamente más categorías</h2>
                <p>Vuelve pronto para descubrir nuestro menú completo.</p>
            </div>
        `;
        return;
    }
    host.innerHTML = categoriasList.map((c) => `
        <section id="menu-${c.id}" class="menu-section" data-category="${c.id}">
            <header class="menu-section__intro">
                <span class="menu-section__eyebrow"><i class="fas ${c.icon || 'fa-utensils'}"></i> Menú</span>
                <h2>${escapeHtml(c.name)}</h2>
                <p class="menu-section__desc">${escapeHtml(c.description || 'Delicioso plato preparado con ingredientes frescos en Brazas$Mar.')}</p>
            </header>
            <div class="showcase" data-showcase="${c.id}">
                <div class="showcase__viewport">
                    <div class="showcase__track" id="${c.id}-slideshow"></div>
                </div>
                <div class="showcase__controls">
                    <button type="button" class="showcase__arrow showcase__prev" aria-label="Anterior">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <div class="showcase__pill">
                        <div class="showcase__dots"></div>
                        <button type="button" class="showcase__play-pause" aria-label="Reproducir o Pausar">
                            <i class="fas fa-pause"></i>
                        </button>
                        <span class="showcase__counter">
                            <span class="current-slide">1</span> / <span class="total-slides">0</span>
                        </span>
                    </div>
                    <button type="button" class="showcase__arrow showcase__next" aria-label="Siguiente">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        </section>
    `).join('');

    if (typeof initMenuNavbar === 'function') {
        setTimeout(() => initMenuNavbar(), 0);
    }
}

function buildProductImageUrl(producto) {
    if (!producto.imagen) return `${SERVER_ORIGIN}/images/placeholder.png`;
    if (producto.imagen.startsWith('/')) return `${SERVER_ORIGIN}${producto.imagen}`;
    if (producto.imagen.startsWith('http')) return producto.imagen;
    return `${SERVER_ORIGIN}/uploads/${producto.imagen}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function createShowcaseSlide(producto, categoriaId, index) {
    const precio = parseFloat(producto.precio) || 0;
    const descuento = producto.descuento || 0;
    const precioFinal = descuento > 0 ? precio * (1 - descuento / 100) : precio;
    const imageUrl = buildProductImageUrl(producto);
    const descripcion = producto.descripcion?.trim() || 'Delicioso plato preparado con ingredientes frescos en Brazas$Mar.';

    const slide = document.createElement('div');
    slide.className = `showcase__slide${index === 0 ? ' is-active' : ''}`;
    slide.dataset.index = String(index);

    const card = document.createElement('article');
    card.className = 'product-showcase menu-card';
    card.dataset.category = categoriaId;
    card.dataset.id = producto.id;

    const media = document.createElement('div');
    media.className = 'product-showcase__media';

    if (producto.destacado) {
        const badge = document.createElement('span');
        badge.className = 'product-showcase__badge';
        badge.innerHTML = '<i class="fas fa-star"></i> Destacado';
        media.appendChild(badge);
    }
    if (descuento > 0) {
        const sale = document.createElement('span');
        sale.className = 'product-showcase__badge product-showcase__badge--sale';
        sale.textContent = `-${descuento}%`;
        media.appendChild(sale);
    }

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = producto.nombre;
    img.loading = index === 0 ? 'eager' : 'lazy';
    img.onerror = () => {
        img.onerror = null;
        img.src = `${SERVER_ORIGIN}/images/placeholder.png`;
    };
    media.appendChild(img);

    const body = document.createElement('div');
    body.className = 'product-showcase__body';
    body.innerHTML = `
        <p class="product-showcase__category">${escapeHtml(categorias[categoriaId]?.name || categorias[categoriaId]?.nombre || '')}</p>
        <h3 class="product-showcase__title">${escapeHtml(producto.nombre)}</h3>
        <p class="product-showcase__description">${escapeHtml(descripcion)}</p>
        <div class="product-showcase__meta">
            <div class="product-showcase__price-wrap">
                <span class="product-showcase__price">B/ ${precioFinal.toFixed(2)}</span>
                ${descuento > 0 ? `<span class="product-showcase__price-old">B/ ${precio.toFixed(2)}</span>` : ''}
            </div>
            <span class="product-showcase__rating"><i class="fas fa-star"></i> ${escapeHtml(producto.rating || '4.5')}</span>
        </div>
    `;

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'product-showcase__cta';
    cta.innerHTML = `<i class="fas fa-cart-plus"></i> Añadir al carrito · B/ ${precioFinal.toFixed(2)}`;
    cta.addEventListener('click', () => agregarAlCarrito(producto.id, categoriaId, 1));
    body.appendChild(cta);

    card.append(media, body);
    slide.appendChild(card);
    return slide;
}

function mostrarProductosEnSlideshow(categoriaId, productos) {
    const track = document.getElementById(`${categoriaId}-slideshow`);
    const showcase = document.querySelector(`[data-showcase="${categoriaId}"]`);
    if (!track || !showcase) return;

    track.innerHTML = '';

    if (!productos.length) {
        track.innerHTML = `
            <div class="showcase__empty">
                <i class="fas fa-utensils"></i>
                <p>No hay productos en esta categoría</p>
            </div>`;
        inicializarControlesShowcase(categoriaId, 0);
        return;
    }

    productos.forEach((producto, index) => {
        track.appendChild(createShowcaseSlide(producto, categoriaId, index));
    });

    inicializarControlesShowcase(categoriaId, productos.length);
}

function getShowcaseElements(categoriaId) {
    const showcase = document.querySelector(`[data-showcase="${categoriaId}"]`);
    const track = document.getElementById(`${categoriaId}-slideshow`);
    if (!showcase || !track) return null;
    return {
        showcase,
        track,
        slides: track.querySelectorAll('.showcase__slide'),
        dots: showcase.querySelector('.showcase__dots'),
        prev: showcase.querySelector('.showcase__prev'),
        next: showcase.querySelector('.showcase__next'),
        current: showcase.querySelector('.current-slide'),
        total: showcase.querySelector('.total-slides')
    };
}

function irASlide(categoriaId, index) {
    const els = getShowcaseElements(categoriaId);
    if (!els || !els.slides.length) return;

    const total = els.slides.length;
    if (index < 0 || index >= total) return;

    showcaseState[categoriaId] = index;
    currentSlide[categoriaId] = index;

    els.track.style.transform = `translateX(-${index * 100}%)`;

    els.slides.forEach((slide, i) => {
        slide.classList.toggle('is-active', i === index);
    });

    if (els.dots) {
        els.dots.querySelectorAll('.showcase__dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }

    if (els.current) els.current.textContent = String(index + 1);
    if (els.prev) els.prev.disabled = total <= 1;
    if (els.next) els.next.disabled = total <= 1;
}

function cambiarSlide(categoriaId, direction) {
    const els = getShowcaseElements(categoriaId);
    if (!els || !els.slides.length) return;

    let index = (showcaseState[categoriaId] ?? 0) + direction;
    if (index < 0) index = els.slides.length - 1;
    if (index >= els.slides.length) index = 0;
    irASlide(categoriaId, index);
}

function inicializarControlesShowcase(categoriaId, totalSlides) {
    const els = getShowcaseElements(categoriaId);
    if (!els) return;

    if (slideshowIntervals[categoriaId]) {
        clearInterval(slideshowIntervals[categoriaId]);
        delete slideshowIntervals[categoriaId];
    }

    if (els.total) els.total.textContent = String(totalSlides);
    showcaseState[categoriaId] = 0;
    currentSlide[categoriaId] = 0;
    els.track.style.transform = 'translateX(0)';

    if (els.dots) {
        els.dots.innerHTML = '';
        for (let i = 0; i < totalSlides; i++) {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = `showcase__dot${i === 0 ? ' active' : ''}`;
            dot.setAttribute('aria-label', `Ir al producto ${i + 1}`);
            dot.addEventListener('click', () => irASlide(categoriaId, i));
            els.dots.appendChild(dot);
        }
    }

    if (els.prev) {
        els.prev.onclick = () => cambiarSlide(categoriaId, -1);
    }
    if (els.next) {
        els.next.onclick = () => cambiarSlide(categoriaId, 1);
    }

    // Configurar botón reproducir/pausar
    const playPauseBtn = els.showcase.querySelector('.showcase__play-pause');
    if (playPauseBtn) {
        const icon = playPauseBtn.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-pause';
        }
        
        playPauseBtn.onclick = () => {
            const icon = playPauseBtn.querySelector('i');
            if (slideshowIntervals[categoriaId]) {
                // Pausar
                clearInterval(slideshowIntervals[categoriaId]);
                delete slideshowIntervals[categoriaId];
                if (icon) icon.className = 'fas fa-play';
                playPauseBtn.setAttribute('aria-label', 'Reproducir');
            } else {
                // Reproducir
                slideshowIntervals[categoriaId] = setInterval(() => {
                    cambiarSlide(categoriaId, 1);
                }, 9000);
                if (icon) icon.className = 'fas fa-pause';
                playPauseBtn.setAttribute('aria-label', 'Pausar');
            }
        };
    }

    irASlide(categoriaId, 0);

    if (totalSlides > 1) {
        slideshowIntervals[categoriaId] = setInterval(() => {
            cambiarSlide(categoriaId, 1);
        }, 9000);
    }
}

function initMenuNavbar() {
    const links = document.querySelectorAll('.topbar__chip[data-menu], .topbar__nav-link[data-topbar-link]');
    const chips = document.querySelectorAll('.topbar__chip[data-menu]');

    chips.forEach((link) => {
        link.addEventListener('click', (e) => {
            const target = link.getAttribute('href');
            if (target && target.startsWith('#')) {
                const el = document.querySelector(target);
                if (el) {
                    e.preventDefault();
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    chips.forEach((l) => l.classList.remove('active'));
                    link.classList.add('active');
                }
            }
        });
    });

    // Burger (mobile)
    const burger = document.getElementById('topbarBurger');
    const topbar = document.getElementById('topbar');
    burger?.addEventListener('click', () => {
        const open = topbar.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Cerrar burger al hacer click en un link
    document.querySelectorAll('.topbar__nav-link').forEach((link) => {
        link.addEventListener('click', () => {
            topbar.classList.remove('is-open');
            burger?.setAttribute('aria-expanded', 'false');
        });
    });

    // IntersectionObserver para resaltar chip activo al scrollear
    const sectionIds = [...chips].map((l) => l.getAttribute('data-menu')).filter((id) => id && id !== 'all');
    const sections = sectionIds.map((id) => document.getElementById(`menu-${id}`)).filter(Boolean);

    const setActiveChip = (id) => {
        chips.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('data-menu') === id);
        });
    };

    const setActiveNav = (id) => {
        document.querySelectorAll('.topbar__nav-link[data-topbar-link]').forEach((link) => {
            link.classList.toggle('active', link.getAttribute('data-topbar-link') === id);
        });
    };

    if (sections.length && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const id = entry.target.id.replace('menu-', '');
                        setActiveChip(id);
                    }
                });
            },
            { rootMargin: '-40% 0px -40% 0px', threshold: 0 }
        );
        sections.forEach((section) => observer.observe(section));

        // Si scrollea al tope (sobre todas las secciones), activar "Todo"
        window.addEventListener('scroll', () => {
            const top = window.scrollY;
            const firstTop = sections[0]?.getBoundingClientRect().top;
            if (firstTop !== undefined && firstTop > window.innerHeight * 0.4) {
                setActiveChip('all');
            }
        }, { passive: true });
    }

    // Observer para las secciones #promos y #contacto (resaltan nav-link principal)
    const promosSection = document.getElementById('promos');
    const contactoSection = document.getElementById('contacto');
    if ('IntersectionObserver' in window) {
        const navObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        if (entry.target.id === 'promos') setActiveNav('promos');
                        else if (entry.target.id === 'contacto') setActiveNav('contacto');
                        else if (entry.target.id === 'menu') setActiveNav('menu');
                    }
                });
            },
            { rootMargin: '-40% 0px -40% 0px', threshold: 0 }
        );
        if (promosSection) navObserver.observe(promosSection);
        if (contactoSection) navObserver.observe(contactoSection);
        const menuEl = document.getElementById('menu');
        if (menuEl) navObserver.observe(menuEl);
    }
}

function mostrarProductosDeEjemplo() {
    const productosEjemplo = {
        hamburguesas: [
            {
                id: 'ejemplo1',
                nombre: 'Hamburguesa Clásica',
                descripcion: 'Carne de res, queso, lechuga, tomate y salsa especial',
                precio: '8.99',
                imagen: `${SERVER_ORIGIN}/images/placeholder.png`,
                destacado: true,
                descuento: 0
            }
        ],
        especiales: [
            {
                id: 'ejemplo2',
                nombre: 'Especial del Chef',
                descripcion: 'Nuestra creación especial con ingredientes premium',
                precio: '15.99',
                imagen: `${SERVER_ORIGIN}/images/placeholder.png`,
                destacado: true,
                descuento: 10
            }
        ],
        cerdo: [
            {
                id: 'ejemplo3',
                nombre: 'Combo Cerdo Tradicional',
                descripcion: 'Costillas de cerdo con guarniciones',
                precio: '18.99',
                imagen: `${SERVER_ORIGIN}/images/placeholder.png`,
                destacado: false,
                descuento: 15
            }
        ]
    };
    
    for (const categoriaId in categorias) {
        const productos = productosEjemplo[categoriaId] || [];
        mostrarProductosEnSlideshow(categoriaId, productos);
    }
}

// Alias global para compatibilidad con sidebar
window.addToCart = function(productId) {
    agregarAlCarrito(productId, '', 1);
};

// Función para actualizar el menú (usada desde el admin)
window.actualizarMenu = function() {
    cargarProductos();
    // Notificar a otros componentes
    localStorage.setItem('menu_updated', Date.now().toString());
};