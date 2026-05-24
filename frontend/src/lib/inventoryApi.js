import { apiRequest } from './apiClient'
import {
  getCachedCategories,
  mergeCategoryIntoCache,
  setCachedCategories,
} from './categoryCatalogCache'

export function getInventoryKpisByLocal(localId) {
  return apiRequest(`/inventory/kpis/${localId}`)
}

/**
 * @param {object} [filters]
 * @param {string} [filters.category] - UUID categoría
 * @param {string} [filters.search] - texto parcial nombre
 * @param {string[]} [filters.status] - uno o más: CRITICO, BAJO, OPTIMO
 * @param {number} [filters.limit] - paginación servidor (opcional)
 * @param {number} [filters.offset] - paginación servidor (opcional)
 */
export function buildInventoryStockListPath(localId, filters = {}) {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', String(filters.category))
  if (filters.search && String(filters.search).trim()) params.set('search', String(filters.search).trim())
  if (Array.isArray(filters.status) && filters.status.length) {
    for (const s of filters.status) {
      if (s) params.append('status', String(s).toUpperCase())
    }
  }
  if (filters.limit != null && Number.isFinite(Number(filters.limit))) {
    params.set('limit', String(Math.max(1, Math.min(500, Math.floor(Number(filters.limit))))))
  }
  if (filters.offset != null && Number.isFinite(Number(filters.offset)) && Number(filters.offset) > 0) {
    params.set('offset', String(Math.max(0, Math.floor(Number(filters.offset)))))
  }
  const qs = params.toString()
  return `/inventory/locals/${localId}/stock${qs ? `?${qs}` : ''}`
}

export function getInventoryStockList(localId, filters = {}) {
  return apiRequest(buildInventoryStockListPath(localId, filters))
}

/**
 * Listado paginado (HU-42 /products): body { items, total, limit, offset }.
 * @param {object} [filters]
 * @param {number} [filters.limit] default 50
 * @param {number} [filters.offset] default 0
 */
export function buildInventoryProductsPath(localId, filters = {}) {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', String(filters.category))
  if (filters.search && String(filters.search).trim()) params.set('search', String(filters.search).trim())
  if (Array.isArray(filters.status) && filters.status.length) {
    for (const s of filters.status) {
      if (s) params.append('status', String(s).toUpperCase())
    }
  }
  const limit = filters.limit != null ? Math.max(1, Math.min(500, Math.floor(Number(filters.limit)))) : 50
  const offset = filters.offset != null ? Math.max(0, Math.floor(Number(filters.offset))) : 0
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  return `/inventory/locals/${localId}/products?${params.toString()}`
}

export async function getInventoryProductsPage(localId, filters = {}) {
  const path = buildInventoryProductsPath(localId, filters)
  const data = await apiRequest(path)
  if (!data || typeof data !== 'object') {
    return { items: [], total: 0, limit: filters.limit ?? 50, offset: filters.offset ?? 0 }
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: Number(data.total) || 0,
    limit: Number(data.limit) || 50,
    offset: Number(data.offset) || 0,
  }
}

/**
 * Proveedores activos del negocio asociado al local.
 * @param {{ search?: string, category?: string }} [filters] - HU-85
 */
export function buildInventorySuppliersForLocalPath(localId, filters = {}) {
  const params = new URLSearchParams()
  if (filters.search && String(filters.search).trim()) {
    params.set('search', String(filters.search).trim())
  }
  if (filters.category && String(filters.category).trim()) {
    params.set('category', String(filters.category).trim())
  }
  const qs = params.toString()
  return `/inventory/locals/${localId}/suppliers${qs ? `?${qs}` : ''}`
}

export function getInventorySuppliersForLocal(localId, filters = {}) {
  return apiRequest(buildInventorySuppliersForLocalPath(localId, filters))
}

/** Local por id (incluye business_id). */
export function getLocalById(localId) {
  return apiRequest(`/locals/${localId}`)
}

/**
 * Listado de proveedores con métricas agregadas (HU-68): unidades en inventario y valor estimado (CLP).
 * GET /suppliers?business_id=
 * @param {{ search?: string, category?: string }} [filters] - HU-85: nombre y categoría (combinables)
 */
export function buildSuppliersWithMetricsPath(businessId, filters = {}) {
  const params = new URLSearchParams()
  params.set('business_id', String(businessId))
  if (filters.search && String(filters.search).trim()) {
    params.set('search', String(filters.search).trim())
  }
  if (filters.category && String(filters.category).trim()) {
    params.set('category', String(filters.category).trim())
  }
  return `/suppliers?${params.toString()}`
}

export function getSuppliersWithMetricsForBusiness(businessId, filters = {}) {
  return apiRequest(buildSuppliersWithMetricsPath(businessId, filters))
}

/**
 * Detalle de proveedor con KPIs y líneas de inventario (HU-69).
 * GET /suppliers/{supplier_id}?business_id=
 */
export function buildSupplierDetailPath(supplierId, businessId) {
  const params = new URLSearchParams()
  params.set('business_id', String(businessId))
  return `/suppliers/${encodeURIComponent(String(supplierId))}?${params.toString()}`
}

export function getSupplierDetailForBusiness(supplierId, businessId) {
  return apiRequest(buildSupplierDetailPath(supplierId, businessId))
}

/**
 * HU-84: histórico de compras por producto desde órdenes semanales (cantidades recibidas, totales CLP).
 * GET /suppliers/{supplier_id}/purchase-history?business_id=&week_from=&week_to=
 * @param {{ weekFrom?: string, weekTo?: string }} [opts] - lunes YYYY-MM-DD opcional
 */
