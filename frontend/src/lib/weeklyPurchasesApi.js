import { apiRequest } from './apiClient'

/**
 * HU-34: órdenes de compra semanales a proveedores.
 * @param {{ week_start?: string, supplier_id?: string, status?: string }} [filters]
 */
export function getWeeklyPurchaseOrders(businessId, filters = {}) {
  const params = new URLSearchParams()
  params.set('business_id', String(businessId))
  if (filters.week_start) params.set('week_start', String(filters.week_start))
  if (filters.supplier_id) params.set('supplier_id', String(filters.supplier_id))
  if (filters.status) params.set('status', String(filters.status))
  return apiRequest(`/weekly-purchase-orders?${params.toString()}`)
}

export function getWeeklyPurchaseOrder(orderId, businessId) {
  const params = new URLSearchParams({ business_id: String(businessId) })
  return apiRequest(`/weekly-purchase-orders/${encodeURIComponent(orderId)}?${params}`)
}

export function postWeeklyPurchaseOrder(body) {
  return apiRequest('/weekly-purchase-orders', { method: 'POST', body })
}

export function patchWeeklyPurchaseOrder(orderId, businessId, body) {
  const params = new URLSearchParams({ business_id: String(businessId) })
  return apiRequest(`/weekly-purchase-orders/${encodeURIComponent(orderId)}?${params}`, { method: 'PATCH', body })
}

export function putWeeklyPurchaseOrderItems(orderId, businessId, items) {
  const params = new URLSearchParams({ business_id: String(businessId) })
  return apiRequest(`/weekly-purchase-orders/${encodeURIComponent(orderId)}/items?${params}`, {
    method: 'PUT',
    body: { items },
  })
}

export function patchWeeklyPurchaseLineReception(orderId, itemId, businessId, quantity_received) {
  const params = new URLSearchParams({ business_id: String(businessId) })
  return apiRequest(
    `/weekly-purchase-orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/reception?${params}`,
    { method: 'PATCH', body: { quantity_received } },
  )
}

export function deleteWeeklyPurchaseOrder(orderId, businessId) {
  const params = new URLSearchParams({ business_id: String(businessId) })
  return apiRequest(`/weekly-purchase-orders/${encodeURIComponent(orderId)}?${params}`, { method: 'DELETE' })
}

export function getWeeklyPurchaseComparisonReport(businessId, week_from, week_to) {
  const params = new URLSearchParams({
    business_id: String(businessId),
    week_from: String(week_from),
    week_to: String(week_to),
  })
  return apiRequest(`/weekly-purchase-orders/reports/comparison?${params.toString()}`)
}
