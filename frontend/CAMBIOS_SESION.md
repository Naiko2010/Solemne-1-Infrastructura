# Registro de Cambios — SibaGestión

**Fecha:** 2026-05-20  
**Repositorios afectados:**
- `Delivery-Custom-App-INGSW2` (Backend — FastAPI + Supabase)
- `Delivery-Custom-App-INGSW2-FRONTEND` (Frontend — React 19 + Vite + Tailwind v4)

---

## Contexto general

Esta sesión de trabajo abordó una serie de bugs reportados y mejoras solicitadas sobre los módulos de **Gestión de Mesas (POS)**, **Inventario** y **Proveedores**. A continuación se documenta cada cambio con su causa raíz, la solución implementada y los archivos involucrados.

---

## 1. Creación de mesas — Error 500 PGRST204

### Problema
Al intentar crear una nueva mesa desde el modal "+ Nueva Mesa", el servidor devolvía:

```
500: Database error: {
  "message": "Could not find the 'numero' column of 'mesas' in the schema cache",
  "code": "PGRST204"
}
```

El esquema Pydantic `MesaCreate` tenía definidos los campos `numero: Optional[int] = None` y `state: Optional[str] = Field("libre", ...)`. Al usar `model_dump(mode="json", exclude_none=True)` para construir el insert, el campo `state: "libre"` (no nulo) se incluía en el payload enviado a Supabase, pero la tabla `mesas` no tiene esa columna, lo que causaba el error del schema cache de PostgREST.

### Solución
En `src/api/routes/mesas.py`, se reemplazó el uso genérico de `model_dump()` por un diccionario explícito que solo contiene las columnas que efectivamente existen en la tabla:

```python
insert_data = {
    "local_id": str(mesa.local_id),
    "name": mesa.name,
    "capacidad": mesa.capacidad,
    "zona": mesa.zona,
    "is_delivery": mesa.is_delivery,
    "is_active": mesa.is_active,
}
response = db.table("mesas").insert(insert_data).execute()
```

### Por qué esto importa
Usar `model_dump()` directamente contra Supabase/PostgREST es frágil: si el schema Pydantic tiene más campos que la tabla real (por desfase entre migraciones o campos opcionales no aplicados), la inserción falla. La práctica correcta es siempre mapear explícitamente los campos esperados por la DB.

**Archivo:** `Delivery-Custom-App-INGSW2/src/api/routes/mesas.py`

---

## 2. Modal "+ Nueva Mesa" — Tamaño insuficiente

### Problema
El modal de creación de mesa era demasiado pequeño (`max-w-md`), lo que hacía que el contenido interno se viera apretado.

### Solución
Cambiado a `max-w-lg` en el componente.

**Archivo:** `Delivery-Custom-App-INGSW2-FRONTEND/src/components/pos/CreateMesaModal.jsx`

---

## 3. Modal de edición de producto en inventario — Reestructuración de campos

### Problema
El modal de edición de una fila de inventario solo permitía editar "Stock actual", que no es el campo más útil para gestión diaria. Además no había forma de eliminar un producto desde ese modal.

### Solución

**Backend:**

1. **`src/schemas/__init__.py`** — Se agregó `max_stock: Optional[int] = Field(None, ge=0)` al schema `InventoryUpdate`, permitiendo que el frontend envíe el valor de stock máximo en el PATCH.

2. **`src/services/inventory_stock_service.py`** — Se agregó el helper `_set_stock_max_in_description(description, max_stock)`.

   > **Nota técnica importante:** `stock_max` no existe como columna en la tabla `inventory` ni en `products`. El valor se almacena como texto dentro de `products.description` con el formato `"Stock máximo: N"`, y se extrae en lectura mediante la expresión regular `r"Stock\s+m[aá]ximo:\s*(\d+)"`. El helper reemplaza o inserta esa línea en el texto de descripción existente sin destruir el resto del contenido.

   También se extendió `update_inventory_stock_for_local()` con el parámetro opcional `max_stock: int | None`. Cuando se provee, el servicio consulta la descripción actual del producto y la actualiza con el helper.

