/**
 * Cliente API para el módulo de alertas administrativas.
 * Cubre listado, conteo, evaluación automática y resolución de alertas.
 */

import { apiRequest } from './apiClient'

function withQuery(path, params) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })
  const qs = query.toString()
  return qs ? `${path}?${qs}` : path
}

/** Listar alertas de un local. status: 'pending' | 'resolved' | undefined */
export function getAlerts(localId, token, alertStatus) {
  const path = withQuery('/alerts', { local_id: localId, status: alertStatus })
  return apiRequest(path, { token })
}

/** Conteo rápido de alertas pendientes (para badge del header). */
export function getAlertsCount(localId, token) {
  const path = withQuery('/alerts/count', { local_id: localId })
  return apiRequest(path, { token })
}

/** Ejecutar el motor de reglas del backend para un local y generar alertas si aplica. */
export function evaluateAlerts(localId, token) {
  const path = withQuery('/alerts/evaluate', { local_id: localId })
  return apiRequest(path, { method: 'POST', token })
}

/** Crear alerta manualmente (admin). */
export function createAlert(body, token) {
  return apiRequest('/alerts', { method: 'POST', body, token })
}

/** Marcar una alerta como resuelta (cambia status pending → resolved). */
export function resolveAlert(alertId, token) {
  return apiRequest(`/alerts/${alertId}/resolve`, { method: 'PATCH', token })
}
