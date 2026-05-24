import { useState, useEffect } from 'react'
import { getInventoryProductsPage } from '../../../lib/inventoryApi'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Plus, Trash2 } from 'lucide-react'

function CreateRecipeModal({ isOpen, recipe, categories, onSave, onCancel, localId }) {
  const [formData, setFormData] = useState({
    category_id: '',
    name: '',
    description: '',
    price_sale: '',
    yield_portions: 1,
  })

  const [ingredients, setIngredients] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [savingLoading, setSavingLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [newIngredient, setNewIngredient] = useState({
    product_id: '',
    quantity_required: '',
    unit: 'unidad',
  })

  useEffect(() => {
    if (!isOpen) return

    if (recipe) {
      setFormData({
        category_id: recipe.category_id || '',
        name: recipe.name || '',
        description: recipe.description || '',
        price_sale: recipe.price_sale || '',
        yield_portions: recipe.yield_portions || 1,
      })
      setIngredients(recipe.ingredients ? [...recipe.ingredients] : [])
    } else {
      setFormData({
        category_id: '',
        name: '',
        description: '',
        price_sale: '',
        yield_portions: 1,
      })
      setIngredients([])
    }
    setNewIngredient({ product_id: '', quantity_required: '', unit: 'unidad' })
    setErrors({})

    if (!localId) {
      setProducts([])
      return
    }
    let cancelled = false
    setLoading(true)
    getInventoryProductsPage(localId, { limit: 500, offset: 0 })
      .then((page) => { if (!cancelled) setProducts(page?.items || []) })
      .catch(() => { if (!cancelled) setErrors((prev) => ({ ...prev, products: 'Error cargando productos' })) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, recipe, localId])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'yield_portions' ? Math.max(1, parseInt(value) || 1) : value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleIngredientChange = (e) => {
    const { name, value } = e.target
    setNewIngredient((prev) => ({ ...prev, [name]: value }))
  }

  const addIngredient = () => {
    if (!newIngredient.product_id || !newIngredient.quantity_required) {
      setErrors((prev) => ({ ...prev, ingredient: 'Selecciona producto y cantidad' }))
      return
    }

    const selectedProductId = String(newIngredient.product_id)
    const product = products.find((p) => String(p.product_id) === selectedProductId)
    if (!product) return

    const isDuplicate = ingredients.some((ing) => String(ing.product_id) === selectedProductId)
    if (isDuplicate) {
      setErrors((prev) => ({ ...prev, ingredient: 'Este producto ya está agregado' }))
      return
    }

    const newIng = {
      product_id: selectedProductId,
      product_name: product.product_name,
      quantity_required: parseFloat(newIngredient.quantity_required),
      unit: newIngredient.unit,
      unit_cost_clp: Number(product.unit_cost_clp ?? product.price_per_unit ?? 0),
    }

    setIngredients((prev) => [...prev, newIng])
    setNewIngredient({ product_id: '', quantity_required: '', unit: 'unidad' })
    setErrors((prev) => ({ ...prev, ingredient: '' }))
  }

  const removeIngredient = (productId) => {
    setIngredients((prev) => prev.filter((ing) => ing.product_id !== productId))
  }

  const calculateTotalCost = () => {
    return ingredients.reduce((sum, ing) => sum + ing.quantity_required * ing.unit_cost_clp, 0)
  }

  const calculateMargin = () => {
    const totalCost = calculateTotalCost()
    const salePrice = parseFloat(formData.price_sale) || 0
    return salePrice > 0 ? ((salePrice - totalCost) / salePrice) * 100 : 0
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.category_id) newErrors.category_id = 'Categoría requerida'
    if (!formData.name.trim()) newErrors.name = 'Nombre requerido'
    if (!formData.price_sale) newErrors.price_sale = 'Precio de venta requerido'
    if (parseFloat(formData.price_sale) <= 0) newErrors.price_sale = 'Precio debe ser mayor a 0'
    if (formData.yield_portions < 1) newErrors.yield_portions = 'Debe rendir al menos 1 porción'
    if (ingredients.length === 0) newErrors.ingredients = 'Agrega al menos 1 ingrediente'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSavingLoading(true)
    try {
      const totalCost = calculateTotalCost()
      const payload = {
        category_id: formData.category_id,
        name: formData.name.trim(),
        description: formData.description.trim(),
        price_sale: parseFloat(formData.price_sale),
        yield_portions: formData.yield_portions,
        total_cost: totalCost,
        profit_margin_percent: calculateMargin(),
        ingredients,
      }
      if (recipe) payload.id = recipe.id
      await onSave(payload)
    } finally {
      setSavingLoading(false)
    }
  }

  const totalCost = calculateTotalCost()
  const margin = calculateMargin()

  const selectClass = (errKey) =>
    `h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] bg-white ${
      errors[errKey] ? 'border-[hsl(var(--destructive))]' : 'border-[hsl(var(--border))]'
    }`

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="max-w-3xl w-full flex flex-col overflow-hidden p-0" style={{ maxHeight: 'min(92vh, 780px)' }}>
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-[hsl(var(--border))]">
          <DialogTitle>{recipe ? 'Editar Receta' : 'Nueva Receta'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 flex flex-col gap-5">
          {/* Datos básicos */}
          <fieldset className="border border-[hsl(var(--border))] rounded-md p-4">
            <legend className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-1">
              Datos de la Receta
            </legend>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cr-category">
                  Categoría <span className="text-[hsl(var(--destructive))]">*</span>
                </Label>
                <select
                  id="cr-category"
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleFormChange}
                  className={selectClass('category_id')}
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                {errors.category_id && <span className="text-xs text-[hsl(var(--destructive))]">{errors.category_id}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cr-name">
                  Nombre <span className="text-[hsl(var(--destructive))]">*</span>
                </Label>
                <Input
                  id="cr-name"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="Ej: Filete a lo Pobre"
                  className={errors.name ? 'border-[hsl(var(--destructive))]' : ''}
                />
                {errors.name && <span className="text-xs text-[hsl(var(--destructive))]">{errors.name}</span>}
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="cr-description">Descripción</Label>
                <textarea
                  id="cr-description"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Breve descripción"
                  rows={2}
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-white px-3 py-2 text-sm shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cr-price-sale">
                  Precio de Venta (CLP) <span className="text-[hsl(var(--destructive))]">*</span>
                </Label>
                <Input
                  id="cr-price-sale"
                  type="number"
                  name="price_sale"
                  value={formData.price_sale}
                  onChange={handleFormChange}
                  placeholder="12000"
                  className={errors.price_sale ? 'border-[hsl(var(--destructive))]' : ''}
                />
                {errors.price_sale && <span className="text-xs text-[hsl(var(--destructive))]">{errors.price_sale}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cr-yield">
                  Porciones que Rinde <span className="text-[hsl(var(--destructive))]">*</span>
                </Label>
                <Input
                  id="cr-yield"
                  type="number"
                  name="yield_portions"
                  value={formData.yield_portions}
                  onChange={handleFormChange}
                  min="1"
                  className={errors.yield_portions ? 'border-[hsl(var(--destructive))]' : ''}
                />
                {errors.yield_portions && <span className="text-xs text-[hsl(var(--destructive))]">{errors.yield_portions}</span>}
              </div>
            </div>
          </fieldset>

          {/* Ingredientes */}
          <fieldset className="border border-[hsl(var(--border))] rounded-md p-4">
            <legend className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-1">
              Ingredientes
            </legend>

            {loading ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] py-3">Cargando productos...</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mt-2 items-end">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cr-ing-product">Producto</Label>
                    <select
                      id="cr-ing-product"
                      name="product_id"
                      value={newIngredient.product_id}
                      onChange={handleIngredientChange}
                      className={selectClass(null)}
                    >
                      <option value="">Selecciona un producto</option>
                      {products.map((prod) => (
                        <option key={prod.product_id} value={prod.product_id}>
                          {prod.product_name} (${Number(prod.unit_cost_clp ?? 0).toFixed(0)}/u)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cr-ing-qty">Cantidad</Label>
                    <Input
                      id="cr-ing-qty"
                      type="number"
                      name="quantity_required"
                      value={newIngredient.quantity_required}
                      onChange={handleIngredientChange}
                      placeholder="0.5"
                      step="0.01"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cr-ing-unit">Formato de medida</Label>
                    <select
                      id="cr-ing-unit"
                      name="unit"
                      value={newIngredient.unit}
                      onChange={handleIngredientChange}
                      className={selectClass(null)}
                    >
                      <option value="unidad">unidad</option>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="L">L</option>
                      <option value="ml">ml</option>
                      <option value="taza">taza</option>
                      <option value="cucharada">cucharada</option>
                      <option value="cucharadita">cucharadita</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={addIngredient}
                  className="mt-2 gap-1.5"
                >
                  <Plus size={15} /> Agregar ingrediente
                </Button>

                {errors.ingredient && (
                  <p className="text-xs text-[hsl(var(--destructive))] mt-1">{errors.ingredient}</p>
                )}
                {errors.ingredients && (
                  <p className="text-xs text-[hsl(var(--destructive))] mt-1">{errors.ingredients}</p>
                )}

                {ingredients.length > 0 ? (
                  <div className="mt-3 rounded-md border border-[hsl(var(--border))] overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Costo Unit.</TableHead>
                          <TableHead>Subtotal</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ingredients.map((ing) => (
                          <TableRow key={ing.product_id}>
                            <TableCell>{ing.product_name}</TableCell>
                            <TableCell>{ing.quantity_required} {ing.unit}</TableCell>
                            <TableCell>${ing.unit_cost_clp?.toFixed(0) || '0'}</TableCell>
                            <TableCell>${(ing.quantity_required * ing.unit_cost_clp).toFixed(0)}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeIngredient(ing.product_id)}
                                aria-label="Eliminar ingrediente"
                                className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
                              >
                                <Trash2 size={15} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-center text-[hsl(var(--muted-foreground))] mt-3 py-3 border border-dashed border-[hsl(var(--border))] rounded-md">
                    Sin ingredientes agregados. Usa el selector arriba.
                  </p>
                )}
              </>
            )}
          </fieldset>

          {/* Resumen financiero */}
          {ingredients.length > 0 && (
            <fieldset className="border border-[hsl(var(--border))] rounded-md p-4">
              <legend className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-1">
                Resumen Financiero
              </legend>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                  ['Costo Total', `$${totalCost.toFixed(0)}`],
                  ['Costo por Porción', `$${(totalCost / formData.yield_portions).toFixed(0)}`],
                  ['Precio de Venta', `$${formData.price_sale || '0'}`],
                  ['Margen de Ganancia', `${margin.toFixed(1)}%`, margin >= 30],
                ].map(([label, val, isGood]) => (
                  <div key={label} className="flex justify-between items-center rounded-md bg-[hsl(var(--accent))] px-3 py-2">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
                    <span className={`text-sm font-bold ${isGood ? 'text-emerald-600' : 'text-[hsl(var(--foreground))]'}`}>
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <DialogFooter className="shrink-0 px-6 py-4 border-t border-[hsl(var(--border))]">
          <Button type="button" variant="outline" onClick={onCancel} disabled={savingLoading}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={savingLoading}>
            {savingLoading ? 'Guardando...' : recipe ? 'Actualizar' : 'Crear Receta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CreateRecipeModal
