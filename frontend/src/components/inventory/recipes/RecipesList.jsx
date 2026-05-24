import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Eye, Pencil, Power, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCLPOrDash as formatCLP } from '../../../lib/formatCLP'

function RecipesList({
  recipes,
  loading,
  error,
  onViewDetail,
  onToggleStatus,
  onDelete,
  onEdit,
  searchTerm,
}) {
  const [actionError, setActionError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const filtered = recipes.filter((recipe) =>
    recipe.name.toLowerCase().includes((searchTerm || '').toLowerCase())
  )

  const emptyTitle = searchTerm ? 'No se encontraron recetas' : 'No hay recetas registradas'
  const emptySubtitle = searchTerm ? 'Intenta con otro término de búsqueda' : 'Crea la primera receta para comenzar'

  const handleToggle = async (recipe) => {
    setActionLoading(`toggle-${recipe.id}`)
    setActionError('')
    try {
      await onToggleStatus(recipe.id, !recipe.is_active)
    } catch (e) {
      setActionError(e?.message || 'Error al cambiar estado')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (recipe) => {
    if (!window.confirm(`¿Eliminar receta "${recipe.name}"? Esta acción no se puede deshacer.`)) return
    setActionLoading(`delete-${recipe.id}`)
    setActionError('')
    try {
      await onDelete(recipe.id)
    } catch (e) {
      setActionError(e?.message || 'No se pudo eliminar la receta')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <>
      {actionError ? (
        <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
          {actionError}
        </p>
      ) : null}

      {/* Mobile cards — hidden on md+ */}
      <div className="flex flex-col gap-3 md:hidden" aria-label="Listado de recetas (móvil)">
        {error ? (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
        ) : null}
        {!error && loading ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">Cargando recetas…</p>
        ) : null}
        {!error && !loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <p className="font-semibold text-[hsl(var(--foreground))]">{emptyTitle}</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{emptySubtitle}</p>
          </div>
        ) : null}

        {!error && !loading && filtered.map((recipe) => (
          <article
            key={recipe.id}
            className={cn(
              'rounded-xl border bg-white shadow-sm p-4 flex flex-col gap-3',
              !recipe.is_active && 'opacity-60',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-[hsl(var(--foreground))]">{recipe.name}</p>
                {recipe.category_name && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{recipe.category_name}</p>
                )}
              </div>
              <Badge variant={recipe.is_active ? 'success' : 'secondary'}>
                {recipe.is_active ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>

            {recipe.description && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">{recipe.description}</p>
            )}

            <div className="grid grid-cols-4 gap-2">
              {[
                ['Costo', `$${formatCLP(recipe.total_cost)}`],
                ['Venta', `$${formatCLP(recipe.price_sale)}`],
                ['Margen', `${recipe.profit_margin_percent?.toFixed(1)}%`],
                ['Porciones', recipe.yield_portions],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col items-center rounded-md bg-[hsl(var(--accent))] px-2 py-1.5">
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{k}</span>
                  <span className="text-xs font-bold text-[hsl(var(--foreground))]">{v}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => onViewDetail(recipe.id)} disabled={!recipe.is_active}>Ver</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onEdit(recipe)} disabled={!recipe.is_active}>Editar</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleToggle(recipe)} disabled={actionLoading === `toggle-${recipe.id}`}>
                {recipe.is_active ? 'Desactivar' : 'Activar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[hsl(var(--destructive))] border-[hsl(var(--destructive)/0.3)]"
                onClick={() => handleDelete(recipe)}
                disabled={actionLoading === `delete-${recipe.id}`}
              >
                Eliminar
              </Button>
            </div>
          </article>
        ))}
      </div>

      {/* Desktop table — hidden below md */}
      <div className="hidden md:block rounded-md border border-[hsl(var(--border))] overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receta</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Costo Total</TableHead>
              <TableHead className="text-right">Precio Venta</TableHead>
              <TableHead className="text-right">Margen</TableHead>
              <TableHead className="text-right">Porciones</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-[hsl(var(--destructive))] py-8">{error}</TableCell>
              </TableRow>
            ) : null}
            {!error && loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-[hsl(var(--muted-foreground))] py-8">Cargando recetas…</TableCell>
              </TableRow>
            ) : null}
            {!error && !loading && filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <p className="font-semibold text-[hsl(var(--foreground))]">{emptyTitle}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{emptySubtitle}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {!error && !loading && filtered.map((recipe) => (
              <TableRow key={recipe.id} className={cn(!recipe.is_active && 'opacity-60')}>
                <TableCell>
                  <div className="font-medium text-[hsl(var(--foreground))]">{recipe.name}</div>
                  {recipe.description && (
                    <div className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[180px]">{recipe.description}</div>
                  )}
                </TableCell>
                <TableCell>{recipe.category_name || '—'}</TableCell>
                <TableCell className="text-right text-red-600 font-medium">${formatCLP(recipe.total_cost)}</TableCell>
                <TableCell className="text-right text-[hsl(var(--primary))] font-medium">${formatCLP(recipe.price_sale)}</TableCell>
                <TableCell className={`text-right font-bold ${recipe.profit_margin_percent >= 30 ? 'text-emerald-600' : 'text-[hsl(var(--foreground))]'}`}>
                  {recipe.profit_margin_percent?.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right">{recipe.yield_portions}</TableCell>
                <TableCell>
                  <Badge variant={recipe.is_active ? 'success' : 'secondary'}>
                    {recipe.is_active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetail(recipe.id)}
                      title={recipe.is_active ? 'Ver detalles' : 'Receta inactiva'}
                      className="p-1 h-7 w-7"
                      disabled={!recipe.is_active}
                    >
                      <Eye size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(recipe)}
                      title={recipe.is_active ? 'Editar' : 'Receta inactiva'}
                      className="p-1 h-7 w-7"
                      disabled={!recipe.is_active}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(recipe)}
                      title={recipe.is_active ? 'Desactivar' : 'Activar'}
                      className={cn('p-1 h-7 w-7', recipe.is_active ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700')}
                      disabled={actionLoading === `toggle-${recipe.id}`}
                    >
                      <Power size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(recipe)}
                      title="Eliminar"
                      className="p-1 h-7 w-7 text-[hsl(var(--destructive))]"
                      disabled={actionLoading === `delete-${recipe.id}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

export default RecipesList