3. **`src/api/routes/inventory_stock.py`**:
   - La ruta `PATCH /inventory/locals/{local_id}/stock/{inventory_id}` ahora pasa `max_stock` al servicio.
   - Se agregó el endpoint `DELETE /inventory/locals/{local_id}/stock/{inventory_id}` (HTTP 204). Usa el cliente service role de Supabase (cuando está disponible) para saltarse las políticas RLS y eliminar primero la fila de `inventory` y luego el registro del producto en `products`. La eliminación del producto es best-effort (no falla si ya fue eliminado).

**Frontend:**

4. **`src/lib/inventoryApi.js`** — Nueva función `deleteInventoryItem(localId, inventoryId)` que llama a `DELETE /inventory/locals/{localId}/stock/{inventoryId}`.

5. **`src/components/inventory/ProductsTable.jsx`**:
   - El modal de edición ahora expone tres campos en este orden: **Stock Máximo**, **Stock Mínimo**, **Costo Unitario** (unidad CLP). Cada campo tiene descripción explicativa debajo.
   - Los estados del draft cambiaron de `stockDraft` a `maxStockDraft` y `minStockDraft`.
   - Al abrir el modal (`openEditModal`), se pre-cargan los valores actuales de `stock_max` y `stock_min` de la fila.
   - El footer tiene tres botones en orden: **Guardar cambios** → **Eliminar** → **Cancelar**. El botón Eliminar muestra una confirmación inline (sin dialog externo) antes de ejecutar la acción.
   - Nueva prop `onDeleteItem` para delegar la lógica de eliminación al componente padre.

6. **`src/components/inventory/StockControlDashboard.jsx`** — Se agregó `handleDeleteItem`, que llama a `deleteInventoryItem`, recarga los KPIs y la lista de ítems, y resetea la paginación a la página 1. Se pasa como `onDeleteItem` a `ProductsTable`.

---

## 4. Modal de detalle de proveedor — Rediseño de layout

### Problema
El modal de detalle de proveedor tenía la barra de scroll lateral visible (mala estética), el contenido interno se veía muy apretado o mal espaciado, y los productos vinculados al proveedor no aparecían aunque existían (bug de filtrado).

### Solución

**Bug de productos:** En `src/services/supplier_service.py`, la función `get_supplier_detail_for_business` tenía la condición `if qty > 0` al construir la lista de productos. Esto significaba que los productos con stock en cero eran ignorados aunque estuvieran vinculados al proveedor. Se eliminó esa condición: ahora todos los productos con `supplier_id` coincidente aparecen en el detalle, independientemente de su stock actual.

**Rediseño del modal** en `src/components/inventory/SupplierDetailModal.jsx`:
- `DialogContent` es ahora `max-w-2xl`, layout flexbox columna, `overflow-hidden`, sin padding raíz (`p-0`), altura máxima `min(92vh, 820px)`.
- **Header sticky** con `border-b` en la parte superior.
- **Cuerpo scrolleable** con la clase `no-scrollbar` (la barra de scroll nativa queda oculta pero el scroll con rueda del mouse sigue funcionando). Ver punto 7 para el detalle de esta utilidad CSS.
- **Footer sticky** con `border-t` en la parte inferior.
- Espaciado interno mejorado: `gap-6` entre secciones, `gap-x-8 gap-y-4` en grillas de datos, tarjetas KPI con fondo blanco, borde y `rounded-xl`.

**Archivos:**
- `Delivery-Custom-App-INGSW2/src/services/supplier_service.py`
- `Delivery-Custom-App-INGSW2-FRONTEND/src/components/inventory/SupplierDetailModal.jsx`

---

## 5. Selector de año en Proveedores — Solo mostraba 2026

### Problema
El selector de año/mes del encabezado de la sección Proveedores (usado para filtrar los KPIs por período) solo mostraba el año actual (2026), sin importar que algún proveedor tuviera relación con el negocio desde años anteriores.

### Solución (implementación actual — ver también Sección 16)
El cálculo de `availableYears` en `SuppliersKpisDashboard.jsx` muestra siempre los **últimos 5 años** como base (independiente de la BD), más cualquier año detectado en `start_date` de proveedores:

