import { useState, useEffect, useCallback } from 'react'
import { apiRequest } from '../lib/apiClient'

export function useRecipes(localId) {
  const [recipes, setRecipes] = useState([])
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch recipes list
  const fetchRecipes = useCallback(
    async ({ categoryId = null, search = null, isActive = null } = {}) => {
      if (!localId) return
      try {
        setLoading(true)
        const params = new URLSearchParams({ local_id: localId })
        if (categoryId) params.append('category_id', categoryId)
        if (search) params.append('search', search)
        if (isActive !== null) params.append('is_active', isActive)

        const data = await apiRequest(`/recipes?${params.toString()}`)
        setRecipes(data || [])
        setError(null)
      } catch (err) {
        setError(err.message || 'Error al cargar recetas')
      } finally {
        setLoading(false)
      }
    },
    [localId]
  )

  // Fetch KPIs
  const fetchKpis = useCallback(async () => {
    if (!localId) return
    try {
      const data = await apiRequest(`/recipes/kpis?local_id=${localId}`)
      setKpis(data)
    } catch (err) {
      console.error('Error fetching KPIs:', err)
    }
  }, [localId])

  // Initial load
  useEffect(() => {
    setLoading(true)
    fetchRecipes()
    fetchKpis()
  }, [fetchRecipes, fetchKpis])

  // Get single recipe detail
  const getRecipe = useCallback(
    async (recipeId) => {
      try {
        const data = await apiRequest(`/recipes/${recipeId}?local_id=${localId}`)
        return data
      } catch (err) {
        throw new Error(err.message || 'Error al obtener receta')
      }
    },
    [localId]
  )

  // Create new recipe
  const createRecipe = useCallback(
    async ({ categoryId, name, description, priceSale, yieldPortions, ingredients }) => {
      try {
        const data = await apiRequest(`/recipes`, {
          method: 'POST',
          body: {
            local_id: localId,
            category_id: categoryId,
            name,
            description,
            price_sale: priceSale,
            yield_portions: yieldPortions,
            ingredients: ingredients.map((ing) => ({
              product_id: ing.productId,
              quantity_required: ing.quantityRequired,
              unit: ing.unit,
            })),
          },
        })
        setRecipes((prev) => [...prev, data])
        return data
      } catch (err) {
        throw new Error(err.message || 'Error al crear receta')
      }
    },
    [localId]
  )

  // Update recipe
  const updateRecipe = useCallback(
    async (recipeId, { name, description, priceSale, yieldPortions, categoryId, ingredients, isActive }) => {
      try {
        const data = await apiRequest(`/recipes/${recipeId}?local_id=${localId}`, {
          method: 'PUT',
          body: {
            name,
            description,
            price_sale: priceSale,
            yield_portions: yieldPortions,
            category_id: categoryId,
            is_active: isActive,
            ...(ingredients && {
              ingredients: ingredients.map((ing) => ({
                product_id: ing.productId,
                quantity_required: ing.quantityRequired,
                unit: ing.unit,
              })),
            }),
          },
        })
        setRecipes((prev) =>
          prev.map((r) => (r.id === recipeId ? data : r))
        )
        return data
      } catch (err) {
        throw new Error(err.message || 'Error al actualizar receta')
      }
    },
    [localId]
  )

  // Toggle recipe status
  const toggleRecipeStatus = useCallback(
    async (recipeId, isActive) => {
      try {
        const data = await apiRequest(`/recipes/${recipeId}/status?local_id=${localId}&is_active=${isActive}`, {
          method: 'PATCH',
        })
        setRecipes((prev) =>
          prev.map((r) => (r.id === recipeId ? data : r))
        )
        return data
      } catch (err) {
        throw new Error(err.message || 'Error al cambiar estado')
      }
    },
    [localId]
  )

  // Delete recipe
  const deleteRecipe = useCallback(
    async (recipeId) => {
      try {
        await apiRequest(`/recipes/${recipeId}?local_id=${localId}`, {
          method: 'DELETE',
        })
        setRecipes((prev) => prev.filter((r) => r.id !== recipeId))
      } catch (err) {
        throw new Error(err.message || 'Error al eliminar receta')
      }
    },
    [localId]
  )

  // Record consumption (when recipe is sold)
  const consumeRecipe = useCallback(
    async (recipeId, { quantitySold, orderId = null }) => {
      try {
        const params = new URLSearchParams({
          local_id: localId,
          quantity_sold: quantitySold,
        })
        if (orderId) params.append('order_id', orderId)

        const data = await apiRequest(`/recipes/${recipeId}/consume?${params.toString()}`, {
          method: 'POST',
        })
        return data
      } catch (err) {
        throw new Error(err.message || 'Error al registrar consumo')
      }
    },
    [localId]
  )

  return {
    recipes,
    kpis,
    loading,
    error,
    fetchRecipes,
    fetchKpis,
    getRecipe,
    createRecipe,
    updateRecipe,
    toggleRecipeStatus,
    deleteRecipe,
    consumeRecipe,
  }
}
