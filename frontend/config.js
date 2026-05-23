/**
 * Conexión frontend ↔ backend.
 * Usa siempre: cd backend && npm start → http://localhost:4000
 */
(function () {
    const BACKEND_PORT = '4000';
    const host = window.location.hostname || 'localhost';
    const port = window.location.port;
    const protocol = window.location.protocol;

    function getBackendOrigin() {
        if (protocol === 'file:') {
            return `http://localhost:${BACKEND_PORT}`;
        }
        if (port === BACKEND_PORT || (port === '' && protocol === 'http:')) {
            return window.location.origin;
        }
        if (host === 'localhost' || host === '127.0.0.1') {
            return `http://${host}:${BACKEND_PORT}`;
        }
        return window.location.origin;
    }

    const backendOrigin = getBackendOrigin();
    const apiBase = `${backendOrigin}/api`;

    async function parseJsonResponse(response) {
        const text = await response.text();

        if (!text || !text.trim()) {
            throw new Error(
                response.ok
                    ? 'El servidor respondió vacío. ¿Está corriendo en el puerto 4000? (cd backend && npm start)'
                    : `Error del servidor (${response.status}). Comprueba que el backend esté activo en http://localhost:4000`
            );
        }

        try {
            return JSON.parse(text);
        } catch {
            const preview = text.slice(0, 80).replace(/\s+/g, ' ');
            throw new Error(
                `Respuesta no válida del servidor (${response.status}). ` +
                `Abre la app en http://localhost:4000 — no uses Live Server ni file://. ${preview}`
            );
        }
    }

    window.AppConfig = {
        API_BASE_URL: apiBase,
        SERVER_ORIGIN: backendOrigin,
        BACKEND_ORIGIN: backendOrigin,
        ADMIN_LOGIN_URL: `${backendOrigin}/login`,
        ADMIN_DASHBOARD_URL: `${backendOrigin}/admin`,
        STORE_URL: `${backendOrigin}/`,
        parseJsonResponse
    };
})();
