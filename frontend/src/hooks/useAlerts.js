/**
 * Hook de alertas administrativas con SSE + fallback a polling.
 * Expone el listado, conteo de pendientes, y acciones de resolución y evaluación.
 *
 * Estrategia de live updates:
 *   1. Abre EventSource con token en query param (EventSource no soporta headers).
 *   2. Si SSE falla o no está disponible → polling cada POLL_INTERVAL_MS.
 *   3. Al resolver o evaluar → refresca inmediatamente.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthContext } from '../lib/apiClient'
import {
  evaluateAlerts as apiEvaluateAlerts,
  getAlerts,
  resolveAlert as apiResolveAlert,
} from '../lib/alertsApi'

const POLL_INTERVAL_MS = 30_000
const SSE_RETRY_MS = 5_000
const API_BASE = import.meta.env.VITE_API_URL || ''

export function useAlerts(localId) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)

  const tokenRef = useRef(null)
  const sseRef = useRef(null)
  const pollRef = useRef(null)
  const mounted = useRef(true)

  // ── Fetch list ──────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    if (!localId) return
    try {
      const { token } = await getAuthContext()
      tokenRef.current = token
      const data = await getAlerts(localId, token)
      if (!mounted.current) return
      setAlerts(data || [])
      setPendingCount((data || []).filter((a) => a.status === 'pending').length)
      setError(null)
    } catch (err) {
      if (mounted.current) setError(err.message)
    }
  }, [localId])

  // ── SSE connection ──────────────────────────────────────────
  const openSSE = useCallback(() => {
    if (!localId || !tokenRef.current || !window.EventSource) return

    const url = `${API_BASE}/api/alerts/stream?local_id=${localId}&token=${encodeURIComponent(tokenRef.current)}`
    const es = new EventSource(url)
    sseRef.current = es

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data)
        if (payload.pending !== undefined && mounted.current) {
          setPendingCount(payload.pending)
          // Si cambió el conteo, refresca la lista completa
          fetchAlerts()
        }
      } catch {
        // JSON parse error — ignorar
      }
    }

    es.onerror = () => {
      es.close()
      sseRef.current = null
      // Fallback: reintentar SSE después de un delay
      setTimeout(() => {
        if (mounted.current) openSSE()
      }, SSE_RETRY_MS)
    }
  }, [localId, fetchAlerts])

  // ── Polling fallback ────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(fetchAlerts, POLL_INTERVAL_MS)
  }, [fetchAlerts])

  // ── Bootstrap ───────────────────────────────────────────────
  useEffect(() => {
    mounted.current = true
    if (!localId) return

    setLoading(true)
    fetchAlerts().finally(() => {
      if (mounted.current) {
        setLoading(false)
        openSSE()
        startPolling()
      }
    })

    return () => {
      mounted.current = false
      sseRef.current?.close()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [localId, fetchAlerts, openSSE, startPolling])

  // ── Actions ─────────────────────────────────────────────────
  const resolveAlert = useCallback(async (alertId) => {
    const { token } = await getAuthContext()
    await apiResolveAlert(alertId, token)
    await fetchAlerts()
  }, [fetchAlerts])

  const evaluateAlerts = useCallback(async () => {
    const { token } = await getAuthContext()
    const result = await apiEvaluateAlerts(localId, token)
    await fetchAlerts()
    return result
  }, [localId, fetchAlerts])

  return { alerts, loading, error, pendingCount, resolveAlert, evaluateAlerts, refresh: fetchAlerts }
}
