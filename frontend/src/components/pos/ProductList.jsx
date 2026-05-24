import { useState } from 'react'
import { useOrderItems } from '../../hooks/useOrderItems'
import { formatCLP } from '../../lib/formatCLP'
import ProductDetailModal from './ProductDetailModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Lista de productos de la orden con edición de cantidad/precio y detalle. */
export default function ProductList({ products = [], orderId = null, onProductsChanged = null, className = '' }) {
  const { updateItem, deleteItem, loading, error } = useOrderItems(orderId)
  const [editingId, setEditingId] = useState(null)
  const [editQuantity, setEditQuantity] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [localError, setLocalError] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)

  if (!products || products.length === 0) {
    return (
      <div className={cn('py-4 text-center', className)}>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay productos</p>
      </div>
    )
  }

  const validateProduct = (product) => {
    const hasName = !!product.product_name
    const hasQuantity = product.quantity > 0
    const hasPrice = product.unit_price > 0 && product.total_price > 0
    const priceConsistent = Math.abs(product.quantity * product.unit_price - product.total_price) < 0.01

    return {
      isValid: hasName && hasQuantity && hasPrice && priceConsistent,
      hasName,
      hasQuantity,
      hasPrice,
      priceConsistent,
    }
  }

  const handleEditStart = (product) => {
    setEditingId(product.id)
    setEditQuantity(product.quantity.toString())
    setEditPrice(product.unit_price.toString())
    setLocalError(null)
  }

  const handleEditSave = async (product) => {
    setLocalError(null)

    if (!editQuantity || editQuantity <= 0) {
      setLocalError('Cantidad debe ser mayor a 0')
      return
    }

    if (!editPrice || editPrice <= 0) {
      setLocalError('Precio debe ser mayor a 0')
      return
    }

    const success = await updateItem(product.id, parseInt(editQuantity), parseFloat(editPrice))
    if (success) {
      setEditingId(null)
      if (onProductsChanged) onProductsChanged()
    }
  }

  const handleDelete = async (product) => {
    if (window.confirm(`¿Eliminar ${product.product_name}?`)) {
      const success = await deleteItem(product.id)
      if (success) {
        if (onProductsChanged) onProductsChanged()
      }
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
        <span>Producto</span>
        <span className="text-right">Cant.</span>
        <span className="text-right">P. Unit</span>
        <span className="text-right">Total</span>
        <span className="text-right">Acc.</span>
      </div>

      <ul className="space-y-1">
        {products.map((product, index) => {
          const validation = validateProduct(product)
          const isEditing = editingId === product.id

          return (
            <li
              key={product.id || index}
              className={cn(
                'grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center px-2 py-1.5 rounded-lg text-sm',
                !validation.isValid && 'bg-orange-50 border border-orange-200',
                isEditing && 'bg-[hsl(var(--accent))]',
                !isEditing && !(!validation.isValid) && 'hover:bg-[hsl(var(--accent))]/50',
              )}
              data-product-id={product.id}
            >
              {/* Nombre */}
              <div
                className={cn(
                  'flex items-center gap-1 min-w-0',
                  !isEditing && 'cursor-pointer',
                )}
                onClick={() => !isEditing && setSelectedProduct(product)}
                title="Ver detalle del producto"
                role={!isEditing ? 'button' : undefined}
                tabIndex={isEditing ? -1 : 0}
                onKeyDown={(e) => { if (!isEditing && (e.key === 'Enter' || e.key === ' ')) setSelectedProduct(product) }}
              >
                <span className="text-[hsl(var(--foreground))] font-medium truncate">
                  {product.product_name || 'Producto sin nombre'}
                </span>
                {!validation.hasName && (
                  <span className="text-orange-500 text-xs shrink-0" title="Sin nombre">⚠</span>
                )}
              </div>

              {/* Cantidad */}
              <div className="text-right">
                {isEditing ? (
                  <Input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-14 h-6 text-xs text-right"
                    disabled={loading}
                  />
                ) : (
                  <span className={cn('text-xs', !validation.hasQuantity && 'text-orange-500')}>
                    {validation.hasQuantity ? `x${product.quantity}` : '—'}
                  </span>
                )}
              </div>

              {/* Precio unitario */}
              <div className="text-right">
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-20 h-6 text-xs text-right"
                    disabled={loading}
                  />
                ) : (
                  <span className={cn('text-xs', !validation.hasPrice && 'text-orange-500')}>
                    ${formatCLP(product.unit_price || 0)}
                  </span>
                )}
              </div>

              {/* Total */}
              <div className="text-right">
                <span className={cn('text-xs font-medium', !validation.priceConsistent && 'text-orange-500')}>
                  ${formatCLP(product.total_price || 0)}
                </span>
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-0.5">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => handleEditSave(product)}
                      disabled={loading}
                      className="w-6 h-6 flex items-center justify-center rounded text-green-600 hover:bg-green-100 text-xs transition-colors disabled:opacity-50"
                      title="Guardar cambios"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={loading}
                      className="w-6 h-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] text-xs transition-colors disabled:opacity-50"
                      title="Cancelar"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEditStart(product)}
                      disabled={loading}
                      className="w-6 h-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] text-xs transition-colors disabled:opacity-50"
                      title="Editar"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      disabled={loading}
                      className="w-6 h-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] hover:bg-red-50 text-xs transition-colors disabled:opacity-50"
                      title="Eliminar"
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* Error */}
      {(localError || error) && (
        <p className="text-xs text-[hsl(var(--destructive))] bg-red-50 border border-red-200 rounded px-3 py-2">
          {localError || error}
        </p>
      )}

      {/* Warning consistencia */}
      {products.some((p) => !validateProduct(p).isValid) && (
        <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-3 py-2">
          ⚠ Algunos productos tienen datos inconsistentes
        </p>
      )}

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  )
}