```js
for (let y = CURRENT_YEAR - 4; y <= CURRENT_YEAR; y++) set.add(y)
for (const row of suppliersRows) {
  const y = new Date(row.start_date).getFullYear()
  if (Number.isFinite(y) && y > 1900 && y <= CURRENT_YEAR) set.add(y)
}
```

Devuelve el array ordenado **ascendente**. Requiere que la columna `start_date` exista en la BD (ver Sección 16).

**Archivo:** `Delivery-Custom-App-INGSW2-FRONTEND/src/components/inventory/SuppliersKpisDashboard.jsx`

También se corrigió el orden en `ModernDateField.jsx` (selector de fecha en formularios), que ahora genera años desde 1960 en adelante de forma ascendente.

**Archivo:** `Delivery-Custom-App-INGSW2-FRONTEND/src/components/inventory/ModernDateField.jsx`

---

## 6. Listado de proveedores — Nuevas acciones por fila

### Problema
El listado de proveedores solo tenía un botón "Ver detalle →" por fila. No había forma de deshabilitar un proveedor ni de eliminarlo desde la interfaz.

### Solución

**Backend:**

1. **`src/schemas/__init__.py`** — Se agregó `is_active: Optional[bool] = None` a `SupplierPatchBody`.

2. **`src/services/supplier_service.py`** — `patch_supplier_for_business` ahora acepta y aplica el campo `is_active` del payload: `update_row["is_active"] = bool(payload["is_active"])`.

3. **`src/api/routes/suppliers.py`**:
   - `GET /suppliers`: cambiado a `active_only=False` para que los proveedores inactivos sigan apareciendo en el listado (con indicador visual de inactivo). Antes desaparecían al deshabilitarlos.
   - Nuevo endpoint `DELETE /suppliers/{supplier_id}?business_id=` (HTTP 204): comportamiento inicial con cascade real implementado en Sección 8 (ver abajo).

4. **`src/lib/inventoryApi.js`** — Nueva función `deleteSupplier(supplierId, businessId)`.
5. **`src/lib/providersApi.js`** — Re-exportado `deleteSupplier`.

**Frontend** (`src/components/inventory/SuppliersKpisDashboard.jsx`):

- La última celda de cada fila ahora muestra **tres iconos de acción**:

  | Icono | Acción | Color |
  |-------|--------|-------|
  | `Eye` | Abre el modal de detalle del proveedor | Azul primario |
  | `Power` | Alterna activo/inactivo | Ámbar (deshabilitar) / Esmeralda (habilitar) |
  | `Trash2` | Abre confirmación inline de eliminación | Rojo |

- **Confirmación de eliminación inline:** Al hacer clic en `Trash2`, la fila muestra "¿Eliminar? / Sí / No" en lugar de los iconos. Esto evita diálogos externos y mantiene el contexto visual.

- **Actualización optimista para toggle activo/inactivo:** El estado local se actualiza de inmediato antes de que el servidor responda. Si la llamada API falla, el estado se revierte automáticamente al valor anterior.

- **Filas inactivas:** Se distinguen visualmente con:
  - Fondo atenuado (`bg-[hsl(var(--muted)/0.25)]`)
  - `opacity-60` en toda la fila
  - Avatar en gris en lugar del color asignado
  - Texto del nombre en color muted
  - Badge "Inactivo" en gris en lugar de "Activo" en verde

---

## 7. Utilidad CSS `no-scrollbar`

### Problema
En Tailwind v4 la sintaxis `@layer utilities` con pseudo-elementos dejó de funcionar correctamente para algunos casos. La clase `scrollbar-hide` de plugins externos no estaba disponible.

### Solución
Se registró una utilidad propia con la nueva sintaxis de Tailwind v4:

```css
/* src/index.css */
@utility no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
```

Aplicar `no-scrollbar` a cualquier elemento con `overflow-y-auto` oculta la barra de scroll nativa del navegador (Chrome, Firefox, Safari, Edge) manteniendo el scroll funcional con la rueda del mouse o gestos táctiles.

