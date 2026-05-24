# Seguridad: Validaciones y RLS Policies

## Estrategia de Seguridad del Backend

El backend implementa seguridad en **múltiples capas**:

### 1. **Autenticación: JWT de Supabase**
- Frontend hizo login en Supabase y obtuvo JWT token
- Backend verifica JWT usando `JWT_SECRET` de Supabase
- `get_current_user` en `deps.py` valida todos los requests
- Si token es inválido/expirado → **401 Unauthorized**

### 2. **Autorización: Role-Based Access Control (RBAC)**
- Cada endpoint verifica el rol del usuario antes de operar
- Roles permitidos: `SUPERADMIN`, `ADMIN`, `CAJERO`, `EMPLEADO`

**Ejemplo en un endpoint:**
```python
if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only admins can create products",
    )
```

### 3. **Row-Level Security (RLS): Supabase Policies**
⚠️ **IMPORTANTE**: Las RLS policies en Supabase **NO APLICAN** automáticamente con el cliente Python.

Las policies en tu BD son:
- `users_select_own` - Los usuarios solo ven su propio registro
- `cajas_empleado_own_active` - Los empleados solo ven cajas asignadas
- `orders_empleado_*` - Los empleados solo ven órdenes de sus cajas
- etc.

**Problema**: El cliente Python de Supabase usa `SERVICE_ROLE_KEY`, que **bypassa todas las RLS policies**.

**Solución**: Implementar validaciones en backend:

```python
# ❌ SIN VALIDACIÓN - viola RLS policies
def list_orders(local_id: UUID, db=Depends(get_db)):
    response = db.table("orders").select("*").execute()  # Ve TODAS las órdenes
    return response.data

# ✅ CON VALIDACIÓN - respeta RLS policies
def list_orders(local_id: UUID, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    # Si es empleado, solo puede ver órdenes de su caja
    if current_user.get("role") == "EMPLEADO":
        # Obtener cajas del usuario
        cajas_response = db.table("user_cajas").select("caja_id").eq("user_id", current_user["user_id"]).execute()
        caja_ids = [c["caja_id"] for c in cajas_response.data]

        # Filtrar órdenes solo de esas cajas
        response = db.table("orders").select("*").eq("local_id", str(local_id)).in_("caja_id", caja_ids).execute()
        return response.data

    # Si es admin/superadmin, ve todo
    response = db.table("orders").select("*").eq("local_id", str(local_id)).execute()
    return response.data
```

---

## Capas de Seguridad Implementadas

### Capa 1: Autenticación (JWT)
✅ En `deps.py:get_current_user()`
- Valida token Supabase
- Recupera datos de usuario desde tabla `public.users`
- Verifica que usuario esté activo (`is_active=true`)

### Capa 2: RBAC Básico
✅ En cada endpoint
- Valida `current_user.get("role")`
- Rechaza requests sin permisos

### Capa 3: RBAC Avanzado (RLS Emulation)
⚠️ **TODO**: Implementar validaciones complejas para:
- **Empleados**: Solo ver/crear órdenes de sus cajas
- **Cajeros**: Solo gestionar su caja asignada
- **Admins**: Gestionar solo su negocio

---

## Plan de Implementación de RLS en Backend

Para endpoints críticos, agregar validaciones como:

```python
# Ejemplo: Listar órdenes respetando RLS
@router.get("/orders", response_model=list[OrderResponse])
async def list_orders(
    local_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    # 1. Validación básica RBAC
    authorized_roles = ["SUPERADMIN", "ADMIN", "CAJERO"]
    if current_user.get("role") not in authorized_roles:
        raise HTTPException(status_code=403, detail="Not authorized")

    # 2. Validación RLS Avanzada
    if current_user.get("role") == "EMPLEADO":
        # Empleados solo ven órdenes de cajas asignadas
        cajas = db.table("user_cajas").select("caja_id").eq("user_id", current_user["user_id"]).execute()
        caja_ids = [c["caja_id"] for c in cajas.data]
        query = db.table("orders").select("*").eq("local_id", str(local_id)).in_("caja_id", caja_ids)
    else:
        # Admins ven todas las órdenes del local
        query = db.table("orders").select("*").eq("local_id", str(local_id))

    response = query.execute()
    return response.data
```

---

## Resumen

| Layer | Implementado | Método |
|-------|-------------|--------|
| **Autenticación** | ✅ | JWT de Supabase |
| **RBAC Básico** | ✅ | Validaciones en endpoints |
| **RLS Avanzado** | ⚠️ Parcial | Necesita validaciones por endpoint |
| **Data Isolation** | ✅ | JWT + RBAC |

---

## Notas Importantes

1. **SERVICE_ROLE_KEY bypassa RLS**: Es intencional (administración). Pero backend DEBE validar.
2. **RLS Policies en Supabase**: Son para clientes en browser (anon key). Backend usa service role.
3. **Frontend**: Usa anon key + Supabase Auth (automático). Recibe RLS enforcement gratis.
4. **Backend**: Usa service role + manual RLS validation.
