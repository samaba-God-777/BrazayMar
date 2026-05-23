# Brazas$Mar

Tienda online + panel de administración con **MongoDB**.

## Requisitos

- Node.js 18+
- **MongoDB** en ejecución (local o Atlas)

```bash
# macOS con Homebrew
brew services start mongodb-community
```

## Configuración

```bash
cd backend
npm install
cp .env.example .env   # opcional: edita MONGODB_URI
npm start
```

Variables de entorno (`.env`):

| Variable | Descripción |
|----------|-------------|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/brazasmar` (por defecto) |
| `PORT` | Puerto del servidor (default `4000`) |

Al primer arranque, los productos de `backend/data/menu.json` se **migran automáticamente** a MongoDB si la colección está vacía.

## URLs

| Página | URL |
|--------|-----|
| Tienda | http://localhost:4000 |
| Login admin | http://localhost:4000/login |
| Productos (admin) | http://localhost:4000/admin |
| Pedidos (admin) | http://localhost:4000/admin/pedidos |

## Credenciales admin

| Usuario | Contraseña |
|---------|------------|
| `admin` | `admin123` |

## Base de datos

- **Productos** → colección `products` (menú en la tienda y panel admin)
- **Pedidos** → colección `orders` (botón “Enviar Pedido al Administrador”)