**Archivo:** `Delivery-Custom-App-INGSW2-FRONTEND/src/index.css`

---

## 8. Eliminación de proveedor — Cascade real (inventario + productos)

### Problema
Al eliminar un proveedor, el endpoint anterior solo hacía `UPDATE products SET supplier_id = NULL` (nullificaba la referencia), dejando los productos y su inventario huérfanos en la BD.

### Solución
`DELETE /suppliers/{supplier_id}` en `src/api/routes/suppliers.py` ahora:
1. Obtiene todos los `product_id` vinculados al proveedor.
2. Elimina las filas de `inventory` correspondientes a esos productos (chunked, 100 a la vez).
3. Elimina los registros de `products` (chunked).
4. Elimina el proveedor.

Usa el cliente service role para bypassear RLS en todos los pasos. Cada paso de eliminación de productos/inventario es best-effort con log de warning si falla, para no bloquear la eliminación del proveedor.

**Archivo:** `Delivery-Custom-App-INGSW2/src/api/routes/suppliers.py`

---

## 9. Modal detalle proveedor — Eliminación del botón "Cerrar" inferior

### Cambio
Se eliminó el bloque `<DialogFooter>` completo del modal (y su import). El modal se cierra únicamente con la X del encabezado o haciendo clic fuera del contenido. Evita duplicidad con el botón de cierre nativo del Dialog.

**Archivo:** `Delivery-Custom-App-INGSW2-FRONTEND/src/components/inventory/SupplierDetailModal.jsx`

---

## 10. Tabla de productos — Grupos expandibles por nombre

### Problema
Si un mismo producto (e.g., "Tomate") tenía dos proveedores distintos, aparecía como dos filas independientes sin agrupación visual. No era posible distinguir que eran variantes del mismo producto.

### Solución
`ProductsTable.jsx` agrupa las filas cliente-side usando un `Map` por `product_name.toLowerCase()`:

- **Grupo con 1 proveedor:** se renderiza como fila plana (sin cambio visual).
- **Grupo con ≥2 proveedores:** se renderiza como fila de cabecera colapsable con:
  - Ícono `ChevronRight` / `ChevronDown`
  - Stock agregado y valor total sumado
  - Badge "N proveedores"
  - Al expandir, sub-filas con fondo `bg-muted/0.15` y prefijo `└` en el nombre.

El set de grupos expandidos (`expandedGroups`) se resetea al cambiar la lista de ítems (filtros o paginación).

**Archivo:** `Delivery-Custom-App-INGSW2-FRONTEND/src/components/inventory/ProductsTable.jsx`

---

## 11. Tabla de productos — Sin scroll horizontal y columnas estáticas

### Cambios
- Eliminado `overflow-x-auto` del contenedor de la tabla.
- Tabla con `table-fixed text-xs` y anchos de columna en porcentajes (`w-[14%]`, `w-[10%]`, etc.) para que quepa completa sin scrollbar horizontal.
- Eliminados los íconos de ordenamiento (`ArrowUpDown`, etc.) de todos los encabezados. La tabla es estática.

**Archivo:** `Delivery-Custom-App-INGSW2-FRONTEND/src/components/inventory/ProductsTable.jsx`

---

## 12. KPI cards de Stock — "Valor total" no clickeable

### Problema
Las tarjetas de KPI (Stock óptimo, Stock bajo, Stock crítico) deben actuar como filtros al hacer clic. "Valor total" no debería ser clickeable ni animarse.

### Solución
Se agregó la propiedad `noClick: true` a la definición del KPI "Valor total". El render comprueba `isClickable = !kpi.noClick` y condicionalmente aplica `cursor-pointer`, `whileHover`, `whileTap` y `onClick`.

**Archivo:** `Delivery-Custom-App-INGSW2-FRONTEND/src/components/inventory/StockControlDashboard.jsx`

---

## 13. Filtro de estado — Bug crítico: nunca se aplicaba

### Causa raíz
El frontend enviaba `?status=BAJO` en la URL, pero el backend declaraba el parámetro como `status_filter` (sin alias). FastAPI exponía el parámetro como `?status_filter=BAJO`, por lo que el filtro nunca llegaba al servicio y siempre se retornaban todos los productos.

