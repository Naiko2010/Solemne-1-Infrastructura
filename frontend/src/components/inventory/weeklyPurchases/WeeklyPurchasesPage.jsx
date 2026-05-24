import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useSelectedLocal } from '../../../hooks/useSelectedLocal'
import { useLocalBusinessId } from '../../../hooks/useLocalBusinessId'
import {
  getSupplierDetailForBusiness,
  getSupplierPurchaseHistoryForBusiness,
  getSuppliersWithMetricsForBusiness,
  getWeeklyPurchaseComparisonReport,
  getWeeklyPurchaseOrders,
  postWeeklyPurchaseOrder,
} from '../../../lib/providersApi'
import { useAuth } from '../../../context/AuthContext'
import { formatCLPDisplay as formatMoneyClp } from '../../../lib/formatCLP'
import InventoryShell from '../InventoryShell'
import LoadingSpinner from '../../LoadingSpinner'
import ModernDateField from '../ModernDateField'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { CalendarDays, RefreshCw, AlertTriangle, Plus, Minus, X, Search, BarChart2 } from 'lucide-react'

const SUPPLIER_SEARCH_DEBOUNCE_MS = 350

function formatWeekLong(iso) {
  if (!iso || typeof iso !== 'string' || iso.length < 10) return '—'
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(d)
  } catch { return iso }
}

function formatReceivedCell(order) {
  const t = Number(order?.total_received_clp)
  if (Number.isFinite(t) && t > 0) return formatMoneyClp(t)
  return '—'
}

function linesFromSupplierDetail(detail) {
  const products = Array.isArray(detail?.purchased_products) ? detail.purchased_products : []
  return products.map((p) => ({
    product_id: p.product_id,
    product_name: p.name || String(p.product_id),
    quantity_ordered: 1,
    unit_price_clp: Math.max(0, Math.round(Number(p.unit_price_clp) || 0)),
    line_notes: null,
  }))
}

function linesFromPurchaseHistory(history) {
  const products = Array.isArray(history?.products) ? history.products : []
  return products.map((p) => {
    const qty = Number(p.total_quantity_received) || 0
    const total = Number(p.total_amount_received_clp) || 0
    const avg = qty > 0 ? Math.round(total / qty) : 0
    return {
      product_id: p.product_id,
      product_name: p.product_name || String(p.product_id),
      quantity_ordered: 1,
      unit_price_clp: Math.max(0, avg),
      line_notes: null,
    }
  })
}

