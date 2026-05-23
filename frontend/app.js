// Configuración (backend en el mismo origen — ver config.js)
const API_BASE_URL = window.AppConfig?.API_BASE_URL || `${window.location.origin}/api`;
const SERVER_ORIGIN = window.AppConfig?.SERVER_ORIGIN || window.location.origin;

// Variables globales
let carrito = JSON.parse(localStorage.getItem('brazasmar_carrito')) || [];
let currentSlide = {};
let productosCantidad = {}; // Almacena cantidades temporales por producto

// Categorías
const categorias = {
    hamburguesas: 'Hamburguesas',
    especiales: 'Especiales',
    cerdo: 'Combo Cerdo'
};

const slideshowIntervals = {};
const showcaseState = {};

// DEBUG: Verificar que las funciones están disponibles
console.log('✅ App.js cargado');
console.log('📦 Carrito inicial:', carrito);

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando aplicación...');
    
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
    localStorage.setItem('brazasmar_carrito', JSON.stringify(carrito));
    console.log('💾 Carrito guardado:', carrito);
}

// Agregar producto al carrito (SIMPLIFICADO PARA PRUEBAS)
async function agregarAlCarrito(productId, categoria, cantidad = 1) {
    console.log('➕ Agregando al carrito:', { productId, categoria, cantidad });
    
    try {
        // Buscar producto en el DOM primero
        const card = document.querySelector(`.menu-card[data-id="${productId}"]`);
        if (!card) {
            console.error('❌ Producto no encontrado en DOM');
            mostrarNotificacion('Error: Producto no encontrado', 'error');
            return;
        }
        
        const nombre = card.querySelector('.product-showcase__title, .card-title')?.textContent || 'Producto';
        const precioTexto = card.querySelector('.product-showcase__price, .card-price')?.textContent || '0.00';
        const precio = parseFloat(precioTexto.replace('B/ ', '').trim());
        const imagen = card.querySelector('.product-showcase__media img, .card-img')?.src
            || `${SERVER_ORIGIN}/images/placeholder.png`;
        
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
    const cartCount = document.querySelector('.cart-count');
    
    if (cartCount) {
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
        console.log('🔢 Contador actualizado:', totalItems);
    }
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
                    <p class="checkout-modal__subtitle">Completa tu información para enviar el pedido al administrador</p>
                    <div class="form-group">
                        <label>Nombre completo *</label>
                        <input type="text" id="clienteNombre" required placeholder="Tu nombre">
                    </div>
                    <div class="form-group">
                        <label>Teléfono *</label>
                        <input type="tel" id="clienteTelefono" required placeholder="Tu teléfono">
                    </div>
                    <div class="form-group">
                        <label>Dirección *</label>
                        <textarea id="clienteDireccion" required placeholder="Dirección completa"></textarea>
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
                direccion: resumen.cliente.direccion
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

        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

// Cargar menú desde API
async function cargarMenu() {
    try {
        const response = await fetch(`${API_BASE_URL}/menu`);
        if (!response.ok) throw new Error('Error al cargar menú');
        
        const menu = await AppConfig.parseJsonResponse(response);
        
        for (const categoriaId in categorias) {
            const productos = menu[categoriaId] || [];
            mostrarProductosEnSlideshow(categoriaId, productos);
        }
    } catch (error) {
        console.error('Error cargando menú:', error);
        mostrarProductosDeEjemplo();
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
        <p class="product-showcase__category">${escapeHtml(categorias[categoriaId])}</p>
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

    irASlide(categoriaId, 0);

    if (totalSlides > 1) {
        slideshowIntervals[categoriaId] = setInterval(() => {
            cambiarSlide(categoriaId, 1);
        }, 9000);
    }
}

function initMenuNavbar() {
    const links = document.querySelectorAll('.menu-navbar__link');
    const sections = [...links].map((link) => {
        const id = link.getAttribute('href')?.replace('#', '');
        return id ? document.getElementById(id) : null;
    }).filter(Boolean);

    links.forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            links.forEach((l) => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    if (sections.length && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const id = entry.target.id;
                        links.forEach((link) => {
                            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                        });
                    }
                });
            },
            { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
        );
        sections.forEach((section) => observer.observe(section));
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

// En app.js, después de cargar productos
window.addToCart = function(productId) {
    // Tu lógica existente para agregar al carrito
    // ...
};

// Función para actualizar el menú (usada desde el admin)
window.actualizarMenu = function() {
    cargarProductos();
    // Notificar a otros componentes
    localStorage.setItem('menu_updated', Date.now().toString());
};