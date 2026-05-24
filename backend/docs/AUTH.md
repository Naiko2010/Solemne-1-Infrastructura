# Authentication Flow

Complete authentication flow documentation for Delivery Custom App.

---

## Overview

The application uses **JWT (JSON Web Tokens)** for authentication, delegated to **Supabase Auth**.

```
┌─────────────────────────────────────────────────────────────┐
│ User (Frontend/Browser)                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Supabase Auth Service                                       │
│ - Email/Password validation                                 │
│ - JWT generation (1 hour expiry)                            │
│ - Session management                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React)                                            │
│ - Stores token in localStorage                             │
│ - Includes token in all API requests                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend (FastAPI)                                           │
│ - Validates JWT signature                                  │
│ - Verifies token hasn't expired                            │
│ - Extracts user role and permissions                       │
│ - Checks RBAC for endpoint access                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Response with protected data                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Flow

### 1. User Login (Frontend)

User submits email + password in login form:

```javascript
// src/hooks/useAuth.js or App.jsx
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "secure_password_123"
});

if (data?.session?.access_token) {
  localStorage.setItem('auth_token', data.session.access_token);
  // Redirect to dashboard
}
```

---

### 2. Supabase Returns JWT Token

Supabase validates credentials and returns:

```json
{
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 3600,
    "refresh_token": "refresh_token_here",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "user_metadata": {
        "name": "John Doe",
        "role": "ADMIN"
      }
    }
  }
}
```

**Token Structure (JWT):**
```
Header: { "alg": "HS256", "typ": "JWT" }
Payload: { 
  "sub": "user_id",
  "email": "user@example.com",
  "role": "ADMIN",
  "iat": 1704067200,
  "exp": 1704070800
}
Signature: HMACSHA256(header.payload, JWT_SECRET)
```

---

### 3. Frontend Stores Token

```javascript
// Store token for future requests
localStorage.setItem('auth_token', access_token);

// Can also store in state/context
setUserToken(access_token);
```

---

### 4. Frontend Makes Protected API Request

Every request to backend includes Authorization header:

```javascript
// lib/apiClient.js
const apiRequest = async (method, endpoint, data, token) => {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`  // ← Token here
  };
  
  const response = await fetch(`http://localhost:8000${endpoint}`, {
    method,
    headers,
    body: JSON.stringify(data)
  });
  
  return response.json();
};
```

**Example Request:**
```http
GET /api/dashboard/local/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 5. Backend Validates Token

In [src/core/deps.py](../src/core/deps.py):

```python
async def get_current_user(
    token: str = Depends(oauth2_scheme)
) -> dict:
    """
    Validates JWT token from Authorization header
    """
    try:
        # Decode token using JWT_SECRET from .env
        payload = jose.jwt.get_unverified_claims(token)
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication credentials"
            )
        
        # Query Supabase for user details
        user = supabase.table("users").select("*").eq("id", user_id).single().execute()
        
        return user.data
        
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials"
        )
```

---

### 6. Backend Checks RBAC

```python
# In route handlers
@router.get("/dashboard/local/{local_id}")
async def get_dashboard(
    local_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Only ADMIN or SUPERADMIN can access
    """
    # Check role
    if current_user.get("role") not in ["ADMIN", "SUPERADMIN"]:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions"
        )
    
    # Check if user manages this local
    if current_user.get("role") == "ADMIN":
        # Verify user has access to this local
        local_access = verify_local_access(current_user["id"], local_id)
        if not local_access:
            raise HTTPException(status_code=403, detail="Forbidden")
    
    # Return dashboard data
    return get_dashboard_data(local_id)
```

---

### 7. Backend Returns Protected Data

```json
{
  "local": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Centro"
  },
  "daily_sales": 1250.50,
  "monthly_sales": 28450.75,
  ...
}
```

---

## Token Expiry & Refresh

### When Token Expires
- Default: **1 hour** (3600 seconds)
- User gets 401 error when making requests
- Frontend should redirect to login

```javascript
// In apiClient.js
if (response.status === 401) {
  // Token expired
  localStorage.removeItem('auth_token');
  window.location.href = '/login';
}
```

### Refreshing Token (Optional)

Supabase provides refresh token:

```javascript
const { data, error } = await supabase.auth.refreshSession();

if (data.session) {
  localStorage.setItem('auth_token', data.session.access_token);
}
```

---

## Roles and Permissions

### Available Roles

| Role | Level | Permissions |
|------|-------|-------------|
| **SUPERADMIN** | 4 | All actions, system-wide |
| **ADMIN** | 3 | Manage own business, users, orders |
| **CAJERO** | 2 | Create/close orders, manage cajas |
| **EMPLEADO** | 1 | Read-only access to products, orders |

### Permission Matrix

| Endpoint | SUPERADMIN | ADMIN | CAJERO | EMPLEADO |
|----------|-----------|-------|--------|----------|
| GET /api/dashboard/local/{id} | ✓ | ✓ | ✗ | ✗ |
| POST /api/orders | ✓ | ✓ | ✓ | ✗ |
| GET /api/products | ✓ | ✓ | ✓ | ✓ |
| PATCH /api/users | ✓ | ✓ | ✗ | ✗ |
| DELETE /api/orders/{id} | ✓ | ✓ | ✓ | ✗ |

---

## Security Best Practices

### Frontend
- ✅ Store token in `localStorage` (accessible to JS)
- ✅ Never store token in URL or query parameters
- ✅ Clear token on logout
- ✅ Include token in all protected requests
- ✅ Handle 401 errors gracefully

### Backend
- ✅ Validate token signature with `JWT_SECRET`
- ✅ Check token expiration
- ✅ Verify user exists in database
- ✅ Apply RBAC on every endpoint
- ✅ Log authentication attempts

### Environment
- ✅ `JWT_SECRET` must be secure and unique
- ✅ Never commit `.env` to git
- ✅ Use HTTPS in production
- ✅ Rotate secrets regularly

---

## Troubleshooting

### Issue: "Invalid authentication credentials"

**Cause:** Token missing, invalid, or expired

**Solution:**
```javascript
// Check token exists
const token = localStorage.getItem('auth_token');
if (!token) {
  // Redirect to login
  window.location.href = '/login';
}

// Try refreshing
const { data } = await supabase.auth.refreshSession();
if (data.session) {
  localStorage.setItem('auth_token', data.session.access_token);
}
```

### Issue: "Not enough permissions"

**Cause:** User role doesn't have access to endpoint

**Solution:**
- Check user role in Supabase
- Verify role has permission for endpoint
- Contact ADMIN to upgrade role

### Issue: Token not sent in requests

**Cause:** Missing Authorization header

**Solution:**
```javascript
// WRONG - Missing header
fetch('/api/dashboard/local/123');

// CORRECT - Include header
fetch('/api/dashboard/local/123', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Logout Flow

```javascript
// Frontend - Remove token
localStorage.removeItem('auth_token');

// Frontend - Clear user state
setUser(null);
setToken(null);

// Frontend - Sign out from Supabase
await supabase.auth.signOut();

// Frontend - Redirect to login
window.location.href = '/login';
```

No server-side logout needed with JWT (stateless).

---

For more information:
- [API Documentation](./API.md)
- [Backend README](../README.md)
- [Frontend README](../../Delivery-Custom-App-INGSW2-FRONTEND/README.md)
