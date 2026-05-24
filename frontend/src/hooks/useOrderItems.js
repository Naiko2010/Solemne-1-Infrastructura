import { useState, useCallback } from 'react'
import { apiRequest } from '../lib/apiClient'

export function useOrderItems(orderId) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const createItem = useCallback(
    async (productId, quantity, unitPrice) => {
      if (!orderId) {
        setError('No hay orden activa')
        return null
      }

      setLoading(true)
      setError(null)

      try {
        return await apiRequest(`/orders/${orderId}/items`, {
          method: 'POST',
          body: {
            product_id: productId,
            quantity: parseInt(quantity),
            unit_price: parseFloat(unitPrice),
          },
        })
      } catch (err) {
        setError(err.message || 'Error al agregar producto')
        return null
      } finally {
        setLoading(false)
      }
    },
    [orderId],
  )

  const updateItem = useCallback(
    async (itemId, quantity, unitPrice) => {
      if (!orderId) {
        setError('No hay orden activa')
        return null
      }

      setLoading(true)
      setError(null)

      try {
        return await apiRequest(`/orders/${orderId}/items/${itemId}`, {
          method: 'PATCH',
          body: {
            quantity: quantity !== undefined ? parseInt(quantity) : undefined,
            unit_price: unitPrice !== undefined ? parseFloat(unitPrice) : undefined,
          },
        })
      } catch (err) {
        setError(err.message || 'Error al actualizar producto')
        return null
      } finally {
        setLoading(false)
      }
    },
    [orderId],
  )

  const deleteItem = useCallback(
    async (itemId) => {
      if (!orderId) {
        setError('No hay orden activa')
        return false
      }

      setLoading(true)
      setError(null)

      try {
        await apiRequest(`/orders/${orderId}/items/${itemId}`, { method: 'DELETE' })
        return true
      } catch (err) {
        setError(err.message || 'Error al eliminar producto')
        return false
      } finally {
        setLoading(false)
      }
    },
    [orderId],
  )

  return { createItem, updateItem, deleteItem, loading, error }
}
