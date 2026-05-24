# Delivery Custom App — Solemne 1 Infraestructura

Sistema de gestión para restaurantes con arquitectura en capas, desplegado sobre infraestructura cloud (IaaS, PaaS y SaaS).

---

## Stack tecnológico

| Componente | Tecnología |
|------------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS |
| Backend | FastAPI + Python 3.11 + Uvicorn |
| Base de datos | PostgreSQL (Supabase) |
| Autenticación | Supabase Auth (JWT) |
| Contenerización | Docker + docker-compose |
| CI/CD | GitHub Actions |
| Deploy backend | Render / Railway |
| Deploy frontend | Vercel / Netlify |

---

## Estructura del repositorio

```
Solemne-1-Infrastructura/
├── backend/          # API REST (FastAPI + Python)
│   ├── src/
│   │   ├── api/routes/     # 17+ routers (endpoints HTTP)
│   │   ├── services/       # Lógica de negocio
│   │   ├── schemas/        # Modelos Pydantic
│   │   └── core/           # Configuración, seguridad, JWT
│   ├── docs/               # Documentación técnica
│   ├── migrations/         # Migraciones de base de datos
│   ├── Dockerfile          # Multi-stage build
│   └── docker-compose.yml
│
├── frontend/         # SPA (React + Vite)
│   ├── src/
│   │   ├── components/     # Componentes por módulo (POS, Inventario, Admin)
│   │   ├── hooks/          # Custom hooks (lógica de datos)
│   │   ├── lib/            # API clients (apiClient, inventoryApi, etc.)
│   │   └── context/        # AuthContext (estado global)
│   └── Dockerfile.dev
│
└── docs/             # Documentación del sistema completo
    └── INFRAESTRUCTURA_CLOUD.md   # Identificación IaaS / PaaS / SaaS
```

---

## Arquitectura en capas

### Backend (FastAPI)

```
┌─────────────────────────────────────────┐
│  Capa API (Routes)                      │  ← src/api/routes/
│  17+ routers: auth, orders, inventory,  │
│  suppliers, dashboard, recipes...       │
├─────────────────────────────────────────┤
│  Capa de Servicios (Business Logic)     │  ← src/services/
│  inventory_stock_service.py             │
│  supplier_kpis_service.py               │
│  alert_service.py, recipes_service.py   │
├─────────────────────────────────────────┤
│  Capa de Datos (Supabase SDK)           │  ← src/deps.py
│  db.table("orders").select().execute()  │
│  Row-Level Security (RLS) en Supabase   │
├─────────────────────────────────────────┤
│  Capa Core (Config + Seguridad)         │  ← src/core/
│  JWT validation, RBAC, Pydantic Settings│
└─────────────────────────────────────────┘
```

### Frontend (React)

```
┌─────────────────────────────────────────┐
│  Capa de Presentación (Components)      │  ← src/components/
│  POS, Inventario, Admin, Dashboard      │
├─────────────────────────────────────────┤
│  Capa de Lógica (Custom Hooks)          │  ← src/hooks/
│  useMesas, useOrderManagement,          │
│  useRecipes, useDashboard...            │
├─────────────────────────────────────────┤
│  Capa de API/Servicios                  │  ← src/lib/
│  apiClient.js (JWT inject, retry)       │
│  inventoryApi.js, administrativeApi.js  │
├─────────────────────────────────────────┤
│  Estado Global                          │  ← src/context/
│  AuthContext (user, role, business_id)  │
└─────────────────────────────────────────┘
```

---

## Infraestructura Cloud (IaaS / PaaS / SaaS)

> Ver documentación completa: [docs/INFRAESTRUCTURA_CLOUD.md](docs/INFRAESTRUCTURA_CLOUD.md)

| Modelo | Servicio | Uso |
|--------|----------|-----|
| **IaaS** | Docker + docker-compose | Contenerización del runtime |
| **IaaS** | GitHub Actions | Pipeline CI/CD |
| **PaaS** | Render / Railway | Despliegue del backend |
| **PaaS** | Vercel / Netlify | Despliegue del frontend |
| **SaaS** | Supabase Auth | Autenticación y JWT |
| **SaaS** | Supabase Database | PostgreSQL administrado |

---

## API

- **Swagger UI**: `http://localhost:8000/api/docs` (en desarrollo)
- **OpenAPI JSON**: `http://localhost:8000/api/openapi.json`
- **Documentación**: [backend/docs/API.md](backend/docs/API.md)

Endpoints principales:

| Módulo | Prefijo | Autenticación |
|--------|---------|---------------|
| Auth | `/api/auth` | Pública |
| Órdenes | `/api/orders` | EMPLEADO+ |
| Inventario | `/api/inventory/stock` | ADMIN+ |
| Proveedores | `/api/suppliers` | ADMIN+ |
| Dashboard | `/api/dashboard` | ADMIN+ |
| Recetas | `/api/recipes` | ADMIN+ |

---

## Módulos del sistema

1. **POS** — Gestión de mesas, órdenes y caja registradora
2. **Inventario** — Control de stock con alertas (CRÍTICO / BAJO / ÓPTIMO)
3. **Recetas** — Vinculación de ingredientes a productos del menú
4. **Proveedores** — KPIs de proveedores y órdenes de compra semanales
5. **Dashboard** — Métricas de ventas, inventario y rendimiento
6. **Gestión de usuarios** — RBAC con 4 roles jerárquicos

---

## Roles y permisos

| Rol | Acceso |
|-----|--------|
| SUPERADMIN | Todo el sistema, todos los negocios |
| ADMIN | Su negocio: inventario, dashboard, staff |
| CAJERO | POS, caja, gastos, transferencias |
| EMPLEADO | POS, órdenes |

---

## Desarrollo local

### Requisitos
- Docker + Docker Compose
- Node.js 18+
- Python 3.11+
- Cuenta en Supabase (gratuita)

### Con Docker (recomendado)

```bash
# Backend
cd backend
cp .env.example .env   # completar con credenciales Supabase
docker-compose -f docker-compose.dev.yml up -d

# Frontend
cd frontend
cp .env.example .env   # completar con VITE_API_URL y VITE_SUPABASE_*
npm install
npm run dev
```

**URLs de desarrollo:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger: http://localhost:8000/api/docs

### Sin Docker

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000

# Frontend
cd frontend
npm install && npm run dev
```

---

## Tests

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm run test
```

---

## Documentación técnica

| Documento | Descripción |
|-----------|-------------|
| [docs/INFRAESTRUCTURA_CLOUD.md](docs/INFRAESTRUCTURA_CLOUD.md) | Identificación completa IaaS/PaaS/SaaS |
| [backend/docs/ARCHITECTURE.md](backend/docs/ARCHITECTURE.md) | Arquitectura en capas y flujo de datos |
| [backend/docs/API.md](backend/docs/API.md) | Referencia completa de endpoints |
| [backend/docs/AUTH.md](backend/docs/AUTH.md) | Flujo JWT y RBAC |
| [backend/docs/DEPLOYMENT.md](backend/docs/DEPLOYMENT.md) | Guía de despliegue en producción |
| [backend/docs/TESTING.md](backend/docs/TESTING.md) | Estrategia de pruebas |
