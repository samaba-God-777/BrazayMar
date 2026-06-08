(function () {
    document.addEventListener('DOMContentLoaded', () => {
        setupTabs();
        setupPasswordToggles();
        setupPasswordStrength();
        setupLoginForm();
        setupRegisterForm();
    });

    function showError(box, message) {
        if (!box) return;
        box.textContent = message;
        box.hidden = false;
    }
    function clearError(box) {
        if (!box) return;
        box.textContent = '';
        box.hidden = true;
    }

    function setupTabs() {
        const tabs = document.querySelectorAll('.auth-tab');
        if (!tabs.length) return;
        const identifierInput = document.getElementById('identifier');
        const identifierLabel = document.getElementById('identifierLabel');
        const hint = document.getElementById('authHint');
        const footer = document.getElementById('authFooter');

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                tabs.forEach((t) => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');

                const isAdmin = tab.dataset.tab === 'admin';
                if (identifierLabel) identifierLabel.textContent = isAdmin ? 'Usuario' : 'Usuario o email';
                if (identifierInput) identifierInput.placeholder = isAdmin ? 'admin' : 'usuario@correo.com';
                if (hint) hint.hidden = !isAdmin;
                if (footer) footer.style.display = isAdmin ? 'none' : 'block';
            });
        });
    }

    function setupPasswordToggles() {
        document.querySelectorAll('.toggle-pwd').forEach((btn) => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.dataset.target);
                if (!target) return;
                const isPwd = target.type === 'password';
                target.type = isPwd ? 'text' : 'password';
                btn.innerHTML = `<i class="fas fa-eye${isPwd ? '-slash' : ''}"></i>`;
            });
        });
    }

    function setupPasswordStrength() {
        const pwd = document.getElementById('password');
        const strength = document.getElementById('passwordStrength');
        if (!pwd || !strength) return;
        pwd.addEventListener('input', () => {
            const val = pwd.value;
            let score = 0;
            if (val.length >= 6) score++;
            if (val.length >= 10) score++;
            if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
            if (/\d/.test(val) && /[^A-Za-z0-9]/.test(val)) score++;
            strength.className = 'password-strength';
            if (val) strength.classList.add(`weak-${score}`);
        });
    }

    function setupLoginForm() {
        const form = document.getElementById('loginForm');
        if (!form) return;
        const errorBox = document.getElementById('loginError');
        const btn = document.getElementById('loginBtn');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError(errorBox);
            const identifier = document.getElementById('identifier').value.trim();
            const password = document.getElementById('password').value;
            const remember = document.getElementById('remember')?.checked || false;
            const isAdminTab = document.querySelector('.auth-tab.active')?.dataset.tab === 'admin';

            if (!identifier || !password) {
                showError(errorBox, 'Completa todos los campos');
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

            try {
                const result = await AuthService.login(identifier, password, remember);
                const target = result.user.role === 'admin'
                    ? AppConfig.ADMIN_DASHBOARD_URL
                    : AppConfig.STORE_URL;
                window.location.href = target;
            } catch (err) {
                showError(errorBox, err.message);
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar sesión';
            }
        });
    }

    function setupRegisterForm() {
        const form = document.getElementById('registerForm');
        if (!form) return;
        const errorBox = document.getElementById('registerError');
        const btn = document.getElementById('registerBtn');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError(errorBox);

            const payload = {
                name: document.getElementById('name').value.trim(),
                username: document.getElementById('username').value.trim(),
                email: document.getElementById('email').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                address: document.getElementById('address').value.trim(),
                password: document.getElementById('password').value
            };
            const confirm = document.getElementById('passwordConfirm').value;
            const terms = document.getElementById('terms')?.checked;

            if (!payload.name || !payload.username || !payload.email || !payload.password) {
                showError(errorBox, 'Completa los campos obligatorios');
                return;
            }
            if (payload.password !== confirm) {
                showError(errorBox, 'Las contraseñas no coinciden');
                return;
            }
            if (terms === false) {
                showError(errorBox, 'Acepta los términos y condiciones');
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando cuenta...';

            try {
                await AuthService.register(payload);
                btn.innerHTML = '<i class="fas fa-check"></i> ¡Cuenta creada!';
                setTimeout(() => { window.location.href = AppConfig.STORE_URL; }, 600);
            } catch (err) {
                showError(errorBox, err.message);
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-user-plus"></i> Crear cuenta';
            }
        });
    }
})();
