/**
 * Pedidos en dashboard + notificaciones al administrador
 */
let adminOrders = [];
let knownOrderIds = new Set();
let ordersPollTimer = null;
let notificationsInitialized = false;

const ORDERS_SEEN_KEY = 'brazasmar_orders_seen';

function loadSeenOrderIds() {
    try {
        const raw = sessionStorage.getItem(ORDERS_SEEN_KEY);
        if (raw) {
            JSON.parse(raw).forEach((id) => knownOrderIds.add(id));
        }
    } catch {
        knownOrderIds = new Set();
    }
}

function saveSeenOrderIds() {
    sessionStorage.setItem(ORDERS_SEEN_KEY, JSON.stringify([...knownOrderIds]));
}

function updateOrdersBadges(pendientes) {
    const badge = document.getElementById('orders-badge');
    const notifyBadge = document.getElementById('adminNotifyBadge');
    const count = pendientes ?? adminOrders.filter((o) => o.estado === 'pendiente').length;

    [badge, notifyBadge].forEach((el) => {
        if (!el) return;
        if (count > 0) {
            el.textContent = count > 99 ? '99+' : String(count);
            el.style.display = 'flex';
        } else {
            el.style.display = 'none';
        }
    });
}

function renderAdminOrderCard(p) {
    const nombre = p.cliente?.nombre || 'Sin nombre';
    const telefono = p.cliente?.telefono || '—';
    const direccion = p.cliente?.direccion || '—';
    const itemsHtml = (p.productos || [])
        .map((i) => {
            const sub = (Number(i.precio) || 0) * (Number(i.cantidad) || 1);
            return `<li><span>${i.cantidad}x</span> ${i.nombre} <em>B/ ${sub.toFixed(2)}</em></li>`;
        })
        .join('') || '<li>Sin productos</li>';
    const total = p.totales?.total ?? 0;
    const fecha = p.fecha ? new Date(p.fecha).toLocaleString('es-PA') : '—';
    const estado = p.estado || 'pendiente';
    const orderId = p.orderId || p.id;
    const tipo = p.tipo || 'delivery';
    const tipoBadge = tipo === 'local'
        ? '<span class="pedido-tipo-badge pedido-tipo-badge--local"><i class="fas fa-store"></i> LOCAL</span>'
        : '<span class="pedido-tipo-badge pedido-tipo-badge--delivery"><i class="fas fa-motorcycle"></i> DELIVERY</span>';

    return `
        <article class="pedido-card">
            <header class="pedido-card__head">
                <div>
                    <span class="pedido-card__id">${orderId}</span>
                    ${tipoBadge}
                    <time class="pedido-card__fecha">${fecha}</time>
                </div>
                <span class="estado estado--${estado}">${estado}</span>
            </header>
            <div class="pedido-card__cliente">
                <p><i class="fas fa-user"></i> <strong>${nombre}</strong></p>
                <p><i class="fas fa-phone"></i> ${telefono}</p>
                <p><i class="fas fa-map-marker-alt"></i> ${direccion}</p>
            </div>
            <ul class="pedido-card__items">${itemsHtml}</ul>
            <div class="pedido-card__total">
                <span>Total${tipo === 'local' ? ' (sin envío)' : ''}</span>
                <strong>B/ ${Number(total).toFixed(2)}</strong>
            </div>
            <div class="pedido-card__acciones">
                <button type="button" class="btn-estado btn-estado--proceso" data-order="${orderId}" data-estado="proceso">
                    <i class="fas fa-fire"></i> En proceso
                </button>
                <button type="button" class="btn-estado btn-estado--completado" data-order="${orderId}" data-estado="completado">
                    <i class="fas fa-check"></i> Completar
                </button>
                <button type="button" class="btn-estado btn-estado--cancelado" data-order="${orderId}" data-estado="cancelado">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button type="button" class="btn-estado btn-estado--eliminado" data-order="${orderId}">
                    <i class="fas fa-trash-alt"></i> Eliminar
                </button>
            </div>
        </article>`;
}

function renderPedidosAdmin() {
    const cont = document.getElementById('listaPedidosAdmin');
    const badge = document.getElementById('pedidosCountBadge');
    if (!cont) return;

    if (badge) {
        badge.textContent = `${adminOrders.length} pedido${adminOrders.length === 1 ? '' : 's'}`;
    }

    if (adminOrders.length === 0) {
        cont.innerHTML = `
            <div class="pedidos-empty">
                <i class="fas fa-inbox"></i>
                <h3>No hay pedidos aún</h3>
                <p>Cuando un cliente envíe un pedido desde la tienda, aparecerá aquí.</p>
            </div>`;
        return;
    }

    cont.innerHTML = adminOrders.map(renderAdminOrderCard).join('');

    cont.querySelectorAll('[data-order]').forEach((btn) => {
        // Handle delete button separately
        if (btn.classList.contains('btn-estado--eliminado')) {
            btn.addEventListener('click', () => {
                if (confirm('¿Estás seguro de eliminar este pedido? Esta acción no se puede deshacer.')) {
                    eliminarPedido(btn.dataset.order);
                }
            });
        } else {
            // Handle status change buttons
            btn.addEventListener('click', () => {
                cambiarEstadoPedido(btn.dataset.order, btn.dataset.estado);
            });
        }
    });
}

