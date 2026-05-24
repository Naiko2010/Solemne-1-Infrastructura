import { useState, useEffect, useCallback } from 'react'
import { apiRequest } from '../lib/apiClient'

/**
 * Mesas con estado (libre/ocupada/en_cobro). Usa GET /mesas?with_state=true para
 * resolver todos los estados en una sola consulta (sin N+1).
 */
export function useMesasConEstado(localId) {
  const [mesas, setMesas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMesas = useCallback(async () => {
    if (!localId) return
    try {
      setLoading(true)
      setError(null)

      const data = await apiRequest(`/mesas?local_id=${localId}&with_state=true`)
      const mesas = data || []

      setMesas(
        mesas.map((mesa) => ({
          ...mesa,
          state: mesa.state || (mesa.is_active ? 'libre' : 'inactiva'),
        })),
      )
    } catch (err) {
      setError(err.message || 'Error al cargar mesas')
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => {
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
    await fetchMesas()
    return data
  }, [localId, fetchMesas])

  const updateMesa = useCallback(async ({ id, name, capacidad, zona, is_active }) => {
    const data = await apiRequest(`/mesas/${id}`, {
      method: 'PATCH',
      body: {
        name,
        capacidad: Number(capacidad),
        zona,
        is_active,
      },
    })
    await fetchMesas()
    return data
  }, [fetchMesas])

  const deleteMesa = useCallback(async (id) => {
    await apiRequest(`/mesas/${id}`, {
      method: 'DELETE',
    })
    await fetchMesas()
  }, [fetchMesas])

  return { mesas, loading, error, refresh: fetchMesas, createMesa, updateMesa, deleteMesa }
}