### Solución
En ambos endpoints (`/inventory/locals/{local_id}/stock` y `/inventory/locals/{local_id}/products`) se cambió la declaración del parámetro:

```python
status_filter: Annotated[list[str], Query(alias="status", description="...")] = []
```

El alias `"status"` hace que FastAPI acepte `?status=BAJO` en la URL, mientras la variable Python sigue llamándose `status_filter` para no colisionar con `from fastapi import status` (el módulo de códigos HTTP).

**Archivo:** `Delivery-Custom-App-INGSW2/src/api/routes/inventory_stock.py`

---

## 14. Estado vacío de tabla — Mensaje contextual según filtro activo

### Problema
Al seleccionar "Stock crítico" y no haber productos en ese estado, la tabla mostraba "No hay productos registrados en este local. Crea el primer producto…" aunque sí hubiera productos (solo que ninguno era crítico).

### Solución
`ProductsTable` recibe ahora la prop `statusFilters: []`. En el estado vacío:

- Si `statusFilters.length > 0`: muestra **"Usted no cuenta con productos con estado [crítico/bajo/óptimo]."**
- Si `statusFilters.length === 0`: muestra el mensaje original con botón de creación.

Mapa de etiquetas: `{ OPTIMO: 'óptimo', BAJO: 'bajo', CRITICO: 'crítico' }`.

`StockControlDashboard` pasa `statusFilters={statusFilters}` a `ProductsTable`.

**Archivos:**
- `Delivery-Custom-App-INGSW2-FRONTEND/src/components/inventory/ProductsTable.jsx`
- `Delivery-Custom-App-INGSW2-FRONTEND/src/components/inventory/StockControlDashboard.jsx`

---

## 15. Compras semanales — Selector de productos multi-select

### Problema
Al hacer clic en "Agregar producto" dentro del modal de nueva orden semanal, se agregaba un producto a la vez mediante un botón "+ Agregar" individual por fila. No había forma eficiente de seleccionar varios productos a la vez.

### Solución
El picker fue rediseñado como lista multi-select con checkboxes:

- **Campo de búsqueda** dentro del panel (aparece si hay más de 4 productos disponibles).
- **Fila "Seleccionar todos"** (aparece si hay más de 1 producto filtrado).
- **Filas con checkbox:** al seleccionar, el fondo cambia a `primary/0.07`.
- **Footer con contador** ("N productos seleccionados") y botón **"Agregar seleccionados"** (deshabilitado si ninguno está marcado).
- Al confirmar, todos los productos seleccionados se agregan a `lines` de una sola vez y el panel se cierra.

Estados nuevos: `pickerSelected: Set<productId>`, `pickerSearch: string`.
`pickerFilteredProducts` es un `useMemo` que filtra `unaddedProducts` por `pickerSearch`.

**Archivo:** `Delivery-Custom-App-INGSW2-FRONTEND/src/components/inventory/weeklyPurchases/WeeklyPurchasesPage.jsx`

---

## 16. Proveedores — Columna `start_date` y selector de año

### Columna en BD
Nueva columna `start_date date` en `public.suppliers` para registrar el año real de inicio de la relación comercial. Migración idempotente:

```sql
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS start_date date;
```

**Archivo:** `Delivery-Custom-App-INGSW2/migrations/suppliers_start_date.sql`

### Backend
- `SupplierCreate` y `SupplierResponse` en `src/schemas/__init__.py`: campo `start_date: Optional[str] = None`.
- `create_supplier` en `src/services/supplier_service.py`: inserta `start_date` cuando viene en el payload.
- `RegisterSupplierModal.jsx`: ya tenía el campo "Fecha desde (histórico proveedor)" y fallback silencioso si la columna no existía. Una vez aplicada la migración, el campo se persiste correctamente.

### Selector de año
Ver Sección 5 para la implementación actualizada de `availableYears`. El rango base de 5 años garantiza que el selector funcione aunque los proveedores existentes no tengan `start_date` configurado.

