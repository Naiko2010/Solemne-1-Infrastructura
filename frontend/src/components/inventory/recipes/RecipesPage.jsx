import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSelectedLocal } from '../../../hooks/useSelectedLocal'
import InventoryShell from '../InventoryShell'
import RecipesList from './RecipesList'
import RecipeDetail from './RecipeDetail'
import CreateRecipeModal from './CreateRecipeModal'
import { useRecipes } from '../../../hooks/useRecipes'
import { apiRequest } from '../../../lib/apiClient'
import { Button } from '@/components/ui/button'
import { BookOpen } from 'lucide-react'
import { formatCLPOrDash as formatCLP } from '../../../lib/formatCLP'

function RecipesPage() {
  const { localId } = useParams()
  const selectedLocal = useSelectedLocal(localId)

  const { recipes, kpis, loading, error, fetchRecipes, getRecipe, createRecipe, updateRecipe, toggleRecipeStatus, deleteRecipe, fetchKpis } = useRecipes(localId)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [categories, setCategories] = useState([])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await apiRequest(`/categories?local_id=${localId}`)
        setCategories(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Error loading categories:', err)
        setCategories([])
      }
    }
    if (localId) {
      loadCategories()
    }
  }, [localId])

  useEffect(() => {
    fetchRecipes({
      search: searchTerm || null,
      categoryId: categoryFilter || null,
      isActive: statusFilter === null ? null : statusFilter === 'active',
    })
  }, [searchTerm, categoryFilter, statusFilter, fetchRecipes])

  const handleViewDetail = async (recipeId) => {
    try {
      const recipe = await getRecipe(recipeId)
      setSelectedRecipe(recipe)
      setShowDetailModal(true)
    } catch (err) {
      console.error('Error loading recipe:', err)
    }
  }

  const handleDelete = async (recipeId) => {
    await deleteRecipe(recipeId)
    await fetchKpis()
  }

  const handleToggleStatus = async (recipeId, isActive) => {
    await toggleRecipeStatus(recipeId, isActive)
    await fetchKpis()
  }

  const handleSaveRecipe = async (formData) => {
    try {
      const transformedData = {
        categoryId: formData.category_id,
        name: formData.name,
        description: formData.description,
        priceSale: formData.price_sale,
        yieldPortions: formData.yield_portions,
        ingredients: formData.ingredients?.map(ing => ({
          productId: ing.product_id,
          quantityRequired: ing.quantity_required,
          unit: ing.unit,
        })) || [],
      }

      if (editingRecipe?.id) {
        await updateRecipe(editingRecipe.id, {
          ...transformedData,
          isActive: editingRecipe.is_active,
        })
      } else {
        await createRecipe(transformedData)
      }

      setShowCreateModal(false)
      setEditingRecipe(null)
      await fetchRecipes()
      await fetchKpis()
    } catch (err) {
      console.error('Error saving recipe:', err)
    }
  }

  const selectClass = 'h-9 rounded-md border border-[hsl(var(--border))] bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'

  return (
    <InventoryShell>
      <div className="flex flex-col gap-6 pb-8 pt-4 px-6">

        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" aria-hidden="true">
              <BookOpen size={22} />
            </span>
            <div>
              <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Gestión de Recetas</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Crea y administra recetas con cálculo automático de costos</p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => {
              setEditingRecipe(null)
              setShowCreateModal(true)
            }}
          >
            + Nueva Receta
          </Button>
        </header>

        {/* KPIs */}
        {kpis && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="KPIs de recetas">
            {[
              { label: 'Total de Recetas', value: kpis.total_recipes || 0, color: 'text-[hsl(var(--foreground))]' },
              { label: 'Activas', value: kpis.active_recipes || 0, color: 'text-emerald-600' },
              { label: 'Costo Promedio', value: `$${formatCLP(kpis.total_cost_average)}`, color: 'text-[hsl(var(--foreground))]' },
              { label: 'Margen Promedio', value: `${kpis.profit_margin_average?.toFixed(1)}%`, color: 'text-[hsl(var(--primary))]' },
            ].map(({ label, value, color }) => (
              <article key={label} className="flex flex-col gap-0.5 rounded-xl border border-[hsl(var(--border))] bg-white shadow-sm px-4 py-3">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
                <span className={`text-xl font-bold ${color}`}>{value}</span>
              </article>
            ))}
          </section>
        )}

        {/* Filters */}
        <section className="flex flex-wrap gap-2" aria-label="Filtros de recetas">
          <input
            type="text"
            placeholder="Buscar recetas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${selectClass} min-w-[180px]`}
          />
          <select
            className={selectClass}
            value={categoryFilter || ''}
            onChange={(e) => setCategoryFilter(e.target.value || null)}
          >
            <option value="">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter(e.target.value || null)}
          >
            <option value="">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
        </section>

        <RecipesList
          recipes={recipes}
          loading={loading}
          error={error}
          onViewDetail={handleViewDetail}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
          onEdit={(recipe) => {
            setEditingRecipe(recipe)
            setShowCreateModal(true)
          }}
          searchTerm={searchTerm}
        />

        <CreateRecipeModal
          isOpen={showCreateModal}
          recipe={editingRecipe}
          categories={categories}
          onSave={handleSaveRecipe}
          onCancel={() => {
            setShowCreateModal(false)
            setEditingRecipe(null)
          }}
          localId={localId}
        />

        {showDetailModal && selectedRecipe && (
          <RecipeDetail
            recipe={selectedRecipe}
            onClose={() => {
              setShowDetailModal(false)
              setSelectedRecipe(null)
            }}
            onEdit={() => {
              setEditingRecipe(selectedRecipe)
              setShowDetailModal(false)
              setShowCreateModal(true)
            }}
            onDelete={async () => {
              await handleDelete(selectedRecipe.id)
              setShowDetailModal(false)
              setSelectedRecipe(null)
            }}
          />
        )}
      </div>
    </InventoryShell>
  )
}

export default RecipesPage
