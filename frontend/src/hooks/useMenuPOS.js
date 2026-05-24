import { useState, useCallback } from 'react'
import { apiRequest } from '../lib/apiClient'

/**
 * Menú del local vía `/dashboard/menu`; búsqueda opcional con `?search=`.
 * Solo carga cuando se llama a `fetch()`.
 */
export function useMenuPOS(localId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async ({ search: searchTerm } = {}) => {
    if (!localId) return
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ local_id: String(localId) })
      if (searchTerm != null && String(searchTerm).trim()) {
        params.set('search', String(searchTerm).trim())
      }
      const result = await apiRequest(`/dashboard/menu?${params}`)
      setData(result)
    } catch (err) {
      setError(err.message || 'Error al cargar el menú')
    } finally {
      setLoading(false)
    }
  }, [localId])

  return { data, loading, error, fetch }
}