**Archivos:**
- `Delivery-Custom-App-INGSW2/src/schemas/__init__.py`
- `Delivery-Custom-App-INGSW2/src/services/supplier_service.py`
- `Delivery-Custom-App-INGSW2-FRONTEND/src/components/inventory/SuppliersKpisDashboard.jsx`
- `Delivery-Custom-App-INGSW2-FRONTEND/src/components/inventory/RegisterSupplierModal.jsx`

---

## Notas de seguridad y arquitectura

### Service Role Key — nunca en el frontend
`SUPABASE_SERVICE_ROLE_KEY` está configurada **solo en el backend**. Si se incluyera en las variables de entorno de Vite, quedaría expuesta en el bundle JavaScript del navegador, comprometiendo la seguridad de toda la base de datos. Todas las operaciones privilegiadas (bypass de RLS para DELETE) pasan exclusivamente por el servidor FastAPI.

### Patrón: service role con fallback
```python
del_db = get_supabase_client() if is_service_role_configured() else db
```
Si en el entorno de desarrollo no está configurada la service role key, se usa el cliente normal (con RLS activo). En producción, la service role key debe estar configurada para que las operaciones de eliminación funcionen correctamente.

### `stock_max` — almacenado como texto en `description`
La columna `stock_max` no existe en las tablas `inventory` ni `products` de la base de datos. El valor se persiste como texto dentro del campo `products.description` con el formato `Stock máximo: N`. Se extrae con la regex `r"Stock\s+m[aá]ximo:\s*(\d+)"` y se escribe con el helper `_set_stock_max_in_description()`. Si en el futuro se agrega `stock_max` como columna real en la DB, este helper deberá migrarse.

---

## Resumen de archivos modificados

### Backend (`Delivery-Custom-App-INGSW2`)

| Archivo | Tipo de cambio |
|---------|---------------|
| `src/api/routes/mesas.py` | Bug fix — insert explícito sin columnas fantasma |
| `src/schemas/__init__.py` | Extensión — `max_stock`, `is_active`, `start_date` en schemas |
| `src/services/inventory_stock_service.py` | Feature — edición de `stock_max` vía descripción |
| `src/api/routes/inventory_stock.py` | Bug fix + Feature — alias `?status`, soporte `max_stock`, DELETE endpoint |
| `src/services/supplier_service.py` | Bug fix + Feature — productos con stock 0, toggle `is_active`, `start_date` |
| `src/api/routes/suppliers.py` | Feature — listado con inactivos, DELETE cascade (inventario + productos) |
| `migrations/suppliers_start_date.sql` | Migración — nueva columna `start_date date` en `suppliers` |

### Frontend (`Delivery-Custom-App-INGSW2-FRONTEND`)

| Archivo | Tipo de cambio |
|---------|---------------|
| `src/index.css` | Utilidad — `no-scrollbar` para Tailwind v4 |
| `src/lib/inventoryApi.js` | Feature — `deleteInventoryItem`, `deleteSupplier` |
| `src/lib/providersApi.js` | Re-export — `deleteSupplier` |
| `src/components/pos/CreateMesaModal.jsx` | UI — modal más ancho |
| `src/components/inventory/ModernDateField.jsx` | UI — años en orden ascendente desde 1960 |
| `src/components/inventory/ProductsTable.jsx` | Feature — grupos expandibles, tabla estática, estado vacío contextual, botón Eliminar |
| `src/components/inventory/StockControlDashboard.jsx` | Feature — `handleDeleteItem`, `noClick` en KPI "Valor total", prop `statusFilters` |
| `src/components/inventory/SupplierDetailModal.jsx` | UI — rediseño layout + eliminación botón cerrar inferior |
| `src/components/inventory/SuppliersKpisDashboard.jsx` | Feature — iconos de acción, filas inactivas, selector de año con rango base 5 años |
| `src/components/inventory/RegisterSupplierModal.jsx` | Feature — campo `start_date` con fallback silencioso |
| `src/components/inventory/weeklyPurchases/WeeklyPurchasesPage.jsx` | Feature — picker multi-select con checkboxes para productos del pedido |
