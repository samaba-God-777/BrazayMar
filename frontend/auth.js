const AUTH_STORAGE_KEY = 'brazasmar_auth_token';
const AUTH_USER_KEY = 'brazasmar_auth_user';

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

    async login(username, password, remember = false) {
        const response = await fetch(`${this.getApiBase()}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await AppConfig.parseJsonResponse(response);
        if (!response.ok) {
            throw new Error(data.error || 'Error al iniciar sesión');
        }

        this.setSession(data.token, data.user, remember);
        return data;
    },

    async verifySession() {
        const token = this.getToken();
        if (!token) return null;

        const response = await fetch(`${this.getApiBase()}/auth/me`, {
            headers: this.authHeaders()
        });

        if (!response.ok) {
            this.clearSession();
            return null;
        }

        const data = await AppConfig.parseJsonResponse(response);
        return data.user;
    },

    async requireAuth(redirectTo) {
        const loginUrl = redirectTo || window.AppConfig?.ADMIN_LOGIN_URL || '/login';
        const user = await this.verifySession();
        if (!user) {
            window.location.href = loginUrl;
            return null;
        }
        return user;
    },

    logout(redirectTo) {
        this.clearSession();
        window.location.href = redirectTo || window.AppConfig?.ADMIN_LOGIN_URL || '/login';
    },

    async fetchWithAuth(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: this.authHeaders(options.headers || {})
        });

        if (response.status === 401) {
            this.clearSession();
            window.location.href = window.AppConfig?.ADMIN_LOGIN_URL || '/login';
            throw new Error('Sesión expirada');
        }

        return response;
    }
};

window.AuthService = AuthService;
