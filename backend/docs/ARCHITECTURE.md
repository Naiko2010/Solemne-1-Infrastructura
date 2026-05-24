# Architecture Guide

High-level architecture and design decisions for Delivery Custom App.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React + Vite)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Components (AdminDashboard, ModulesGrid, POS, etc.)     │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Hooks (useLocals, useDashboard, useCart, etc.)          │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Libraries (apiClient, supabaseClient)                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  Port: 5173 (Development)                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI + Python)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ API Routes (17+ routers)                                │   │
│  │ - Auth, Locals, Products, Orders, Dashboard, etc.       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Services (Business Logic)                               │   │
│  │ - DashboardService, RecipesService, SupplierKPIService │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Core (Auth, Dependencies, Config)                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  Port: 8000 (Development)                                      │
│  Port: 8000 (Production)                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓ SQL/Queries
┌─────────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                         │
│  (Hosted on Supabase)                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Tables: users, businesses, locals, products, orders,    │   │
│  │         recipes, inventory, suppliers, etc.             │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Row-Level Security (RLS) Policies                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                    Supabase Auth Service
                   (JWT Token Generation)
```

---

## Technology Stack

### Backend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | FastAPI | 0.109.0 |
| Server | Uvicorn | 0.27.0 |
| Runtime | Python | 3.11+ |
| Validation | Pydantic | 2.5.3 |
| Auth | python-jose | 3.3.0 |
| DB Client | Supabase SDK | 2.4.0 |

### Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| Library | React | 19.2+ |
| Build Tool | Vite | 8.0+ |
| Runtime | Node.js | 18+ |
| Package Mgr | npm | 9+ |
| Client | Supabase JS | 2.101+ |
| Testing | Vitest | 4.1+ |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (JWT) |
| Storage | Supabase Storage |
| Deployment | Docker (Optional) |

---

## Request Flow

### Example: Get Dashboard Data

```
1. User clicks "Dashboard" in ModulesGrid
   └─> AdminDashboard component renders

2. AdminDashboard calls useDashboard hook
   └─> useDashboard calls apiClient.get('/dashboard/local/{id}')

3. apiClient.js constructs request
   └─> Authorization: Bearer <JWT_TOKEN>
   └─> GET http://127.0.0.1:8000/api/dashboard/local/{id}

4. FastAPI receives request in src/main.py
   └─> Routes to src/api/routes/dashboard.py

5. dashboard.py handler executes
   └─> Calls Depends(get_current_user) to validate JWT
   └─> Checks RBAC (role must be ADMIN or SUPERADMIN)
   └─> Calls DashboardService.get_dashboard_data()

6. DashboardService queries database
   └─> SELECT SUM(amount) FROM orders WHERE local_id = ?
   └─> SELECT * FROM expenses WHERE local_id = ?
   └─> Calculates metrics (daily_sales, monthly_goal, etc.)

7. Backend returns DashboardResponse
   └─> JSON: { daily_sales, monthly_sales, top_products, ... }

8. Frontend receives data
   └─> useDashboard hook updates state
   └─> AdminDashboard re-renders with new data
   └─> User sees updated dashboard
```

---

## Authentication & Authorization

### JWT Token Flow

```
1. User submits email + password
   └─> Frontend calls supabase.auth.signInWithPassword()

2. Supabase validates and generates JWT
   └─> Token expires in 1 hour
   └─> Signature: HMAC-SHA256(header.payload, JWT_SECRET)

3. Frontend stores token in localStorage
   └─> localStorage.setItem('auth_token', token)

4. Frontend includes token in all API requests
   └─> Authorization: Bearer eyJhbGciOiJIUzI1NiI...

5. Backend validates token
   └─> Checks signature matches JWT_SECRET
   └─> Verifies token hasn't expired
   └─> Extracts user_id from payload

6. Backend applies RBAC
   └─> Queries public.users table for user role
   └─> Compares role against endpoint requirements
   └─> Returns 403 if insufficient permissions

7. If valid, execute endpoint
   └─> Return protected data
   └─> Or 403 Forbidden if not allowed
```

### Role Hierarchy

```
SUPERADMIN (Level 4)
  ├─ Manage all businesses
  ├─ Manage all users
  ├─ View all dashboards
  └─ Full system access

ADMIN (Level 3)
  ├─ Manage own business
  ├─ Manage local users
  ├─ View local dashboards
  └─ Create/manage orders

CAJERO (Level 2)
  ├─ Create orders
  ├─ Manage cajas (registers)
  ├─ View products
  └─ View order history

EMPLEADO (Level 1)
  ├─ View products (read-only)
  ├─ View orders (read-only)
  └─ Limited access
```

---

## Data Model

### Core Entities

```
┌─────────────────────────────────────────────────┐
│ businesses                                      │
│ ├─ id (UUID, PK)                               │
│ ├─ name                                         │
│ ├─ address                                      │
│ └─ rut (Chilean business ID)                    │
└─────────────────────────────────────────────────┘
            ↓ 1:N
