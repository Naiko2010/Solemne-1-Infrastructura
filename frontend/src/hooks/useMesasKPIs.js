import { useState, useEffect, useCallback, useRef } from 'react'
import { apiRequest } from '../lib/apiClient'

const POLL_INTERVAL_MS = 30_000

export function useMesasKPIs(localId) {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  const fetchKpis = useCallback(async () => {
    if (!localId) return
    try {
      const data = await apiRequest(`/dashboard/mesas-kpis?local_id=${localId}`)
      setKpis(data)
      setError(null)
    } catch (err) {
      setError(err.message || 'Error al cargar KPIs de mesas')
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => {
    setLoading(true)
    fetchKpis()
    intervalRef.current = setInterval(fetchKpis, POLL_INTERVAL_MS)
    return () => clearInterval(intervalRef.current)
  }, [fetchKpis])

  return { kpis, loading, error, refresh: fetchKpis }
}
