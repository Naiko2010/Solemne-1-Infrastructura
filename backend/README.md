# SibaGestion — Backend

Sistema de gestión para restaurantes. API FastAPI que consume el [frontend React](../Delivery-Custom-App-INGSW2-FRONTEND).

## Stack

| | |
|---|---|
| Framework | FastAPI 0.109.0 + Python 3.11 |
| Server | Uvicorn 0.27.0 |
| Database | PostgreSQL vía Supabase SDK |
| Auth | Supabase Auth (JWT) + RBAC |
| Validation | Pydantic 2.5.3 |
| Tests | pytest + TestClient |

## Módulos / Rutas

| Módulo | Prefijo | Roles mínimos |
|--------|---------|--------------|
| Auth | `/api/auth` | público |
| Locales | `/api/locals` | ADMIN |
| Negocios | `/api/businesses` | SUPERADMIN |
| Usuarios | `/api/users` | ADMIN |
| Órdenes | `/api/orders` | EMPLEADO |
| Mesas | `/api/mesas` | EMPLEADO |
| Cajas | `/api/cajas` | CAJERO |
| Inventario stock | `/api/inventory/stock` | ADMIN |
| Inventario KPI | `/api/inventory/kpi` | ADMIN |
| Productos | `/api/products` | ADMIN |
| Categorías | `/api/categories` | ADMIN |
| Recetas | `/api/recipes` | ADMIN |
| Proveedores | `/api/suppliers` | ADMIN |
| Compras | `/api/purchases` | ADMIN |
| Órdenes de compra | `/api/weekly-purchase-orders` | ADMIN |
| Gastos | `/api/expenses` | CAJERO |
| Transferencias | `/api/transfers` | CAJERO |
| Dashboard | `/api/dashboard` | ADMIN |
| Cart items | `/api/cart-items` | EMPLEADO |

## Roles

- **SUPERADMIN** — acceso total, gestión de negocios
- **ADMIN** — gestión de su negocio (inventario, reportes, staff)
- **CAJERO** — POS, órdenes, caja, gastos, transferencias
- **EMPLEADO** — POS, órdenes

## Desarrollo local

### Con Docker (recomendado)

```powershell
.\scripts\docker-dev-up.ps1
# Backend: http://localhost:8000
# Docs:    http://localhost:8000/api/docs
# Frontend: http://localhost:5173
```

### Sin Docker

```bash
python -m venv .venv
.\.venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env            # configurar Supabase y JWT
python -m uvicorn src.main:app --reload --port 8000
```

Variables requeridas en `.env`:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<anon_key>
JWT_SECRET=<secret>
```

## Estructura

```
src/
├── main.py              # FastAPI app, router registration
├── deps.py              # JWT validation, get_current_user, get_db
├── core/
│   ├── config.py        # Pydantic Settings (env vars)
│   └── security.py      # JWT encode/decode
├── api/routes/          # Un router por módulo
├── services/            # Lógica de negocio
├── inventario_kpi/      # KPI logic separado
└── schemas/             # Pydantic models compartidos
```

## Tests

```bash
pytest -v                        # todos
pytest tests/test_orders.py -v  # módulo específico
pytest --cov=src --cov-report=term-missing
```

Cada test file usa `TestClient` + `app.dependency_overrides` — sin DB real.

## Docs API

Con el servidor corriendo: http://localhost:8000/api/docs (Swagger UI)

## Documentación

| Doc | Contenido |
|-----|-----------|
| [docs/API.md](./docs/API.md) | Referencia completa de endpoints |
| [docs/AUTH.md](./docs/AUTH.md) | JWT, RBAC, flujo de autenticación |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Diseño del sistema |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Docker, producción |
| [docs/TESTING.md](./docs/TESTING.md) | Guía de tests |
| [SECURITY.md](./SECURITY.md) | Reporte de vulnerabilidades |
| [ATTRIBUTIONS.md](./ATTRIBUTIONS.md) | Dependencias y créditos |
