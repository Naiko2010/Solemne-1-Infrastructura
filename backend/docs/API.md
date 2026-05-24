# API Documentation

Complete API documentation for Delivery Custom App Backend.

## Quick Access

- **Swagger UI (Interactive):** `http://localhost:8000/api/docs`
- **ReDoc (Alternative):** `http://localhost:8000/api/redoc`
- **OpenAPI JSON:** `http://localhost:8000/openapi.json`

---

## Authentication

All protected endpoints require JWT token in Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

### Getting a Token

1. Sign up/login via Supabase (frontend handles this)
2. Supabase returns JWT token
3. Include token in all API requests

---

## Base Endpoints

| Module | Base URL | Status |
|--------|----------|--------|
| Auth | `/api/auth/` | ✓ Active |
| Businesses | `/api/businesses/` | ✓ Active |
| Locals | `/api/locals/` | ✓ Active |
| Products | `/api/products/` | ✓ Active |
| Orders | `/api/orders/` | ✓ Active |
| Dashboard | `/api/dashboard/` | ✓ Active |
| Inventory | `/api/inventory/` | ✓ Active |
| Inventory KPIs | `/api/inventory/kpis/` | ✓ Active |
| Purchases | `/api/purchases/` | ✓ Active |
| Suppliers | `/api/suppliers/` | ✓ Active |
| Weekly Purchase Orders | `/api/weekly-purchase-orders/` | ✓ Active |
| Cajas | `/api/cajas/` | ✓ Active |
| Mesas | `/api/mesas/` | ✓ Active |
| Users | `/api/users/` | ✓ Active |
| Expenses | `/api/expenses/` | ✓ Active |
| Transfers | `/api/transfers/` | ✓ Active |
| Cart Items | `/api/cart_items/` | ✓ Active |
| Recipes | `/api/recipes/` | ✓ Active |
| Providers | `/api/providers/` | ✓ Active |

---

## Key Endpoints

### Auth Module

#### GET /api/auth/me
Get current authenticated user.

**Request:**
```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "ADMIN"
}
```

---

### Locals Module

#### GET /api/locals?business_id=<uuid>
List all locals for a business.

**Request:**
```http
GET /api/locals?business_id=550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Centro",
    "address": "Calle Principal 123",
    "phone": "+56912345678",
    "business_id": "uuid"
  }
]
```

---

### Dashboard Module

#### GET /api/dashboard/local/{local_id}
Get dashboard metrics for a specific local.

**Request:**
```http
GET /api/dashboard/local/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "local": {
    "id": "uuid",
    "name": "Centro",
    "address": "Calle Principal 123"
  },
  "daily_sales": 1250.50,
  "monthly_sales": 28450.75,
  "monthly_cash_flow": 18500.25,
  "monthly_expenses": 4250.00,
  "monthly_transfers": 5700.50,
  "petty_cash": {
    "active_cajas": 2,
    "total_cajas": 3,
    "status": "healthy"
  },
  "monthly_goal": {
    "target_amount": 30000,
    "achieved_amount": 28450.75,
    "progress_percentage": 94.84
  },
  "active_alerts": 2,
  "top_products": [
    {
      "product_name": "Café",
      "units_sold": 250,
      "revenue": 1250
    }
  ],
  "cajas_count": 3,
  "active_cajas_count": 2,
  "generated_at": "2025-03-31T14:30:25Z"
}
```

---

### Inventory Module

#### GET /api/inventory/kpis/{local_id}
Get inventory KPIs for a local.

**Request:**
```http
GET /api/inventory/kpis/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "local_id": "uuid",
  "total_items": 1250,
  "low_stock_items": 45,
  "expired_items": 3,
  "total_value": 125000.00,
  "inventory_health": "good"
}
```

---

### Orders Module

#### POST /api/orders
Create a new order.

**Request:**
```http
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "local_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "unit_price": 500.00
    }
  ],
  "payment_method": "cash",
  "status": "pending"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "local_id": "uuid",
  "total_amount": 1000.00,
  "status": "pending",
  "created_at": "2025-03-31T14:30:25Z"
}
```

---

## Error Responses

All errors follow this format:

**400 Bad Request:**
```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**401 Unauthorized:**
```json
{
  "detail": "Invalid authentication credentials"
}
```

**403 Forbidden:**
```json
{
  "detail": "Not enough permissions"
}
```

**404 Not Found:**
```json
{
  "detail": "Item not found"
}
```

**500 Internal Server Error:**
```json
{
  "detail": "Internal server error"
}
```

---

## Rate Limiting

Currently no rate limiting is enforced, but it's recommended to:
- Limit requests to 1000 per hour per user
- Cache responses when possible (30 seconds minimum)
- Use pagination for large datasets

---

## Testing the API

### Using Swagger UI
1. Open `http://localhost:8000/api/docs`
2. Click "Authorize" button
3. Paste your JWT token
4. Try endpoints interactively

### Using cURL
```bash
curl -X GET "http://localhost:8000/api/locals?business_id=uuid" \
  -H "Authorization: Bearer your_token_here"
```

### Using JavaScript/Fetch
```javascript
const response = await fetch('http://localhost:8000/api/locals?business_id=uuid', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your_token_here',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);
```

---

## Changelog

### v1.0.0 (Current)
- All core endpoints implemented
- JWT authentication
- RBAC (Role-Based Access Control)
- Dashboard with KPIs
- Inventory management
- Order management
- Supplier integration

---

For more details, see:
- [Architecture Guide](./ARCHITECTURE.md)
- [Database Schema](./DATABASE.md)
- [Authentication Flow](./AUTH.md)
