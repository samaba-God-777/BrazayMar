(function () {
    let currentUser = null;

    document.addEventListener('DOMContentLoaded', async () => {
        currentUser = await AuthService.requireAuth();
        if (!currentUser) return;

        if (currentUser.role === 'admin') {
            document.body.classList.add('is-admin');
        }

        renderUserInfo();
        bindNav();
        bindProfile();
        bindPassword();
        bindLogout();
        loadOrders();
    });

    function renderUserInfo() {
        const avatar = document.getElementById('accountAvatar');
        const name = document.getElementById('accountName');
        const role = document.getElementById('accountRole');
        if (avatar) avatar.textContent = (currentUser.name || currentUser.username || 'U').charAt(0).toUpperCase();
        if (name) name.textContent = currentUser.name || currentUser.username;
        if (role) role.textContent = currentUser.role;

        document.getElementById('profileName').value = currentUser.name || '';
        document.getElementById('profileUsername').value = currentUser.username || '';
        document.getElementById('profileEmail').value = currentUser.email || '';
        document.getElementById('profilePhone').value = currentUser.phone || '';
        document.getElementById('profileAddress').value = currentUser.address || '';
    }

    function bindNav() {
        document.querySelectorAll('.account-nav-link').forEach((link) => {
            link.addEventListener('click', () => {
                const target = link.dataset.section;
                document.querySelectorAll('.account-nav-link').forEach((l) => l.classList.remove('active'));
                document.querySelectorAll('.account-section').forEach((s) => s.classList.remove('active'));
                link.classList.add('active');
                document.querySelector(`.account-section[data-section="${target}"]`)?.classList.add('active');
            });
        });
    }

    function bindLogout() {
        const btn = document.getElementById('logoutBtn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (confirm('¿Cerrar sesión?')) AuthService.logout();
        });
    }

    function showMessage(box, message, type = 'success') {
        if (!box) return;
        box.textContent = message;
        box.className = `auth-message ${type}`;
        box.hidden = false;
        setTimeout(() => { box.hidden = true; }, 4000);
    }

    function bindProfile() {
        const form = document.getElementById('profileForm');
        if (!form) return;
        const msg = document.getElementById('profileMessage');
        const btn = document.getElementById('profileSaveBtn');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            try {
                const payload = {
                    name: document.getElementById('profileName').value.trim(),
                    email: document.getElementById('profileEmail').value.trim(),
                    phone: document.getElementById('profilePhone').value.trim(),
                    address: document.getElementById('profileAddress').value.trim()
                };
                const result = await AuthService.updateProfile(payload);
                currentUser = result.user;
                renderUserInfo();
                showMessage(msg, '✅ Perfil actualizado correctamente', 'success');
            } catch (err) {
                showMessage(msg, err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> Guardar cambios';
            }
        });
    }

    function bindPassword() {
        const form = document.getElementById('passwordForm');
        if (!form) return;
        const msg = document.getElementById('passwordMessage');
        const btn = document.getElementById('passwordSaveBtn');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const current = document.getElementById('currentPassword').value;
            const next = document.getElementById('newPassword').value;
            const confirm = document.getElementById('newPasswordConfirm').value;

            if (next !== confirm) {
                showMessage(msg, 'Las contraseñas nuevas no coinciden', 'error');
                return;
            }
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
            try {
                await AuthService.changePassword(current, next);
                showMessage(msg, '✅ Contraseña actualizada', 'success');
                form.reset();
            } catch (err) {
                showMessage(msg, err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> Actualizar contraseña';
            }
        });
    }

    async function loadOrders() {
        const list = document.getElementById('ordersList');
        if (!list) return;
        try {
            const response = await AuthService.fetchWithAuth(`${AppConfig.API_BASE_URL}/orders`);
            const data = await AppConfig.parseJsonResponse(response);
            if (!response.ok) throw new Error(data.error || 'Error al cargar pedidos');

            if (!data || data.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-receipt"></i>
                        <p>Aún no tienes pedidos</p>
                        <small>¡Explora nuestro menú y haz tu primer pedido!</small>
                    </div>
                `;
                return;
            }

            list.innerHTML = '';
            data.forEach((order) => {
                const card = renderOrderCard(order);
                list.appendChild(card);
                const btn = card.querySelector('[data-order-id]');
                if (btn) btn.addEventListener('click', () => downloadInvoice(order.orderId, btn));
            });
        } catch (err) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${err.message}</p>
                </div>
            `;
        }
    }

    async function downloadInvoice(orderId, btn) {
        if (!btn) return;
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        try {
            const response = await AuthService.fetchWithAuth(`${AppConfig.API_BASE_URL}/orders/${orderId}/invoice`);
            if (!response.ok) {
                const err = await AppConfig.parseJsonResponse(response).catch(() => ({ error: 'No se pudo generar la factura' }));
                throw new Error(err.error || 'No se pudo generar la factura');
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factura-${orderId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            AppConfig.toast('Factura descargada', 'success');
        } catch (err) {
            AppConfig.toast(err.message || 'Error al generar la factura', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    function renderOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'order-card';

        const status = (order.estado || 'pendiente').toLowerCase();
        const fecha = order.fecha ? new Date(order.fecha).toLocaleString('es-PA') : '';
        const total = (order.totales?.total || 0).toFixed(2);

        const items = (order.productos || []).map((p) => `
            <div class="order-item-row">
                <span>${p.cantidad}× ${p.nombre}</span>
                <span>B/ ${(p.precio * p.cantidad).toFixed(2)}</span>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="order-card-head">
                <div>
                    <span class="order-card-id">${order.orderId}</span>
                    <span class="order-card-date"> · ${fecha}</span>
                </div>
                <span class="status-pill status-${status}">${status}</span>
            </div>
            <div class="order-card-items">${items}</div>
            <div class="order-card-foot">
                <span class="order-total">Total: B/ ${total}</span>
                <div class="order-actions">
                    <button type="button" class="order-action-btn" data-order-id="${order.orderId}">
                        <i class="fas fa-file-pdf"></i> Factura PDF
                    </button>
                </div>
            </div>
        `;
        return card;
    }
})();
