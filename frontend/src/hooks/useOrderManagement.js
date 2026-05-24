import { useState, useCallback } from 'react'
import { apiRequest } from '../lib/apiClient'

/**
 * Hook para crear órdenes y actualizar su estado
 */
export function useOrderManagement() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const createOrder = useCallback(async (orderData) => {
    try {
      setLoading(true)
      setError(null)

      const createdOrder = await apiRequest('/orders', {
        method: 'POST',
        body: orderData,
      })
      return createdOrder
    } catch (err) {
      const message = err.message || 'Error creando orden'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateOrderStatus = useCallback(async (orderId, status) => {
    try {
      setLoading(true)
      setError(null)

      const updatedOrder = await apiRequest(`/orders/${orderId}`, {
        method: 'PATCH',
        body: { status },
      })
      return updatedOrder
    } catch (err) {
      const message = err.message || 'Error actualizando orden'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { createOrder, updateOrderStatus, loading, error }
}
