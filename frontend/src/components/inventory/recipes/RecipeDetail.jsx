import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { formatCLPOrDash as formatCLP } from '../../../lib/formatCLP'

function RecipeDetail({ recipe, onClose, onEdit, onDelete }) {
  if (!recipe) return null

  const costPerPortion = recipe.yield_portions > 0 ? recipe.total_cost / recipe.yield_portions : 0

  const financialItems = [
    { label: 'Precio de Venta', value: `$${formatCLP(recipe.price_sale)}` },
    { label: 'Costo Total', value: `$${formatCLP(recipe.total_cost)}`, highlight: 'text-red-600' },
    { label: 'Costo x Porción', value: `$${formatCLP(costPerPortion)}` },
    {
      label: 'Margen de Ganancia',
      value: `${recipe.profit_margin_percent?.toFixed(1)}%`,
      highlight: recipe.profit_margin_percent >= 30 ? 'text-emerald-600' : undefined,
    },
    { label: 'Porciones que Rinde', value: recipe.yield_portions },
    { label: 'Categoría', value: recipe.category_name || '—' },
  ]

  return (
    <Dialog open={!!recipe} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl w-full flex flex-col overflow-hidden p-0" style={{ maxHeight: 'min(92vh, 720px)' }}>
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-[hsl(var(--border))]">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {recipe.name}
            <Badge variant={recipe.is_active === false ? 'secondary' : 'success'}>
              {recipe.is_active === false ? 'Inactiva' : 'Activa'}
            </Badge>
          </DialogTitle>
          {recipe.description && (
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{recipe.description}</p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">Resumen Financiero</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {financialItems.map(({ label, value, highlight }) => (
                <div key={label} className="flex flex-col gap-0.5 rounded-md bg-[hsl(var(--accent))] px-3 py-2.5">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
                  <span className={`text-sm font-bold ${highlight || 'text-[hsl(var(--foreground))]'}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">
                Ingredientes ({recipe.ingredients.length})
              </h3>
              <div className="rounded-md border border-[hsl(var(--border))] overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Costo Unitario</TableHead>
                      <TableHead>Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipe.ingredients.map((ing, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{ing.product_name}</TableCell>
                        <TableCell>{ing.quantity_required} {ing.unit}</TableCell>
                        <TableCell>${formatCLP(ing.unit_cost_clp)}</TableCell>
                        <TableCell>${formatCLP(ing.ingredient_subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 px-6 py-4 border-t border-[hsl(var(--border))] flex items-center gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (window.confirm(`¿Eliminar receta "${recipe.name}"? Esta acción no se puede deshacer.`)) {
                onDelete()
              }
            }}
            className="mr-auto"
          >
            Eliminar
          </Button>
          <Button type="button" onClick={onEdit}>
            Editar Receta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default RecipeDetail