export function buildSupplierPurchaseHistoryPath(supplierId, businessId, opts = {}) {
  const params = new URLSearchParams()
  params.set('business_id', String(businessId))
  if (opts.weekFrom && String(opts.weekFrom).trim()) {
    params.set('week_from', String(opts.weekFrom).trim())
  }
  if (opts.weekTo && String(opts.weekTo).trim()) {
    params.set('week_to', String(opts.weekTo).trim())
  }
  return `/suppliers/${encodeURIComponent(String(supplierId))}/purchase-history?${params.toString()}`
}

export function getSupplierPurchaseHistoryForBusiness(supplierId, businessId, opts = {}) {
  return apiRequest(buildSupplierPurchaseHistoryPath(supplierId, businessId, opts))
}

/**
 * Crea un proveedor en el negocio. `business_id` opcional: el backend usa el del usuario si es admin.
 * Alta rápida: `{ name }`. Registro completo (HU-86): también `rut`, `address`, `category`, `contact_name`, `phone`, `email`.
 * @param {object} body
 */
export function postSupplier(body) {
  return apiRequest('/suppliers', { method: 'POST', body })
}

/** HU-34: condiciones comerciales y datos de proveedor (PATCH parcial). */
export function patchSupplier(supplierId, businessId, body) {
  const params = new URLSearchParams()
  params.set('business_id', String(businessId))
  return apiRequest(`/suppliers/${encodeURIComponent(String(supplierId))}?${params.toString()}`, {
    method: 'PATCH',
    body,
  })
}

/**
 * KPIs de proveedores y compras (insumos aprobados) por mes. Requiere Admin/Superadmin.
 * @param {string} localId - UUID del local (el backend resuelve el negocio).
 * @param {{ year?: number, month?: number }} [opts] - mes calendario; por defecto mes actual en servidor.
 */
export function buildSupplierKpisPath(localId, opts = {}) {
  const params = new URLSearchParams()
  params.set('local_id', String(localId))
  if (opts.year != null && Number.isFinite(Number(opts.year))) params.set('year', String(Math.floor(Number(opts.year))))
  if (opts.month != null && Number.isFinite(Number(opts.month))) {
    const m = Math.min(12, Math.max(1, Math.floor(Number(opts.month))))
    params.set('month', String(m))
  }
  return `/suppliers/kpis?${params.toString()}`
}

export function getSupplierKpisByLocal(localId, opts = {}) {
  return apiRequest(buildSupplierKpisPath(localId, opts))
}

/** GET /categories?local_id= — listado del local (HU-87). */
export function buildCategoriesListPath(localId) {
  const params = new URLSearchParams()
  params.set('local_id', String(localId))
  return `/categories?${params.toString()}`
}

export function getCategoriesForLocal(localId) {
  return apiRequest(buildCategoriesListPath(localId))
}

/** Lista categorías usando caché en memoria (HU-87). */
export async function loadCategoriesForLocalCached(localId) {
  const cached = getCachedCategories(localId)
  if (cached) return cached
  const data = await getCategoriesForLocal(localId)
  const rows = Array.isArray(data) ? data : []
  setCachedCategories(localId, rows)
  return rows
}

/** POST /categories — ADMIN+; body { local_id, name, is_active }. */
export function postCategory(body) {
  return apiRequest('/categories', { method: 'POST', body })
}

/**
 * Resuelve el nombre canónico: reutiliza categoría existente (comparación sin distinguir mayúsculas)
 * o crea una nueva vía POST y actualiza la caché (HU-87).
 */
export async function resolveCategoryNameForLocal(localId, rawName) {
  const trimmed = String(rawName || '').trim()
  if (!trimmed) {
    throw new Error('Indica una categoría.')
  }

  let rows = getCachedCategories(localId)
  if (!rows) {
    const data = await getCategoriesForLocal(localId)
    rows = Array.isArray(data) ? data : []
    setCachedCategories(localId, rows)
  }

  const hit = rows.find((r) => String(r.name || '').toLowerCase() === trimmed.toLowerCase())
  if (hit) {
    return String(hit.name).trim()
  }

  const created = await postCategory({
    local_id: localId,
    name: trimmed,
    is_active: true,
  })
  const row = created && typeof created === 'object' ? created : null
  if (row?.id != null && row?.name != null) {
    mergeCategoryIntoCache(localId, row)
    return String(row.name).trim()
  }
  mergeCategoryIntoCache(localId, { id: row?.id, name: trimmed, is_active: true })
  return trimmed
}

export function postInventoryNewProduct(localId, body) {
  return apiRequest(`/inventory/locals/${localId}/new-product`, {
    method: 'POST',
    body,
  })
}

/** Actualiza stock o mínimo; la API devuelve la fila con total_value recalculado (stock × costo). */
export function patchInventoryStock(localId, inventoryId, body) {
  return apiRequest(`/inventory/locals/${localId}/stock/${inventoryId}`, {
    method: 'PATCH',
    body,
  })
}

/** Actualiza costo unitario (products.price); respuesta con total_value recalculado. */
export function patchInventoryProductUnitCost(localId, productId, body) {
  return apiRequest(`/inventory/locals/${localId}/products/${productId}/unit-cost`, {
    method: 'PATCH',
    body,
  })
}

/** Elimina el registro de inventario y el producto asociado del local. */
export function deleteInventoryItem(localId, inventoryId) {
  return apiRequest(`/inventory/locals/${localId}/stock/${inventoryId}`, {
    method: 'DELETE',
  })
}

/** Elimina un proveedor del negocio (nullifica supplier_id en productos asociados). */
export function deleteSupplier(supplierId, businessId) {
  const params = new URLSearchParams()
  params.set('business_id', String(businessId))
  return apiRequest(`/suppliers/${encodeURIComponent(String(supplierId))}?${params.toString()}`, {
    method: 'DELETE',
  })
}