function mondayOfWeekContaining(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

const STATUS_LABELS = {
  draft: 'Borrador',
  sent: 'Enviada',
  in_transit: 'En tránsito',
  partially_received: 'Recepción parcial',
  received: 'Recibida',
  cancelled: 'Anulada',
}

const STATUS_VARIANT = {
  draft: 'secondary',
  sent: 'info',
  in_transit: 'warning',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'destructive',
}

/* ── Modal nueva orden ───────────────────────────────────────── */
function NewWeeklyOrderModal({ open, businessId, localId, onClose, onCreated, supplierSearchDebounced = '', supplierCategoryFilter = '' }) {
  const [suppliers, setSuppliers] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [weekDate, setWeekDate] = useState(() => mondayOfWeekContaining(new Date().toISOString().slice(0, 10)))
  const [lines, setLines] = useState([])
  const [availableProducts, setAvailableProducts] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSelected, setPickerSelected] = useState(new Set())
  const [pickerSearch, setPickerSearch] = useState('')
  const [loadingSup, setLoadingSup] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load suppliers list
  useEffect(() => {
    if (!open || !businessId) { setError(''); return }
    let cancelled = false
    ;(async () => {
      setLoadingSup(true)
      setError('')
      try {
        const filters = {}
        if (supplierSearchDebounced?.trim()) filters.search = supplierSearchDebounced.trim()
        if (supplierCategoryFilter?.trim()) filters.category = supplierCategoryFilter.trim()
        const rows = await getSuppliersWithMetricsForBusiness(businessId, filters)
        if (!cancelled) setSuppliers(Array.isArray(rows) ? rows : [])
      } catch (e) {
        if (!cancelled) setError(e?.message || 'No se pudieron cargar proveedores.')
      } finally {
        if (!cancelled) setLoadingSup(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, businessId, supplierSearchDebounced, supplierCategoryFilter])

  // Reset everything when modal closes
  useEffect(() => {
    if (!open) {
      setSupplierId('')
      setLines([])
      setAvailableProducts([])
      setPickerOpen(false)
      setPickerSelected(new Set())
      setPickerSearch('')
      setError('')
    }
  }, [open])

  // Keep supplierId valid when supplier list changes
  useEffect(() => {
    if (!supplierId) return
    if (!suppliers.some((s) => String(s.id) === String(supplierId))) setSupplierId('')
  }, [suppliers, supplierId])

  // Load available products when supplier selected — lines always start empty
  useEffect(() => {
    if (!open || !supplierId || !businessId) {
      setLines([])
      setAvailableProducts([])
      setPickerOpen(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingProducts(true)
      setError('')
      try {
        const [detail, history] = await Promise.all([
          getSupplierDetailForBusiness(supplierId, businessId).catch(() => null),
          getSupplierPurchaseHistoryForBusiness(supplierId, businessId).catch(() => null),
        ])
        if (cancelled) return
        const fromDetail = linesFromSupplierDetail(detail)
        const products = fromDetail.length > 0 ? fromDetail : linesFromPurchaseHistory(history)
        setAvailableProducts(products)
        setLines([])
        setPickerOpen(false)
        setPickerSelected(new Set())
        setPickerSearch('')
      } catch (e) {
        if (!cancelled) {
          setAvailableProducts([])
          setLines([])
          setError(e?.message || 'No se pudieron cargar productos del proveedor.')
        }
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, supplierId, businessId])

  const togglePickerProduct = (productId) => {
    setPickerSelected((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const toggleSelectAll = () => {
    const filtered = pickerFilteredProducts
    const allSelected = filtered.length > 0 && filtered.every((p) => pickerSelected.has(String(p.product_id)))
    if (allSelected) {
      setPickerSelected((prev) => {
        const next = new Set(prev)
        for (const p of filtered) next.delete(String(p.product_id))
        return next
      })
    } else {
      setPickerSelected((prev) => {
        const next = new Set(prev)
        for (const p of filtered) next.add(String(p.product_id))
        return next
      })
    }
  }

  const confirmPickerSelection = () => {
    if (pickerSelected.size === 0) return
    setLines((prev) => {
      const next = [...prev]
      for (const p of availableProducts) {
        const pid = String(p.product_id)
        if (!pickerSelected.has(pid)) continue
        if (!next.some((l) => String(l.product_id) === pid)) {
          next.push({ ...p, quantity_ordered: 1 })
        }
      }
      return next
    })
    setPickerOpen(false)
    setPickerSelected(new Set())
    setPickerSearch('')
  }

  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx))

  const changeQty = (idx, delta) =>
    setLines((prev) => {
      const copy = [...prev]
      if (!copy[idx]) return prev
      const newQty = Math.max(1, Math.round(Number(copy[idx].quantity_ordered) + delta))
      copy[idx] = { ...copy[idx], quantity_ordered: newQty }
      return copy
    })

  const setQtyDirect = (idx, raw) =>
    setLines((prev) => {
      const copy = [...prev]
      if (!copy[idx]) return prev
      const parsed = parseInt(raw, 10)
      copy[idx] = { ...copy[idx], quantity_ordered: Number.isFinite(parsed) && parsed > 0 ? parsed : 1 }
      return copy
    })

  const unaddedProducts = availableProducts.filter(
    (p) => !lines.some((l) => String(l.product_id) === String(p.product_id)),
  )

  const pickerFilteredProducts = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    if (!q) return unaddedProducts
    return unaddedProducts.filter((p) => (p.product_name || '').toLowerCase().includes(q))
  }, [unaddedProducts, pickerSearch])

  const lineTotal = (line) =>
    Math.round(Number(line.quantity_ordered)) * Math.round(Number(line.unit_price_clp))

  const grandTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0)

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!supplierId || !businessId) return
    const validLines = lines.filter((l) => l.product_id && Number(l.quantity_ordered) > 0)
    if (!validLines.length) { setError('Agrega al menos un producto con cantidad mayor a cero.'); return }
    setSubmitting(true)
    setError('')
    try {
      const body = {
        business_id: businessId,
        local_id: localId || undefined,
        supplier_id: supplierId,
        week_start_date: mondayOfWeekContaining(weekDate),
        items: validLines.map((l) => ({
          product_id: l.product_id,
          quantity_ordered: Math.round(Number(l.quantity_ordered)),
          unit_price_clp: Math.max(0, Math.round(Number(l.unit_price_clp) || 0)),
          line_notes: l.line_notes || undefined,
        })),
      }
      const created = await postWeeklyPurchaseOrder(body)
      onCreated(created)
      onClose()
    } catch (e) {
      setError(e?.message || 'No se pudo crear la orden.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectCls = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'
  const colTemplate = '1fr 128px 104px 88px 32px'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        className="max-w-2xl w-full flex flex-col overflow-hidden p-0"
        style={{ maxHeight: 'min(92vh, 820px)' }}
        onInteractOutside={(e) => {
          const original = e.detail?.originalEvent ?? e
          const target = original?.target
          if (target instanceof Element && target.closest('[data-calendar-panel="true"]')) e.preventDefault()
        }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays size={18} aria-hidden="true" />
            Nueva orden semanal
          </DialogTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Planificá la compra por semana y proveedor.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <form id="new-order-form" onSubmit={handleSubmit} className="flex flex-col gap-5 px-7 py-5">
            {error && (
              <div className="flex gap-2 items-start rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Week + supplier */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <ModernDateField
                  id="wp-new-order-week"
                  label="Semana de compra"
                  value={weekDate}
                  onChange={(iso) => setWeekDate(iso || weekDate)}
                />
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Se usará el lunes de esa semana.</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wp-modal-supplier">Proveedor</Label>
                <select id="wp-modal-supplier" value={supplierId} onChange={(ev) => setSupplierId(ev.target.value)} required disabled={loadingSup} className={selectCls}>
                  <option value="">{loadingSup ? 'Cargando…' : '— Seleccionar —'}</option>
                  {suppliers.map((s) => <option key={String(s.id)} value={String(s.id)}>{s.name || s.id}</option>)}
                </select>
              </div>
            </div>

            {/* Products section */}
            {supplierId && (
              <div className="flex flex-col gap-3">

                {/* Row: title + add button */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Productos del pedido</h3>
                    {lines.length > 0 && (
                      <Badge variant="secondary">{lines.length} producto{lines.length === 1 ? '' : 's'}</Badge>
                    )}
                  </div>
                  {!loadingProducts && unaddedProducts.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPickerOpen((o) => !o)}
                      className="gap-1.5 shrink-0"
                    >
                      <Plus size={14} />
                      Agregar producto
                    </Button>
                  )}
                </div>

                {/* Loading */}
                {loadingProducts && (
                  <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent animate-spin" />
                    Cargando productos del proveedor…
                  </div>
                )}

                {/* Product picker — multi-select list */}
                {pickerOpen && unaddedProducts.length > 0 && (
                  <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[hsl(var(--muted)/0.4)] border-b border-[hsl(var(--border))]">
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                        Seleccionar productos ({unaddedProducts.length} disponibles)
                      </span>
                      <button
                        type="button"
                        onClick={() => { setPickerOpen(false); setPickerSelected(new Set()); setPickerSearch('') }}
                        aria-label="Cerrar selector"
                        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-0.5 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Search inside picker */}
                    {unaddedProducts.length > 4 && (
                      <div className="px-3 py-2 border-b border-[hsl(var(--border)/0.6)] bg-white">
                        <div className="relative">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                          <input
                            type="search"
                            placeholder="Buscar producto…"
                            value={pickerSearch}
                            onChange={(e) => setPickerSearch(e.target.value)}
                            autoComplete="off"
                            className="h-8 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary)/0.4)]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Select all row */}
                    {pickerFilteredProducts.length > 1 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--muted)/0.2)] border-b border-[hsl(var(--border)/0.4)]">
                        <input
                          type="checkbox"
                          id="picker-select-all"
                          checked={pickerFilteredProducts.length > 0 && pickerFilteredProducts.every((p) => pickerSelected.has(String(p.product_id)))}
                          onChange={toggleSelectAll}
                          className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                        />
                        <label htmlFor="picker-select-all" className="text-xs text-[hsl(var(--muted-foreground))] cursor-pointer select-none">
                          Seleccionar todos
                          {pickerSearch && ` (${pickerFilteredProducts.length} resultado${pickerFilteredProducts.length === 1 ? '' : 's'})`}
                        </label>
                      </div>
                    )}

                    {/* Product rows */}
                    <div className="max-h-52 overflow-y-auto divide-y divide-[hsl(var(--border)/0.4)] bg-white">
                      {pickerFilteredProducts.length === 0 ? (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-4">Sin resultados para "{pickerSearch}"</p>
                      ) : pickerFilteredProducts.map((p) => {
                        const pid = String(p.product_id)
                        const checked = pickerSelected.has(pid)
                        return (
                          <label
                            key={pid}
                            htmlFor={`picker-${pid}`}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors select-none ${checked ? 'bg-[hsl(var(--primary)/0.07)]' : 'hover:bg-[hsl(var(--accent)/0.5)]'}`}
                          >
                            <input
                              type="checkbox"
                              id={`picker-${pid}`}
                              checked={checked}
                              onChange={() => togglePickerProduct(pid)}
                              className="h-3.5 w-3.5 shrink-0 accent-[hsl(var(--primary))]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{p.product_name}</p>
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatMoneyClp(p.unit_price_clp)} / u.</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>

                    {/* Footer — confirm */}
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[hsl(var(--muted)/0.3)] border-t border-[hsl(var(--border))]">
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {pickerSelected.size === 0
                          ? 'Ningún producto seleccionado'
                          : `${pickerSelected.size} producto${pickerSelected.size === 1 ? '' : 's'} seleccionado${pickerSelected.size === 1 ? '' : 's'}`}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={pickerSelected.size === 0}
                        onClick={confirmPickerSelection}
                        className="gap-1.5"
                      >
                        <Plus size={13} />
                        Agregar seleccionados
                      </Button>
                    </div>
                  </div>
                )}

                {/* No products from supplier */}
                {!loadingProducts && availableProducts.length === 0 && (
                  <div className="flex gap-2 items-start rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-sm">Sin productos disponibles</strong>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        No hay productos en inventario ni historial para este proveedor.
                      </p>
                    </div>
                  </div>
                )}

                {/* Empty lines hint */}
                {!loadingProducts && lines.length === 0 && availableProducts.length > 0 && !pickerOpen && (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-2">
                    Usá <strong>Agregar producto</strong> para elegir qué pedir.
                  </p>
                )}

                {/* Lines table */}
                {lines.length > 0 && (
                  <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden">
                    {/* Header */}
                    <div
                      className="grid gap-2 px-3 py-2 bg-[hsl(var(--muted)/0.3)] border-b border-[hsl(var(--border))] text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide"
                      style={{ gridTemplateColumns: colTemplate }}
                    >
                      <span>Producto</span>
                      <span className="text-center">Cantidad</span>
                      <span className="text-right">Precio unit.</span>
                      <span className="text-right">Total</span>
                      <span />
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-[hsl(var(--border)/0.4)] bg-white">
                      {lines.map((line, idx) => (
                        <div
                          key={String(line.product_id)}
                          className="grid items-center gap-2 px-3 py-2.5"
                          style={{ gridTemplateColumns: colTemplate }}
                        >
                          {/* Name */}
                          <span className="text-sm font-medium truncate" title={line.product_name}>{line.product_name}</span>

                          {/* Qty stepper */}
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => changeQty(idx, -1)}
                              disabled={Number(line.quantity_ordered) <= 1}
                              aria-label="Disminuir cantidad"
                              className="w-7 h-7 flex items-center justify-center rounded-md border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--accent))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={line.quantity_ordered}
                              onChange={(ev) => setQtyDirect(idx, ev.target.value)}
                              aria-label={`Cantidad de ${line.product_name}`}
                              className="w-12 h-7 text-center rounded-md border border-[hsl(var(--border))] bg-white text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary)/0.5)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => changeQty(idx, 1)}
                              aria-label="Aumentar cantidad"
                              className="w-7 h-7 flex items-center justify-center rounded-md border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--accent))] transition-colors"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          {/* Unit price — readonly */}
                          <span className="text-sm text-right text-[hsl(var(--muted-foreground))] select-none">
                            {formatMoneyClp(line.unit_price_clp)}
                          </span>

                          {/* Line total */}
                          <span className="text-sm text-right font-semibold">
                            {formatMoneyClp(lineTotal(line))}
                          </span>

                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            aria-label={`Eliminar ${line.product_name}`}
                            className="flex items-center justify-center w-7 h-7 rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Grand total */}
                    <div
                      className="grid items-center gap-2 px-3 py-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)]"
                      style={{ gridTemplateColumns: colTemplate }}
                    >
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide col-span-3 text-right">Total pedido</span>
                      <span className="text-sm font-bold text-right text-[hsl(var(--primary))]">{formatMoneyClp(grandTotal)}</span>
                      <span />
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="new-order-form" disabled={submitting || !supplierId || lines.length === 0}>
            {submitting ? 'Creando…' : 'Crear borrador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Página principal ────────────────────────────────────────── */
function WeeklyPurchasesPage() {
  const { isInventoryAdmin: canAccess } = useAuth()
  const navigate = useNavigate()
  const { localId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedLocal = useSelectedLocal(localId)

  const [businessId, setBusinessId] = useState(null)
  const [businessIdLoading, setBusinessIdLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filterWeek, setFilterWeek] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [suppliers, setSuppliers] = useState([])
  const [supplierNames, setSupplierNames] = useState({})

  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  const [newModalOpen, setNewModalOpen] = useState(false)

  const [supplierSearchInput, setSupplierSearchInput] = useState(() => searchParams.get('search') || '')
  const [supplierSearchDebounced, setSupplierSearchDebounced] = useState(() => searchParams.get('search') || '')
  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState(() => searchParams.get('category') || '')
  const [supplierCategoryOptions, setSupplierCategoryOptions] = useState([])

  useEffect(() => {
    const id = setTimeout(() => setSupplierSearchDebounced(String(supplierSearchInput || '').trim()), SUPPLIER_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [supplierSearchInput])

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      supplierSearchDebounced ? next.set('search', supplierSearchDebounced) : next.delete('search')
      supplierCategoryFilter ? next.set('category', supplierCategoryFilter) : next.delete('category')
      return next
    }, { replace: true })
  }, [supplierSearchDebounced, supplierCategoryFilter, setSearchParams])

  const resolveBusiness = useLocalBusinessId(localId)

  const loadOrders = useCallback(async () => {
    if (!canAccess || !businessId) { setOrders([]); setLoading(false); return }
    setError('')
    setLoading(true)
    try {
      const filters = {}
      if (filterWeek) filters.week_start = mondayOfWeekContaining(filterWeek)
      if (filterSupplier) filters.supplier_id = filterSupplier
      if (filterStatus) filters.status = filterStatus
      const rows = await getWeeklyPurchaseOrders(businessId, filters)
      setOrders(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setOrders([])
      setError(e?.message || 'No se pudieron cargar las órdenes.')
    } finally {
      setLoading(false)
    }
  }, [businessId, canAccess, filterWeek, filterSupplier, filterStatus])

  useEffect(() => {
    if (!canAccess || !localId) { setBusinessId(null); setBusinessIdLoading(false); return }
    setBusinessIdLoading(true)
    let cancelled = false
    ;(async () => {
      try {
        const bid = await resolveBusiness()
        if (!cancelled) setBusinessId(bid)
      } catch {
        if (!cancelled) setBusinessId(null)
      } finally {
        if (!cancelled) setBusinessIdLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [localId, canAccess, resolveBusiness])

  useEffect(() => { loadOrders() }, [loadOrders])

  useEffect(() => {
    if (!businessId || !canAccess) { setSupplierCategoryOptions([]); return }
    let cancelled = false
    ;(async () => {
      try {
        const rows = await getSuppliersWithMetricsForBusiness(businessId)
        if (cancelled) return
        const set = new Set()
        for (const r of Array.isArray(rows) ? rows : []) {
          const c = r.category && String(r.category).trim()
          if (c) set.add(c)
        }
        setSupplierCategoryOptions([...set].sort((a, b) => a.localeCompare(b, 'es')))
      } catch {
        if (!cancelled) setSupplierCategoryOptions([])
      }
    })()
    return () => { cancelled = true }
  }, [businessId, canAccess])

  useEffect(() => {
    if (!businessId || !canAccess) { setSuppliers([]); setSupplierNames({}); return }
    let cancelled = false
    ;(async () => {
      try {
        const filters = {}
        if (supplierSearchDebounced) filters.search = supplierSearchDebounced
        if (supplierCategoryFilter) filters.category = supplierCategoryFilter
        const rows = await getSuppliersWithMetricsForBusiness(businessId, filters)
        const list = Array.isArray(rows) ? rows : []
        if (cancelled) return
        setSuppliers(list)
        setSupplierNames((prev) => {
          const next = { ...prev }
          for (const r of list) if (r.id) next[String(r.id)] = r.name || String(r.id)
          return next
        })
      } catch {
        if (!cancelled) setSuppliers([])
      }
    })()
    return () => { cancelled = true }
  }, [businessId, canAccess, supplierSearchDebounced, supplierCategoryFilter])

  useEffect(() => {
    if (!filterSupplier) return
    if (!suppliers.some((s) => String(s.id) === String(filterSupplier))) setFilterSupplier('')
  }, [suppliers, filterSupplier])

  const loadReport = async () => {
    if (!businessId) return
    setReportLoading(true)
    setReportError('')
    try {
      const data = await getWeeklyPurchaseComparisonReport(
        businessId,
        mondayOfWeekContaining(reportFrom),
        mondayOfWeekContaining(reportTo),
      )
      setReportData(data)
    } catch (e) {
      setReportData(null)
      setReportError(e?.message || 'No se pudo cargar el reporte.')
    } finally {
      setReportLoading(false)
    }
  }

  const openDetail = (orderId) =>
    navigate(`/local/${localId}/inventario/compras-semanales/${orderId}`, { state: { local: selectedLocal } })

  const selectCls = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'

  return (
    <InventoryShell>
      <div className="flex flex-col gap-6 px-6 py-6 pb-10">

        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
              <CalendarDays size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Órdenes de compra semanales</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                Planificá la compra por semana y proveedor, seguí el estado de cada orden.
              </p>
            </div>
          </div>
          {canAccess && !businessIdLoading && businessId && (
            <Button type="button" onClick={() => setNewModalOpen(true)} className="gap-1.5 shrink-0">
              <Plus size={16} />
              Nueva orden semanal
            </Button>
          )}
        </header>

        {!canAccess && (
          <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            No tienes permisos para acceder a esta sección.
          </p>
        )}

        {canAccess && businessIdLoading && <LoadingSpinner message="Cargando datos del local…" />}

        {canAccess && !businessIdLoading && !businessId && (
          <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
            No se pudo determinar el negocio del local.
          </p>
        )}

        {canAccess && !businessIdLoading && businessId && (
          <>
            {/* Filtros — todos en una sola Card */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
                  {/* Buscar proveedor */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--foreground))]">Buscar proveedor</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                      <input
                        type="search"
                        value={supplierSearchInput}
                        onChange={(ev) => setSupplierSearchInput(ev.target.value)}
                        placeholder="Nombre…"
                        autoComplete="off"
                        className="h-9 w-full rounded-md border border-[hsl(var(--border))] bg-white pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                      />
                    </div>
                  </div>

                  {/* Filtrar por semana */}
                  <div className="flex flex-col gap-1.5">
                    <ModernDateField
                      id="wp-filter-week"
                      label="Semana (lunes)"
                      value={filterWeek}
                      onChange={(iso) => setFilterWeek(iso || '')}
                    />
                  </div>

                  {/* Proveedor de la orden */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--foreground))]">Proveedor</label>
                    <select value={filterSupplier} onChange={(ev) => setFilterSupplier(ev.target.value)} className={selectCls}>
                      <option value="">Todos</option>
                      {suppliers.map((s) => <option key={String(s.id)} value={String(s.id)}>{s.name || s.id}</option>)}
                    </select>
                  </div>

                  {/* Estado */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--foreground))]">Estado</label>
                    <select value={filterStatus} onChange={(ev) => setFilterStatus(ev.target.value)} className={selectCls}>
                      <option value="">Todos</option>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>

                  {/* Categoría */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--foreground))]">Categoría</label>
                    <select value={supplierCategoryFilter} onChange={(ev) => setSupplierCategoryFilter(ev.target.value)} className={selectCls}>
                      <option value="">Todas</option>
                      {supplierCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error / listado */}
            {error && (
              <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">{error}</p>
            )}

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Listado de órdenes</CardTitle>
                    {!loading && (
                      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                        {orders.length} orden{orders.length === 1 ? '' : 'es'} encontrada{orders.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => loadOrders()} aria-label="Actualizar listado" className="gap-1.5 shrink-0">
                    <RefreshCw size={14} />
                    Actualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-0 pb-0">
                {loading ? (
                  <div className="py-8"><LoadingSpinner message="Cargando órdenes…" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Semana (lunes)</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Total estimado</TableHead>
                          <TableHead>Total recibido</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-[hsl(var(--muted-foreground))] py-10">
                              No hay órdenes con los filtros actuales.
                            </TableCell>
                          </TableRow>
                        ) : (
                          orders.map((o) => (
                            <TableRow key={String(o.id)} className="cursor-pointer hover:bg-[hsl(var(--accent)/0.5)]" onClick={() => openDetail(o.id)}>
                              <TableCell className="font-medium">{formatWeekLong(o.week_start_date)}</TableCell>
                              <TableCell>{supplierNames[String(o.supplier_id)] || o.supplier_id || '—'}</TableCell>
                              <TableCell>
                                <Badge variant={STATUS_VARIANT[o.status] ?? 'secondary'}>
                                  {STATUS_LABELS[o.status] || o.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatMoneyClp(o.total_estimated_clp)}</TableCell>
                              <TableCell>{formatReceivedCell(o)}</TableCell>
                              <TableCell>
                                <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDetail(o.id) }}>
                                  Ver detalle →
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reporte comparativo */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                    <BarChart2 size={18} />
                  </span>
                  <div>
                    <CardTitle className="text-base">Reporte comparativo</CardTitle>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Comparación de órdenes entre rangos de semanas</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <ModernDateField
                    id="wp-report-from"
                    label="Desde (lunes)"
                    value={reportFrom}
                    onChange={(iso) => setReportFrom(iso || '')}
                  />
                  <ModernDateField
                    id="wp-report-to"
                    label="Hasta (lunes)"
                    value={reportTo}
                    onChange={(iso) => setReportTo(iso || '')}
                  />
                  <Button type="button" onClick={loadReport} disabled={reportLoading} className="self-end">
                    {reportLoading ? 'Generando…' : 'Generar reporte'}
                  </Button>
                </div>

                {reportError && (
                  <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">{reportError}</p>
                )}

                {reportData && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">Por semana</p>
                      <div className="rounded-md border border-[hsl(var(--border))] overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Semana</TableHead>
                              <TableHead>Órdenes</TableHead>
                              <TableHead>Total estimado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(reportData.by_week || []).map((w) => (
                              <TableRow key={w.week_start_date}>
                                <TableCell>{w.week_start_date}</TableCell>
                                <TableCell>{w.orders_count}</TableCell>
                                <TableCell>{formatMoneyClp(w.total_estimated_clp)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">Por proveedor</p>
                      <div className="rounded-md border border-[hsl(var(--border))] overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Proveedor</TableHead>
                              <TableHead>Órdenes</TableHead>
                              <TableHead>Total estimado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(reportData.by_supplier || []).map((s) => (
                              <TableRow key={String(s.supplier_id)}>
                                <TableCell>{s.supplier_name}</TableCell>
                                <TableCell>{s.orders_count}</TableCell>
                                <TableCell>{formatMoneyClp(s.total_estimated_clp)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <NewWeeklyOrderModal
              open={newModalOpen}
              businessId={businessId}
              localId={localId}
              onClose={() => setNewModalOpen(false)}
              onCreated={() => loadOrders()}
              supplierSearchDebounced={supplierSearchDebounced}
              supplierCategoryFilter={supplierCategoryFilter}
            />
          </>
        )}
      </div>
    </InventoryShell>
  )
}

export default WeeklyPurchasesPage
