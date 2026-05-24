import { useState, useEffect } from 'react'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { useOrderManagement } from '../../hooks/useOrderManagement'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const LoadingSpinner = () => (
  <div className="flex flex-col items-center gap-2 py-8 text-[hsl(var(--muted-foreground))]">
    <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
    <p className="text-sm">Cargando...</p>
  </div>
)

export default function MesaDetailModal({ mesa, localId, onClose, onTableUpdated }) {
  const { detail, loading: detailLoading, error: detailError, refresh } = useMesaDetail(mesa.id)
  const { data: menuData, loading: menuLoading, fetch: fetchMenu } = useMenuPOS(localId)
  const { createOrder, updateOrderStatus, loading: orderLoading, error: orderError } = useOrderManagement()

  const [selectedProducts, setSelectedProducts] = useState({})
  const [showAddProductForm, setShowAddProductForm] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (showAddProductForm && !menuData) {
      fetchMenu({})
    }
  }, [showAddProductForm, menuData, fetchMenu])

  const calculateTotal = () => {
    if (!detail?.active_orders || detail.active_orders.length === 0) return 0
    return detail.active_orders.reduce((sum, order) => {
      const orderTotal = (order.items || []).reduce((orderSum, item) => orderSum + item.total_price, 0)
      return sum + orderTotal
    }, 0)
  }

  const handleProductQtyChange = (productId, quantity) => {
    if (quantity <= 0) {
      const newSelected = { ...selectedProducts }
      delete newSelected[productId]
      setSelectedProducts(newSelected)
    } else {
      setSelectedProducts(prev => ({ ...prev, [productId]: quantity }))
    }
  }

  const handleAddProducts = async () => {
    if (Object.keys(selectedProducts).length === 0) {
      alert('Selecciona al menos un producto')
      return
    }

    try {
      setIsProcessingPayment(true)

      const items = Object.entries(selectedProducts).map(([productId, quantity]) => {
        const product = (menuData?.products || []).find(p => String(p.id) === String(productId))
        return {
          product_id: productId,
          quantity,
          unit_price: product?.price || 0,
        }
      })

      const orderData = {
        local_id: localId,
        mesa_id: mesa.id,
        source: 'dine-in',
        payment_method: 'CASH',
        items,
      }

      await createOrder(orderData)
      setSuccessMessage('✓ Productos agregados a la orden')
      setSelectedProducts({})
      setShowAddProductForm(false)
      refresh()
      setTimeout(() => setSuccessMessage(''), 2000)
    } catch (err) {
      console.error('Error adding products:', err)
      alert(`Error: ${err.message || 'No se pudieron agregar los productos'}`)
    } finally {
      setIsProcessingPayment(false)
    }
  }

  const handleProceedToPayment = async () => {
    if (!detail?.active_orders || detail.active_orders.length === 0) {
      alert('No hay órdenes para procesar')
      return
    }

    if (!window.confirm('¿Confirmar pago y cerrar la mesa?')) return

    try {
      setIsProcessingPayment(true)

      for (const order of detail.active_orders) {
        await updateOrderStatus(order.id, 'completed')
      }

      setSuccessMessage('✓ Mesa cerrada - Pago procesado')
      setTimeout(() => {
        onTableUpdated?.()
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Error processing payment:', err)
      alert(`Error: ${err.message || 'Error procesando pago'}`)
    } finally {
      setIsProcessingPayment(false)
    }
  }

  if (detailLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <LoadingSpinner />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mesa.name}
            <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">
              {mesa.zona || 'General'} • {mesa.capacidad} personas
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Messages */}
        {successMessage && (
          <div className="px-1 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            {successMessage}
          </div>
        )}
        {detailError && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-[hsl(var(--destructive))]">
            Error: {detailError}
          </div>
        )}
        {orderError && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-[hsl(var(--destructive))]">
            Error: {orderError}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Órdenes actuales */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Órdenes Actuales</h3>
            {!detail?.active_orders || detail.active_orders.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay órdenes en esta mesa</p>
            ) : (
              <div className="space-y-3">
                {detail.active_orders.map((order, idx) => (
                  <div key={order.id} className="border border-[hsl(var(--border))] rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[hsl(var(--primary))] text-white text-xs w-5 h-5 flex items-center justify-center p-0 rounded-full">
                          {idx + 1}
                        </Badge>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{order.status}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {(order.items || []).map(item => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-[hsl(var(--foreground))]">{item.product_name}</span>
                          <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                            <span>{item.quantity}x</span>
                            <span className="font-medium text-[hsl(var(--foreground))]">${item.total_price}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Formulario agregar productos */}
          {showAddProductForm && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Agregar Productos</h3>
              {menuLoading ? (
                <LoadingSpinner />
              ) : !menuData?.products || menuData.products.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay productos disponibles</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto border border-[hsl(var(--border))] rounded-lg p-2">
                  {menuData.products.map(product => (
                    <div key={product.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
                      <div>
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{product.name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">${product.price}</p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="99"
                        value={selectedProducts[product.id] || 0}
                        onChange={e => handleProductQtyChange(product.id, parseInt(e.target.value) || 0)}
                        className="w-16 h-7 text-xs text-center"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between px-1 py-2 border-t border-[hsl(var(--border))]">
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">Total:</span>
          <span className="text-lg font-bold text-[hsl(var(--primary))]">${calculateTotal()}</span>
        </div>

        {/* Actions */}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddProductForm(!showAddProductForm)}
            disabled={isProcessingPayment}
          >
            {showAddProductForm ? 'Cancelar' : '+ Agregar Productos'}
          </Button>

          {showAddProductForm && (
            <Button
              size="sm"
              onClick={handleAddProducts}
              disabled={isProcessingPayment || Object.keys(selectedProducts).length === 0}
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
            >
              {isProcessingPayment ? 'Procesando...' : 'Confirmar Productos'}
            </Button>
          )}

          {!showAddProductForm && (detail?.active_orders?.length > 0) && (
            <Button
              size="sm"
              onClick={handleProceedToPayment}
              disabled={isProcessingPayment}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isProcessingPayment ? 'Procesando...' : '💳 Proceder a Pago'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
