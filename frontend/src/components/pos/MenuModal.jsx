import { useEffect, useState, useMemo } from 'react'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { formatCLP } from '../../lib/formatCLP'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/**
 * Modal del menú: KPIs por categoría, búsqueda con debounce y filtro de categoría en cliente.
 */
export default function MenuModal({ localId, onClose }) {
  const { data, loading, error, fetch } = useMenuPOS(localId)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('all')

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    fetch({ search: debouncedSearch })
  }, [fetch, debouncedSearch])

  const filteredCategories = useMemo(() => {
    if (!data?.categories) return []
    return data.categories
      .filter((cat) => selectedCat === 'all' || cat.id === selectedCat)
      .filter((cat) => (cat.products?.length || 0) > 0)
  }, [data, selectedCat])

  const totalVisible = filteredCategories.reduce((sum, c) => sum + c.products.length, 0)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-5 h-5 text-[hsl(var(--primary))]">
              <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Menú
            {data && (
              <Badge className="ml-1 bg-[hsl(var(--primary))] text-white">{data.total_products} productos</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Chips por categoría */}
        {data?.categories?.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-1" role="list" aria-label="Filtrar por categoría">
            <button
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                selectedCat === 'all'
                  ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]'
              }`}
              onClick={() => setSelectedCat('all')}
            >
              Todos <span className="ml-1 opacity-70">{data.total_products}</span>
            </button>
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  selectedCat === cat.id
                    ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]'
                    : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]'
                }`}
                onClick={() => setSelectedCat(selectedCat === cat.id ? 'all' : cat.id)}
              >
                {cat.name} <span className="ml-1 opacity-70">{cat.product_count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Búsqueda y filtro */}
        {data && !loading && !error && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <Input
                className="pl-8 h-8 text-sm"
                type="text"
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar producto por nombre"
              />
            </div>
            <select
              className="h-8 text-xs rounded-md border border-[hsl(var(--border))] bg-white px-2 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30"
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              aria-label="Filtrar por categoría"
            >
              <option value="all">Todas las categorías</option>
              {data.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading && (
            <div className="flex flex-col items-center gap-2 py-8 text-[hsl(var(--muted-foreground))]">
              <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" aria-label="Cargando..." />
              <p className="text-sm">Cargando menú...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-[hsl(var(--destructive))] flex flex-col items-start gap-2">
              <p>Error al cargar el menú: {error}</p>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => fetch({ search: debouncedSearch })}
              >
                Reintentar
              </Button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {filteredCategories.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
                  {search ? `Sin resultados para "${search}"` : 'No hay productos disponibles.'}
                </p>
              ) : (
                filteredCategories.map((cat) => (
                  <section key={cat.id} className="space-y-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] px-1">
                      {cat.name} ({cat.products.length})
                    </h3>
                    <div className="rounded-lg border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
                      {cat.products.map((product) => (
                        <div key={product.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-[hsl(var(--accent))] transition-colors">
                          <div>
                            <p className="text-sm font-medium text-[hsl(var(--foreground))]">{product.name}</p>
                            {product.description && (
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">{product.description}</p>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-[hsl(var(--primary))] shrink-0 ml-4">
                            ${formatCLP(product.price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