async function cargarPedidosAdmin(silent = false) {
    const cont = document.getElementById('listaPedidosAdmin');
    if (cont && !silent) {
        cont.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i> Cargando pedidos...</p>';
    }

    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/orders`);
        const orders = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error('Error al cargar pedidos');

        adminOrders = orders;
        renderPedidosAdmin();
        updateOrdersBadges();
        return orders;
    } catch (err) {
        if (cont) {
            cont.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#ef4444;padding:40px;">${err.message}</p>`;
        }
        return [];
    }
}

async function cambiarEstadoPedido(orderId, estado) {
    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado })
        });
        await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error('No se pudo actualizar');

        if (typeof showToast === 'function') {
            showToast(`Pedido ${orderId} → ${estado}`, 'success');
        }
        await cargarPedidosAdmin(true);
        await checkNewOrders(true);
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message, 'error');
        else alert(err.message);
    }
}

async function eliminarPedido(orderId) {
    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/orders/${orderId}`, {
            method: 'DELETE'
        });
        await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error('No se pudo eliminar el pedido');

        if (typeof showToast === 'function') {
            showToast(`Pedido ${orderId} eliminado correctamente`, 'success');
        }
        await cargarPedidosAdmin(true);
        await checkNewOrders(true);
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message, 'error');
        else alert(err.message);
    }
}

function addNotificationToPanel(order) {
    const list = document.getElementById('adminNotificationsList');
    if (!list) return;

    const li = document.createElement('li');
    li.className = 'admin-notification-item admin-notification-item--new';
    li.innerHTML = `
        <strong>Nuevo pedido ${order.orderId || order.id}</strong>
        <span>${order.cliente?.nombre || 'Cliente'} · B/ ${Number(order.totales?.total || 0).toFixed(2)}</span>
        <time>${new Date(order.fecha || Date.now()).toLocaleString('es-PA')}</time>
        <button type="button" class="notification-close" aria-label="Eliminar notificación">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add click handler for the notification content (not the close button)
    li.querySelector('.notification-close').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the li click event
        li.remove();
    });
    
    li.addEventListener('click', () => {
        if (typeof showSection === 'function') showSection('pedidos');
        toggleNotificationsPanel(false);
    });
    list.prepend(li);

    while (list.children.length > 20) {
        list.removeChild(list.lastChild);
    }
}

function notifyAdminNewOrder(order) {
    const nombre = order.cliente?.nombre || 'Cliente';
    const total = Number(order.totales?.total || 0).toFixed(2);
    const msg = `Nuevo pedido de ${nombre} · B/ ${total}`;

    if (typeof showToast === 'function') {
        showToast(msg, 'success');
    }

    addNotificationToPanel(order);

    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification('Brazas$Mar — Nuevo pedido', {
                body: `${order.orderId || order.id}: ${nombre} · Total B/ ${total}`,
                icon: '/images/logo.jpg',
                tag: order.orderId || order.id
            });
        } catch {
            /* ignore */
        }
    }

    const btn = document.getElementById('adminNotifyBtn');
    if (btn) {
        btn.classList.add('admin-notify-btn--pulse');
        setTimeout(() => btn.classList.remove('admin-notify-btn--pulse'), 2000);
    }
}

async function checkNewOrders(seedOnly = false) {
    try {
        const response = await AuthService.fetchWithAuth(`${API_BASE_URL}/orders`);
        const orders = await AppConfig.parseJsonResponse(response);
        if (!response.ok) return;

        if (seedOnly || knownOrderIds.size === 0) {
            orders.forEach((o) => knownOrderIds.add(o.orderId || o.id));
            saveSeenOrderIds();
        } else {
            const newOrders = orders.filter((o) => {
                const id = o.orderId || o.id;
                return id && !knownOrderIds.has(id);
            });

            newOrders.forEach((order) => {
                const id = order.orderId || order.id;
                knownOrderIds.add(id);
                if (order.estado === 'pendiente') {
                    notifyAdminNewOrder(order);
                }
            });

            if (newOrders.length > 0) {
                saveSeenOrderIds();
            }
        }

        adminOrders = orders;
        const pedidosSection = document.getElementById('pedidos');
        if (pedidosSection?.classList.contains('active')) {
            renderPedidosAdmin();
        }
        updateOrdersBadges();
    } catch (err) {
        console.warn('Poll pedidos:', err.message);
    }
}

function startOrdersPolling() {
    if (ordersPollTimer) return;
    ordersPollTimer = setInterval(() => checkNewOrders(false), 12000);
}

function solicitarPermisoNotificaciones() {
    if (!('Notification' in window)) {
        if (typeof showToast === 'function') showToast('Tu navegador no soporta notificaciones', 'error');
        return;
    }
    Notification.requestPermission().then((perm) => {
        if (typeof showToast === 'function') {
            showToast(
                perm === 'granted' ? 'Notificaciones activadas' : 'Notificaciones no permitidas',
                perm === 'granted' ? 'success' : 'error'
            );
        }
    });
}

function toggleNotificationsPanel(forceOpen) {
    const panel = document.getElementById('adminNotificationsPanel');
    if (!panel) return;
    if (forceOpen === true) panel.hidden = false;
    else if (forceOpen === false) panel.hidden = true;
    else panel.hidden = !panel.hidden;
}

function initAdminOrders() {
    loadSeenOrderIds();
    cargarPedidosAdmin(true).then(() => checkNewOrders(true));
    startOrdersPolling();
    notificationsInitialized = true;
}

window.cargarPedidosAdmin = cargarPedidosAdmin;
window.cambiarEstadoPedido = cambiarEstadoPedido;
window.solicitarPermisoNotificaciones = solicitarPermisoNotificaciones;
window.toggleNotificationsPanel = toggleNotificationsPanel;
window.initAdminOrders = initAdminOrders;
