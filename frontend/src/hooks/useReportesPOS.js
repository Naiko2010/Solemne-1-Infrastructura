import { useState, useCallback } from 'react'
import { apiRequest } from '../lib/apiClient'

/**
 * Reportes básicos del POS.
 * Lazy — solo carga cuando se llama a `fetch()`.
 */
export function useReportesPOS(localId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!localId) return
    try {
      setLoading(true)
      setError(null)
      const result = await apiRequest(`/dashboard/pos-reportes?local_id=${localId}`)
      setData(result)
    } catch (err) {
      setError(err.message || 'Error al cargar reportes')
    } finally {
      setLoading(false)
    }
  }, [localId])

  return { data, loading, error, fetch }
}
