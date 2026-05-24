import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { formatCLP } from '../../lib/formatCLP'
import { apiRequest } from '../../lib/apiClient'
import ProductList from './ProductList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const EXTRAS_DISPONIBLES = [
  'Pan', 'Ketchup', 'Mostaza', 'Mayonesa',
  'Aceite', 'Sal', 'Pimienta', 'Mantequilla',
  'Servilletas', 'Cubiertos',
]

export default function MesaDetail() {
  const navigate = useNavigate()
  const { mesaId, localId } = useParams()
  const { detail, loading, error, refresh } = useMesaDetail(mesaId)
  const { data: menuData, fetch: fetchMenu } = useMenuPOS(localId)

  const [agregados, setAgregados] = useState({})
  const [showPicker, setShowPicker] = useState(false)
  const [pickerOrderId, setPickerOrderId] = useState(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [addingProduct, setAddingProduct] = useState(false)
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    fetchMenu()
  }, [fetchMenu])

  useEffect(() => {
    if (!showPicker) return
    const id = setTimeout(() => {
      fetchMenu({ search: pickerSearch.trim() || undefined })
    }, 300)
    return () => clearTimeout(id)
  }, [pickerSearch, showPicker, fetchMenu])

  const agregarExtra = (nombre) =>
    setAgregados((prev) => ({ ...prev, [nombre]: (prev[nombre] || 0) + 1 }))
  const quitarExtra = (nombre) =>
    setAgregados((prev) => {
      const n = { ...prev }
      if (n[nombre] <= 1) delete n[nombre]
      else n[nombre] -= 1
      return n
    })
  const limpiarExtras = () => setAgregados({})

  const handleOpenPicker = (orderId = null) => {
    setPickerOrderId(orderId)
    setAddError(null)
    setPickerSearch('')
    fetchMenu()
    setShowPicker(true)
  }

  const handleAddProduct = useCallback(async (product) => {
    setAddingProduct(true)
    setAddError(null)
    try {
      let orderId = pickerOrderId

      if (!orderId) {
        const newOrder = await apiRequest('/orders', {
          method: 'POST',
          body: {
            local_id: localId,
            mesa_id: mesaId,
            source: 'dine-in',
            payment_method: 'CASH',
            items: [],
          },
        })
        orderId = newOrder.id
      }

      await apiRequest(`/orders/${orderId}/items`, {
        method: 'POST',
        body: {
          product_id: product.id,
          quantity: 1,
          unit_price: product.price,
        },
      })

      setShowPicker(false)
      setPickerSearch('')
      fetchMenu()
      await refresh()
    } catch (err) {
      setAddError(err.message || 'Error al agregar producto')
    } finally {
      setAddingProduct(false)
    }
  }, [pickerOrderId, localId, mesaId, refresh, fetchMenu])

  const pickerMenu = (menuData?.categories || []).filter((cat) => (cat.products?.length || 0) > 0)
  const handleGoBack = () => navigate(`/local/${localId}/pos`)

  // ── Loading / Error states ────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
      <div className="flex flex-col items-center gap-2 text-[hsl(var(--muted-foreground))]">
        <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Cargando detalle de mesa...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
      <div className="text-center space-y-3">
        <p className="text-sm text-[hsl(var(--destructive))]">Error: {error}</p>
        <Button variant="outline" size="sm" onClick={() => navigate(`/local/${localId}/pos`)}>Volver</Button>
      </div>
    </div>
  )

  if (!detail) return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
      <div className="flex flex-col items-center gap-3 text-[hsl(var(--muted-foreground))]">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 opacity-30">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c.866-1.5 2.926-5.231 9.303-6.622m0 0a27.047 27.047 0 015.897 6.622M12 12.75c2.613 0 4.859-1.354 5.573-3.423" />
        </svg>
        <p className="font-medium">Esta mesa está vacía</p>
        <p className="text-xs">Sin órdenes activas</p>
        <Button variant="outline" size="sm" onClick={() => navigate(`/local/${localId}/pos`)}>Volver</Button>
      </div>
    </div>
  )

  const { mesa, active_orders, total_products, total_value } = detail

  if (!mesa) return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
      <div className="text-center space-y-3">
        <p className="text-sm text-[hsl(var(--destructive))]">Mesa no encontrada.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(`/local/${localId}/pos`)}>Volver</Button>
      </div>
    </div>
  )

  const hasOrders = active_orders && active_orders.length > 0
  const agregadosActivos = Object.entries(agregados)

  return (
    <main className="min-h-screen bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-4 px-4 lg:px-6 h-14 bg-white border-b border-[hsl(var(--border))]">
        <button
          className="flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
          onClick={handleGoBack}
        >
          ← Volver
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-[hsl(var(--foreground))] leading-none truncate">
            {mesa.name || `Mesa ${mesa.numero}`}
          </h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{mesa.zona || 'General'}</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 space-y-6">
        {/* Info básica */}
        <section className="grid grid-cols-3 gap-3">
          {[
            { label: 'Capacidad', value: `${mesa.capacidad || 4} personas` },
            { label: 'Estado', value: getStateName(mesa.state), highlight: true },
            { label: 'Tipo', value: mesa.is_delivery ? 'Delivery' : 'Dine-In' },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="bg-white rounded-xl border border-[hsl(var(--border))] p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">{label}</p>
              <p className={`text-sm font-semibold ${highlight ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--foreground))]'}`}>
                {value}
              </p>
            </div>
          ))}
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3">
          <article className="bg-white rounded-xl border border-[hsl(var(--border))] p-4 flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shrink-0">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-5 h-5">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-[hsl(var(--foreground))]">{total_products}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Productos</p>
            </div>
          </article>
          <article className="bg-white rounded-xl border border-[hsl(var(--border))] p-4 flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-green-100 text-green-700 shrink-0">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-5 h-5">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 7v5M9.5 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-[hsl(var(--foreground))]">${formatCLP(total_value)}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Valor Total</p>
            </div>
          </article>
        </section>

        {/* Órdenes + Agregados */}
        <section className="bg-white rounded-xl border border-[hsl(var(--border))] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Órdenes Activas</h2>
            <Button
              size="sm"
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
              onClick={() => handleOpenPicker(hasOrders ? active_orders[0]?.id : null)}
            >
              + Agregar Producto
            </Button>
          </div>

          {hasOrders ? (
            <div className="space-y-3">
              {active_orders.map((order) => (
                <article key={order.id} className={`border border-[hsl(var(--border))] rounded-lg overflow-hidden`}>
                  <div className="flex items-center justify-between px-3 py-2 bg-[hsl(var(--accent))]">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-[hsl(var(--primary))] text-white text-xs">{getOrderStatusLabel(order.status)}</Badge>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">{getPaymentLabel(order.payment_method)}</span>
                    </div>
                    <span className="text-sm font-semibold text-[hsl(var(--foreground))]">${formatCLP(order.total)}</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Productos</p>
                    <ProductList products={order.items || []} orderId={order.id} onProductsChanged={refresh} />
                  </div>
                  <div className="px-3 py-2 border-t border-[hsl(var(--border))] text-right">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">Subtotal: ${formatCLP(order.subtotal)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-[hsl(var(--muted-foreground))]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-30">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c.866-1.5 2.926-5.231 9.303-6.622m0 0a27.047 27.047 0 015.897 6.622M12 12.75c2.613 0 4.859-1.354 5.573-3.423" />
              </svg>
              <p className="text-sm font-medium">Mesa libre</p>
              <p className="text-xs">Agrega un producto para iniciar la atención</p>
            </div>
          )}

          {/* Agregados */}
          <div className="border-t border-[hsl(var(--border))] pt-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Agregados de la Mesa</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Extras sin costo entregados en la mesa</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXTRAS_DISPONIBLES.map((nombre) => (
                <button
                  key={nombre}
                  className="px-3 py-1 text-xs rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/5 transition-colors"
                  onClick={() => agregarExtra(nombre)}
                >
                  + {nombre}
                </button>
              ))}
            </div>
            {agregadosActivos.length > 0 ? (
              <div className="space-y-2">
                {agregadosActivos.map(([nombre, cantidad]) => (
                  <div key={nombre} className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--accent))]">
                    <span className="text-sm text-[hsl(var(--foreground))]">{nombre}</span>
                    <div className="flex items-center gap-1">
                      <button
                        className="w-6 h-6 flex items-center justify-center rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] text-sm"
                        onClick={() => quitarExtra(nombre)}
                      >
                        −
                      </button>
                      <span className="text-xs font-medium w-8 text-center">x{cantidad}</span>
                      <button
                        className="w-6 h-6 flex items-center justify-center rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] text-sm"
                        onClick={() => agregarExtra(nombre)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className="text-xs text-[hsl(var(--destructive))] hover:underline"
                  onClick={limpiarExtras}
                >
                  Limpiar todo
                </button>
              </div>
            ) : (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Ningún agregado registrado aún.</p>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="sticky bottom-0 px-4 lg:px-6 py-3 bg-white border-t border-[hsl(var(--border))]">
        <Button variant="outline" size="sm" onClick={handleGoBack}>
          ← Volver a Visualización
        </Button>
      </footer>

      {/* Product Picker Modal */}
      <Dialog
        open={showPicker}
        onOpenChange={(open) => {
          if (!open) {
            setShowPicker(false)
            setPickerSearch('')
            fetchMenu()
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[75vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Seleccionar Producto</DialogTitle>
          </DialogHeader>

          <Input
            type="text"
            placeholder="Buscar producto..."
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            autoFocus
            className="h-9"
          />

          {addError && (
            <p className="text-xs text-[hsl(var(--destructive))] bg-red-50 border border-red-200 rounded px-3 py-2">
              {addError}
            </p>
          )}

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {pickerMenu.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-6">Sin resultados</p>
            ) : (
              pickerMenu.map((cat) => (
                <div key={cat.id} className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] px-1">
                    {cat.name}
                  </p>
                  <div className="rounded-lg border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
                    {cat.products.map((product) => (
                      <button
                        key={product.id}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-[hsl(var(--accent))] transition-colors text-left disabled:opacity-50"
                        onClick={() => handleAddProduct(product)}
                        disabled={addingProduct}
                      >
                        <span className="font-medium text-[hsl(var(--foreground))]">{product.name}</span>
                        <span className="text-[hsl(var(--primary))] font-semibold shrink-0 ml-4">${formatCLP(product.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {addingProduct && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">Agregando...</p>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}

function getStateName(state) {
  return { libre: 'Libre', ocupada: 'Ocupada', en_cobro: 'En Cobro', inactiva: 'Inactiva' }[state] || 'Desconocido'
}
function getOrderStatusLabel(status) {
  return { pending: 'Pendiente', PENDING: 'Pendiente', in_progress: 'En Progreso', PREPARING: 'Preparando', ready: 'Listo', READY: 'Listo', delivered: 'Entregado', COMPLETED: 'Completado', cancelled: 'Cancelado' }[status] || status
}
function getPaymentLabel(method) {
  return { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', CASH: 'Efectivo', DEBIT: 'Débito', CREDIT: 'Crédito' }[method] || method
}