┌─────────────────────────────────────────────────┐
│ locals                                          │
│ ├─ id (UUID, PK)                               │
│ ├─ business_id (FK)                            │
│ ├─ name                                         │
│ ├─ address                                      │
│ └─ phone                                        │
└─────────────────────────────────────────────────┘
            ↓ 1:N
┌─────────────────────────────────────────────────┐
│ orders                                          │
│ ├─ id (UUID, PK)                               │
│ ├─ local_id (FK)                               │
│ ├─ total_amount                                 │
│ ├─ status                                       │
│ └─ created_at                                   │
└─────────────────────────────────────────────────┘
            ↓ 1:N
┌─────────────────────────────────────────────────┐
│ order_items                                     │
│ ├─ id (UUID, PK)                               │
│ ├─ order_id (FK)                               │
│ ├─ product_id (FK)                             │
│ ├─ quantity                                     │
│ └─ unit_price                                   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ users                                           │
│ ├─ id (UUID, PK)                               │
│ ├─ email                                        │
│ ├─ name                                         │
│ ├─ role (SUPERADMIN|ADMIN|CAJERO|EMPLEADO)    │
│ └─ local_id (FK, optional)                      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ products                                        │
│ ├─ id (UUID, PK)                               │
│ ├─ local_id (FK)                               │
│ ├─ name                                         │
│ ├─ price                                        │
│ ├─ category_id (FK)                            │
│ └─ stock_quantity                               │
└─────────────────────────────────────────────────┘
```

---

## Row-Level Security (RLS)

Supabase enforces data access at database level:

```sql
-- Users can only see locals they manage
CREATE POLICY "users_see_own_locals"
ON locals FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM user_locals
  )
);

-- Users can only see orders from their local
CREATE POLICY "users_see_own_orders"
ON orders FOR SELECT
USING (
  local_id IN (
    SELECT local_id FROM user_locals 
    WHERE user_id = auth.uid()
  )
);
```

---

## Caching Strategy

### Frontend Caching

```javascript
// In hooks (useLocals, useDashboard, etc.)
const CACHE_DURATION = 30000; // 30 seconds

const [cache, setCache] = useState({
  data: null,
  timestamp: null
});

// Only fetch if cache expired
if (Date.now() - cache.timestamp > CACHE_DURATION) {
  const data = await apiClient.get(endpoint);
  setCache({ data, timestamp: Date.now() });
}
```

**Affected endpoints:**
- `GET /api/locals` - 30s cache
- `GET /api/dashboard/local/{id}` - 30s cache
- `GET /api/products?category_id=` - 60s cache

### Backend Caching

No explicit caching layer (yet). Candidates:
- Redis for dashboard metrics (slow queries)
- Database query optimization with indexes

---

## Error Handling

### Frontend Error Handling

```javascript
// apiClient.js
try {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    if (response.status === 401) {
      // Token expired - redirect to login
      window.location.href = '/login';
    } else if (response.status === 403) {
      // Insufficient permissions
      showError('No tienes permisos para esta acción');
    } else if (response.status === 404) {
      // Resource not found
      showError('Recurso no encontrado');
    } else {
      // Other errors
      showError(`Error: ${response.statusText}`);
    }
  }
  
  return response.json();
} catch (error) {
  showError('Error de conexión. Intenta nuevamente.');
  throw error;
}
```

### Backend Error Handling

```python
# In route handlers
try:
  # Validate input
  if not input_data.name:
    raise HTTPException(400, "Name required")
  
  # Check permissions
  if not has_permission(user, local_id):
    raise HTTPException(403, "Forbidden")
  
  # Query database
  result = supabase.table("locals").insert(input_data).execute()
  return result.data
  
except Exception as e:
  logger.error(f"Error: {e}")
  raise HTTPException(500, "Internal server error")
```

---

## Deployment Architecture

### Development (Local)
```
Frontend (npm run dev) → Backend (uvicorn) → Supabase
  :5173                  :8000              Cloud
```

### Production (Recommended)
```
Vercel/Netlify (Frontend) → Render/Railway (Backend) → Supabase
  Production               Production                 Cloud
```

### Docker Option
```
docker-compose.yml
├─ frontend service (Node)
├─ backend service (Python)
└─ Optional: PostgreSQL local
```

---

## Performance Considerations

### Backend Optimization
- **Database indexes** on frequently queried columns
- **Query optimization** - avoid N+1 queries
- **Async operations** - use `async def` in FastAPI
- **Pagination** - limit result sets

### Frontend Optimization
- **Code splitting** - lazy load components
- **Minification** - Vite handles this
- **Caching** - 30s for API responses
- **Image optimization** - use modern formats
- **CSS-in-JS** - minimal styles shipped

---

## Scalability

### Horizontal Scaling (Multiple Servers)
- Backend: Deploy multiple FastAPI instances behind load balancer
- Frontend: Static files served via CDN (Vercel, Netlify)
- Database: Supabase handles connections

### Vertical Scaling (Bigger Servers)
- Increase server RAM/CPU
- Upgrade database instance
- Add Redis for caching

---

For more details, see:
- [API Documentation](./API.md)
- [Authentication Flow](./AUTH.md)
- [Contributing Guide](./CONTRIBUTING.md)
