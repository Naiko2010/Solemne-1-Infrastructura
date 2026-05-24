import { formatCLP } from '../../lib/formatCLP'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

/** Modal de detalle: descripción, añadidos parseados desde el texto y precios. */
export default function ProductDetailModal({ product, onClose }) {
  if (!product) return null

  const { baseDescription, anyadidos } = parseDescription(product.product_description || '')

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm" aria-label={`Detalle de ${product.product_name}`}>
        <DialogHeader>
          <DialogTitle>{product.product_name || 'Producto'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Descripción */}
          <section className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Descripción</p>
            <p className="text-sm text-[hsl(var(--foreground))]">
              {baseDescription || 'Sin descripción'}
            </p>
          </section>

          <Separator />

          {/* Añadidos */}
          <section className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Añadidos</p>
            {anyadidos.length > 0 ? (
              <ul className="space-y-1">
                {anyadidos.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[hsl(var(--foreground))]">
                    <span className="w-4 h-4 flex items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-bold shrink-0">+</span>
                    {item.trim()}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin añadidos</p>
            )}
          </section>

          <Separator />

          {/* Precios */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">Precio unitario</span>
              <span className="font-medium">${formatCLP(product.unit_price)}</span>
            </div>
            {product.quantity > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">Cantidad</span>
                <span className="font-medium">×{product.quantity}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Precio total</span>
              <span className="text-[hsl(var(--primary))]">${formatCLP(product.total_price)}</span>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Separa descripción base y lista de añadidos tras "Añadidos:".
 */
function parseDescription(description) {
  if (!description) return { baseDescription: '', anyadidos: [] }

  const marker = /añadidos?:/i
  const match = description.match(marker)

  if (!match) {
    return { baseDescription: description.trim(), anyadidos: [] }
  }

  const splitIndex = description.search(marker)
  const baseDescription = description.slice(0, splitIndex).trim().replace(/\.$/, '')
  const anyadidosRaw = description.slice(splitIndex + match[0].length).trim().replace(/\.$/, '')
  const anyadidos = anyadidosRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return { baseDescription, anyadidos }
}
