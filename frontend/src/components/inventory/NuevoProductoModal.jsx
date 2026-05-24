import { useCallback, useEffect, useState } from 'react'
import { getAuthContext } from '../../lib/apiClient'
import {
  getInventorySuppliersForLocal,
  getLocalById,
  postInventoryNewProduct,
  postSupplier,
  resolveCategoryNameForLocal,
} from '../../lib/inventoryApi'
import CategoryTypeahead from './CategoryTypeahead'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const UNITS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'L', label: 'L' },
  { value: 'ml', label: 'ml' },
]

function NuevoProductoModal({ open, localId, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('unidad')
  const [currentStock, setCurrentStock] = useState('0')
  const [minStock, setMinStock] = useState('0')
  const [maxStock, setMaxStock] = useState('0')
  const [unitCost, setUnitCost] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [suppliersError, setSuppliersError] = useState('')
  const [newSupplierName, setNewSupplierName] = useState('')
  const [addingSupplier, setAddingSupplier] = useState(false)

  const loadSuppliers = useCallback(async () => {
    if (!localId) return
    setSuppliersLoading(true)
    setSuppliersError('')
    try {
      const rows = await getInventorySuppliersForLocal(localId)
      const list = Array.isArray(rows) ? rows : []
      setSuppliers(list)
      setSupplierId((prev) => {
        if (prev && list.some((s) => String(s.id) === prev)) return prev
        return list[0]?.id != null ? String(list[0].id) : ''
      })
    } catch (err) {
      setSuppliers([])
      setSupplierId('')
      setSuppliersError(err?.message || 'No se pudieron cargar los proveedores.')
    } finally {
      setSuppliersLoading(false)
    }
  }, [localId])

  useEffect(() => {
    if (!open) return
    setError('')
    setSubmitting(false)
  }, [open])

  useEffect(() => {
    if (!open || !localId) {
      setSuppliers([])
      setSupplierId('')
      setSuppliersError('')
      setNewSupplierName('')
      return
    }
    loadSuppliers()
  }, [open, localId, loadSuppliers])

  const handleAddSupplier = async (e) => {
    e?.preventDefault()
    const name = newSupplierName.trim()
    if (!name) { setError('Escribe el nombre del proveedor.'); return }
    setAddingSupplier(true)
    setError('')
    try {
      const { businessId: bidFromToken } = await getAuthContext()
      let businessId = bidFromToken != null ? String(bidFromToken) : null
      if (!businessId && localId) {
        const loc = await getLocalById(localId)
        if (loc?.business_id != null) businessId = String(loc.business_id)
      }
      if (!businessId) { setError('No se pudo determinar el negocio del local.'); return }
      const created = await postSupplier({ name, business_id: businessId })
      setNewSupplierName('')
      await loadSuppliers()
      if (created?.id) setSupplierId(String(created.id))
    } catch (err) {
      setError(err?.message || 'No se pudo crear el proveedor.')
    } finally {
      setAddingSupplier(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const cost = Number(unitCost)
    if (!productName.trim() || !category.trim()) { setError('Completa nombre y categoría.'); return }
    if (!supplierId) { setError('Selecciona un proveedor o agrega uno nuevo.'); return }
    if (!Number.isFinite(cost) || cost <= 0) { setError('El costo unitario debe ser mayor que 0.'); return }
    setSubmitting(true)
    try {
      const resolvedCategory = await resolveCategoryNameForLocal(localId, category)
      setCategory(resolvedCategory)
      await postInventoryNewProduct(localId, {
        productName: productName.trim(),
        category: resolvedCategory,
        unit,
        currentStock: Number(currentStock) || 0,
        minStock: Number(minStock) || 0,
        maxStock: Number(maxStock) || 0,
        unitCost: Math.round(cost),
        supplierId,
      })
      onSuccess?.()
      onClose?.()
      setProductName(''); setCategory(''); setUnit('unidad')
      setCurrentStock('0'); setMinStock('0'); setMaxStock('0')
      setUnitCost(''); setSupplierId(suppliers[0]?.id != null ? String(suppliers[0].id) : '')
    } catch (err) {
      setError(err?.message || 'No se pudo crear el producto.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = suppliers.length > 0 && !!supplierId

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose?.() }}>
      <DialogContent
        className="max-w-xl w-full flex flex-col overflow-hidden p-0"
        style={{ maxHeight: 'min(92vh, 680px)' }}
      >
        <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Nuevo producto</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <form id="np-form" onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-4">

            {error && (
              <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
                {error}
              </p>
            )}
            {suppliersError && (
              <p className="rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2">
                {suppliersError}
              </p>
            )}

            {/* Nombre + Categoría */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="np-name">Nombre</Label>
                <Input
                  id="np-name"
                  value={productName}
                  onChange={(ev) => setProductName(ev.target.value)}
                  placeholder="Ej: Tomate cherry"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Categoría</Label>
                <CategoryTypeahead
                  localId={localId}
                  value={category}
                  onChange={setCategory}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Formato de medida + Costo unitario */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="np-unit">Formato de medida</Label>
                <Select value={unit} onValueChange={setUnit} disabled={submitting}>
                  <SelectTrigger id="np-unit" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="np-unit-cost">Costo unitario (CLP)</Label>
                <Input
                  id="np-unit-cost"
                  type="number"
                  min={1}
                  step={1}
                  value={unitCost}
                  onChange={(ev) => setUnitCost(ev.target.value)}
                  placeholder="0"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Niveles de stock */}
            <fieldset className="border border-[hsl(var(--border))] rounded-lg px-4 pb-4 pt-2">
              <legend className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-1">
                Niveles de stock
              </legend>
              <div className="grid grid-cols-3 gap-4 mt-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="np-stock-current">Actual</Label>
                  <Input
                    id="np-stock-current"
                    type="number"
                    min={0}
                    step={1}
                    value={currentStock}
                    onChange={(ev) => setCurrentStock(ev.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="np-stock-min">Mínimo</Label>
                  <Input
                    id="np-stock-min"
                    type="number"
                    min={0}
                    step={1}
                    value={minStock}
                    onChange={(ev) => setMinStock(ev.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="np-stock-max">Máximo</Label>
                  <Input
                    id="np-stock-max"
                    type="number"
                    min={0}
                    step={1}
                    value={maxStock}
                    onChange={(ev) => setMaxStock(ev.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            </fieldset>

            {/* Proveedor */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np-supplier">Proveedor</Label>
              <Select
                value={supplierId || undefined}
                onValueChange={setSupplierId}
                disabled={suppliersLoading || suppliers.length === 0 || submitting}
              >
                <SelectTrigger id="np-supplier" className="h-9 text-sm" aria-busy={suppliersLoading}>
                  <SelectValue
                    placeholder={
                      suppliersLoading
                        ? 'Cargando proveedores…'
                        : suppliers.length === 0
                          ? 'Sin proveedores — agrega uno abajo'
                          : 'Seleccionar proveedor'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!suppliersLoading && suppliers.length === 0 && (
                <div className="flex gap-2 mt-1">
                  <Input
                    type="text"
                    placeholder="Nombre del nuevo proveedor"
                    value={newSupplierName}
                    onChange={(ev) => setNewSupplierName(ev.target.value)}
                    disabled={addingSupplier}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddSupplier}
                    disabled={addingSupplier || !newSupplierName.trim()}
                    className="shrink-0"
                  >
                    {addingSupplier ? 'Guardando…' : 'Agregar'}
                  </Button>
                </div>
              )}
            </div>

          </form>
        </div>

        <DialogFooter className="shrink-0 px-6 py-4 border-t border-[hsl(var(--border))]">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="np-form" disabled={submitting || !canSubmit}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default NuevoProductoModal
