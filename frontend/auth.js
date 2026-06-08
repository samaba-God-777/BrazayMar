const AUTH_STORAGE_KEY = 'brazasmar_auth_token';
const AUTH_USER_KEY = 'brazasmar_auth_user';
const CART_STORAGE_KEY = 'brazasmar_carrito';

const AuthService = {
    getApiBase() {
        return window.AppConfig?.API_BASE_URL || `${window.location.origin}/api`;
    },

    getToken() {
        return sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    },

    getUser() {
        const raw = sessionStorage.getItem(AUTH_USER_KEY) || localStorage.getItem(AUTH_USER_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    setSession(token, user, remember = false) {
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(AUTH_STORAGE_KEY, token);
        storage.setItem(AUTH_USER_KEY, JSON.stringify(user));

        const other = remember ? sessionStorage : localStorage;
        other.removeItem(AUTH_STORAGE_KEY);
        other.removeItem(AUTH_USER_KEY);
    },

    clearSession() {
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
    },

    authHeaders(extra = {}) {
        const headers = { ...extra };
        const token = this.getToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    },

    async login(identifier, password, remember = false) {
        const response = await fetch(`${this.getApiBase()}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) {
            throw new Error(data.error || 'Error al iniciar sesión');
        }
        this.setSession(data.token, data.user, remember);
        return data;
    },

    async register(payload) {
        const response = await fetch(`${this.getApiBase()}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) {
            throw new Error(data.error || 'Error al registrarse');
        }
        this.setSession(data.token, data.user, false);
        return data;
    },

    async updateProfile(payload) {
        const response = await fetch(`${this.getApiBase()}/auth/profile`, {
            method: 'PUT',
            headers: this.authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al actualizar perfil');
        this.setSession(this.getToken(), data.user, !!localStorage.getItem(AUTH_STORAGE_KEY));
        return data;
    },

    async changePassword(currentPassword, newPassword) {
        const response = await fetch(`${this.getApiBase()}/auth/password`, {
            method: 'PUT',
            headers: this.authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al cambiar contraseña');
        return data;
    },

    async verifySession() {
        const token = this.getToken();
        if (!token) return null;
        try {
            const response = await fetch(`${this.getApiBase()}/auth/me`, {
                headers: this.authHeaders()
            });
            if (!response.ok) {
                this.clearSession();
                return null;
            }
            const data = await AppConfig.parseJsonResponse(response);
            const storage = localStorage.getItem(AUTH_STORAGE_KEY) ? localStorage : sessionStorage;
            storage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
            return data.user;
        } catch {
            return null;
        }
    },

    async requireAuth(redirectTo) {
        const loginUrl = redirectTo || window.AppConfig?.LOGIN_URL || '/login';
        const user = await this.verifySession();
        if (!user) {
            window.location.href = loginUrl;
            return null;
        }
        return user;
    },

    async requireRole(role, redirectTo) {
        const user = await this.requireAuth(redirectTo);
        if (!user) return null;
        if (Array.isArray(role) ? !role.includes(user.role) : user.role !== role) {
            if (window.AppConfig?.toast) {
                window.AppConfig.toast('No tienes permisos para esta sección', 'error');
            }
            const fallback = user.role === 'admin'
                ? (window.AppConfig?.ADMIN_DASHBOARD_URL || '/admin')
                : (window.AppConfig?.STORE_URL || '/');
            setTimeout(() => { window.location.href = fallback; }, 800);
            return null;
        }
        return user;
    },

    logout(redirectTo) {
        this.clearSession();
        window.location.href = redirectTo || window.AppConfig?.LOGIN_URL || '/login';
    },

    isAdmin(user) {
        return (user || this.getUser())?.role === 'admin';
    },

    isCliente(user) {
        return (user || this.getUser())?.role === 'cliente';
    },

    cartKey() {
        const user = this.getUser();
        return user ? `${CART_STORAGE_KEY}_${user.id}` : `${CART_STORAGE_KEY}_guest`;
    },

    async fetchWithAuth(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: this.authHeaders(options.headers || {})
        });
        if (response.status === 401) {
            this.clearSession();
            window.location.href = window.AppConfig?.LOGIN_URL || '/login';
            throw new Error('Sesión expirada');
        }
        return response;
    }
};

window.AuthService = AuthService;
