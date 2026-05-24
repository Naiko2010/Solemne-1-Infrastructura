# SibaGestion — Frontend

Sistema de gestión para restaurantes. Frontend React que consume la [API FastAPI](../Delivery-Custom-App-INGSW2).

## Stack

| | |
|---|---|
| Framework | React 19 + Vite 8 |
| Router | React Router 6 |
| Auth | Supabase Auth (JWT) |
| Charts | Recharts |
| Tests | Vitest + Testing Library |

## Módulos

| Módulo | Ruta | Roles |
|--------|------|-------|
| POS | `/local/:id/pos` | Cajero, Empleado, Admin, Superadmin |
| Inventario | `/local/:id/inventario` | Admin, Superadmin |
| Administrativo | `/local/:id/administrativo` | Admin, Superadmin |
| Gestión de Locales | `/admin` | Admin, Superadmin |

## Roles

- **Superadmin** — acceso total, gestión de negocios y locales
- **Admin** — gestión de su negocio (inventario, reportes, staff)
- **Cajero** — POS, órdenes, caja
- **Empleado** — POS, órdenes

## Desarrollo local

### Con Docker (recomendado)

Desde el repo backend:

```bash
.\scripts\docker-dev-up.ps1
# Frontend: http://localhost:5173
# API:      http://localhost:8000
# Docs API: http://localhost:8000/api/docs
```

### Sin Docker

```bash
# Requiere backend corriendo en :8000
npm install
cp .env.example .env   # configurar VITE_API_URL y VITE_SUPABASE_*
npm run dev
```

Variables de entorno requeridas:

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

## Tests

```bash
npm test              # watch mode
npm run test:ui       # UI visual (Vitest)
npm run test:coverage # cobertura
```

## Estructura

```
src/
├── components/
│   ├── pos/          # POS, mesas, órdenes
│   ├── inventory/    # Stock, recetas, proveedores, compras
│   └── charts/       # Recharts wrappers
├── hooks/            # Data fetching (useEffect + apiClient)
├── lib/
│   ├── apiClient.js  # Fetch wrapper: auth, retry 401, error parsing
│   ├── supabaseClient.js
│   ├── inventoryApi.js
│   ├── administrativeApi.js
│   └── weeklyPurchasesApi.js
└── styles/           # CSS por módulo
```

## Auth flow

1. Login vía Supabase Auth → JWT con `user_metadata.role` y `user_metadata.business_id`
2. `apiClient.js` inyecta el token en cada request (`Authorization: Bearer ...`)
3. En 401, refresca sesión automáticamente y reintenta
4. Backend (`deps.py`) extrae rol del JWT y aplica RBAC

## Seed data para pruebas

Ver [docs/SEED_DATA.md](./docs/SEED_DATA.md) para instrucciones de carga de datos de prueba en Supabase.
