import { useState, useEffect, useCallback } from 'react'
import { apiRequest } from '../lib/apiClient'

export function useMesas(localId) {
  const [mesas, setMesas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMesas = useCallback(async () => {
    if (!localId) return
    try {
      const data = await apiRequest(`/mesas?local_id=${localId}`)
      setMesas(data || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Error al cargar mesas')
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => {
    setLoading(true)
    fetchMesas()
  }, [fetchMesas])

  const createMesa = useCallback(async ({ name, capacidad, zona }) => {
    const data = await apiRequest('/mesas', {
      method: 'POST',
      body: {
        local_id: localId,
        name,
        capacidad: Number(capacidad),
        zona,
        is_delivery: false,
        is_active: true,
      },
    })
    setMesas((prev) => [...prev, data])
    return data
  }, [localId])

  return { mesas, loading, error, refresh: fetchMesas, createMesa }
}
