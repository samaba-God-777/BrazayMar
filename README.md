# Brazas$Mar v2

Tienda online + panel de administración con **MongoDB**, **autenticación JWT**, **roles** (cliente / admin), **facturas PDF** y **analíticas de ventas**.

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
cp .env.example .env   # edita MONGODB_URI y AUTH_SECRET
npm start
```

### Variables de entorno (`.env`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `MONGODB_URI` | Cadena de conexión a Mongo | `mongodb://127.0.0.1:27017/brazasmar` |
| `PORT` | Puerto del servidor | `4000` |
| `AUTH_SECRET` | Secreto para firmar los JWT | (genera uno fuerte en producción) |
| `ADMIN_EMAIL` | Email del admin inicial | `admin@brazasmar.local` |
| `ADMIN_PASSWORD` | Contraseña del admin inicial | `admin123` |
| `CORS_ORIGIN` | Orígenes permitidos (CSV o `*`) | `*` |

Al primer arranque se crea automáticamente el usuario admin (`admin` / `admin123`) y se migran los productos de `backend/data/menu.json` si la colección está vacía.

## Páginas

| Página | URL | Acceso |
|--------|-----|--------|
| Login unificado (cliente / admin) | http://localhost:4000/login | público |
| Registro de cliente | http://localhost:4000/registro | público |
| Mi cuenta (perfil + pedidos) | http://localhost:4000/mi-cuenta | cliente o admin |
| Tienda | http://localhost:4000/ | cliente autenticado |
| Panel admin (productos) | http://localhost:4000/admin | admin |
| Pedidos (admin) | http://localhost:4000/admin/pedidos | admin |

## Credenciales por defecto

| Rol | Usuario | Contraseña |
|-----|---------|------------|
| Admin | `admin` | `admin123` |
| Cliente | (crear cuenta desde /registro) | — |

## Roles y permisos

- **cliente**: navegar tienda, crear pedidos, ver sus pedidos, descargar su factura, editar su perfil.
- **admin**: todo lo del cliente + CRUD de productos, ver todos los pedidos, cambiar estado, eliminar pedidos, descargar cualquier factura, ver analíticas.

## API REST

### Autenticación
| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | – | Crear cuenta de cliente |
| POST | `/api/auth/login` | – | Login (admin o cliente) con `identifier` (usuario o email) + `password` |
| GET | `/api/auth/me` | ✓ | Usuario actual |
| PUT | `/api/auth/profile` | ✓ | Actualizar perfil (name, phone, address, email) |
| PUT | `/api/auth/password` | ✓ | Cambiar contraseña |
| POST | `/api/auth/logout` | – | Cerrar sesión (no-op, limpia el cliente) |

### Productos
| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| GET | `/api/menu` | – | Menú agrupado por categoría |
| GET | `/api/products/:id` | ✓ | Obtener producto |
| POST | `/api/products` | admin | Crear producto (con imagen) |
| PUT | `/api/products/:id` | admin | Actualizar producto |
| DELETE | `/api/products/:id` | admin | Eliminar producto |

### Pedidos
| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| POST | `/api/orders` | – (opcional) | Crear pedido (se vincula al usuario si hay token) |
| GET | `/api/orders` | ✓ | Listar pedidos (cliente: solo suyos; admin: todos) |
| GET | `/api/orders/:id` | ✓ | Obtener un pedido (con control de propiedad) |
| PATCH | `/api/orders/:id/status` | admin | Cambiar estado (`pendiente`/`proceso`/`completado`/`cancelado`) |
| DELETE | `/api/orders/:id` | admin | Eliminar pedido |
| GET | `/api/orders/:id/invoice` | ✓ | Descargar factura PDF (con control de propiedad) |
| GET | `/api/orders/stats` | admin | Estadísticas (totales, por estado, revenue) |

### Analíticas (solo admin)
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/analytics/sales` | Buckets diario/semanal/mensual/anual + top productos del mes |

Query params: `?from=ISO&to=ISO` (rango personalizado).

## Base de datos (MongoDB)

- **products** (collection): `productId`, `nombre`, `descripcion`, `precio`, `categoria`, `imagen`, `destacado`, `descuento`, `rating`, `fechaCreacion`, `fechaActualizacion`.
- **orders** (collection): `orderId`, `userId`, `cliente{nombre,telefono,direccion,email}`, `productos[]`, `totales{subtotal,envio,total,items}`, `notas`, `estado`, `estadoHistorial[]`, `fecha`.
- **users** (collection): `username`, `email`, `name`, `phone`, `address`, `passwordHash` (pbkdf2+salt), `role` (`cliente`/`admin`), `active`, `lastLoginAt`, timestamps.

## Seguridad

- Contraseñas con **pbkdf2-sha512** + salt aleatorio (120k iteraciones).
- Tokens **JWT HS256** firmados con `AUTH_SECRET` (TTL 24h cliente, 8h admin).
- **Helmet** para cabeceras HTTP seguras.
- **Rate-limit** en `/api/auth/*` y API general.
- **CORS** configurable por env.
- Validación de roles en todas las rutas protegidas (`requireRole`).
- Los clientes solo ven/modifican sus propios pedidos.
