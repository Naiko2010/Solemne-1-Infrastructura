import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSelectedLocal } from '../../hooks/useSelectedLocal'
import {
  deleteInventoryItem,
  getInventoryKpisByLocal,
  getInventoryProductsPage,
  getInventoryStockList,
  patchInventoryProductUnitCost,
  patchInventoryStock,
} from '../../lib/inventoryApi'
import InventoryShell from './InventoryShell'
import LoadingSpinner from '../LoadingSpinner'
import NuevoProductoModal from './NuevoProductoModal'
import ProductsTable from './ProductsTable'
import CategoryFilterSelect from './CategoryFilterSelect'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Package, CheckCircle, TrendingDown, AlertTriangle, DollarSign, Plus } from 'lucide-react'
import PageTransition from '../PageTransition'
import { formatCLPDisplay as formatMoney } from '../../lib/formatCLP'

const kpiContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const kpiItemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } },
}

const sectionVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1], delay: 0.18 } },
}

function StockControlDashboard() {
  const { localId } = useParams()
  const selectedLocal = useSelectedLocal(localId)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [itemsLoading, setItemsLoading] = useState(true)
  const [itemsError, setItemsError] = useState('')
  const [actionError, setActionError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categoriesCatalog, setCategoriesCatalog] = useState([])
  const [statusFilters, setStatusFilters] = useState([])
  const pageSize = 10

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 320)
    return () => clearTimeout(t)
  }, [searchQuery])

  const load = useCallback(async () => {
    if (!localId) {
      setError('No se indicó un local.')
      setLoading(false)
      return
    }
    setError('')
    try {
      const payload = await getInventoryKpisByLocal(localId)
      setData(payload)
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los KPIs de inventario.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [localId])

  /** Catálogo de categorías: listado completo del local (sin filtros) para llenar el selector (HU-47). */
  const loadCategoriesCatalog = useCallback(async () => {
    if (!localId) return
    try {
      const rows = await getInventoryStockList(localId, {})
      const arr = Array.isArray(rows) ? rows : []
      const m = new Map()
      for (const row of arr) {
        const id = row.category_id != null ? String(row.category_id) : ''
        const name = row.category_name != null ? String(row.category_name).trim() : ''
        if (id && name) m.set(id, name)
      }
      setCategoriesCatalog(
        [...m.entries()]
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      )
    } catch {
      /* mantener opciones previas */
    }
  }, [localId])

  const currentFilters = useMemo(
    () => ({
      category: categoryFilter || undefined,
      search: debouncedSearch || undefined,
      status: statusFilters.length ? statusFilters : undefined,
    }),
    [categoryFilter, debouncedSearch, statusFilters],
  )

  const loadItems = useCallback(
    async (filters, page) => {
      if (!localId) {
        setItemsError('No se indicó un local.')
        setItemsLoading(false)
        return
      }
      setItemsError('')
      setItemsLoading(true)
      try {
        const offset = (page - 1) * pageSize
        const { items: pageItems, total } = await getInventoryProductsPage(localId, {
          ...filters,
          limit: pageSize,
          offset,
        })
        setItems(pageItems)
        setTotalCount(total)
      } catch (e) {
        setItemsError(e?.message || 'No se pudo cargar el listado de productos.')
        setItems([])
        setTotalCount(0)
      } finally {
        setItemsLoading(false)
      }
    },
    [localId, pageSize],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadCategoriesCatalog()
  }, [loadCategoriesCatalog])

  useEffect(() => {
    setCurrentPage(1)
  }, [categoryFilter, debouncedSearch, statusFilters])

  useEffect(() => {
    if (!localId) return
    loadItems(currentFilters, currentPage)
  }, [localId, currentFilters, currentPage, loadItems])

  useEffect(() => {
    if (categoryFilter && !categoriesCatalog.some((c) => c.id === categoryFilter)) {
      setCategoryFilter('')
    }
  }, [categoryFilter, categoriesCatalog])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const handlePatchStock = useCallback(
    async (row, body) => {
      if (!localId) return
      setActionError('')
      try {
        await patchInventoryStock(localId, row.inventory_id, body)
        await load()
        await loadItems(currentFilters, currentPage)
      } catch (e) {
        setActionError(e?.message || 'No se pudo actualizar el stock.')
        throw e
      }
    },
    [localId, load, loadItems, currentFilters, currentPage],
  )

  const handlePatchUnitCost = useCallback(
    async (row, unitCostClp) => {
      if (!localId) return
      setActionError('')
      try {
        await patchInventoryProductUnitCost(localId, row.product_id, { unitCost: unitCostClp })
        await load()
        await loadItems(currentFilters, currentPage)
      } catch (e) {
        setActionError(e?.message || 'No se pudo actualizar el costo.')
        throw e
      }
    },
    [localId, load, loadItems, currentFilters, currentPage],
  )

  const handleDeleteItem = useCallback(
    async (row) => {
      if (!localId) return
      setActionError('')
      try {
        await deleteInventoryItem(localId, row.inventory_id)
        await load()
        setCurrentPage(1)
        await loadItems(currentFilters, 1)
      } catch (e) {
        setActionError(e?.message || 'No se pudo eliminar el producto.')
        throw e
      }
    },
    [localId, load, loadItems, currentFilters],
  )

  const handleKpiClick = (filterValue) => {
    if (!filterValue) { setStatusFilters([]); return }
    setStatusFilters((prev) => (prev.includes(filterValue) ? [] : [filterValue]))
  }

  const KPI_CARDS = data
    ? [
        {
          icon: <Package size={22} />,
          label: 'Total productos',
          value: data.total_products ?? 0,
          filterValue: null,
          iconColorClass: 'text-[hsl(var(--primary))]',
          iconBgClass: 'bg-emerald-50',
          accentClass: 'border-l-emerald-700',
          valueColorClass: 'text-[hsl(var(--foreground))]',
          activeRing: '',
        },
        {
          icon: <CheckCircle size={22} />,
          label: 'Stock óptimo',
          value: data.optimal_stock_count ?? 0,
          filterValue: 'OPTIMO',
          iconColorClass: 'text-emerald-600',
          iconBgClass: 'bg-emerald-50',
          accentClass: 'border-l-emerald-500',
          valueColorClass: 'text-emerald-700',
          activeRing: 'ring-2 ring-emerald-400',
        },
        {
          icon: <TrendingDown size={22} />,
          label: 'Stock bajo',
          value: data.low_stock_count ?? 0,
          filterValue: 'BAJO',
          iconColorClass: 'text-amber-600',
          iconBgClass: 'bg-amber-50',
          accentClass: 'border-l-amber-500',
          valueColorClass: 'text-amber-700',
          activeRing: 'ring-2 ring-amber-400',
        },
        {
          icon: <AlertTriangle size={22} />,
          label: 'Stock crítico',
          value: data.critical_stock_count ?? 0,
          filterValue: 'CRITICO',
          iconColorClass: 'text-red-600',
          iconBgClass: 'bg-red-50',
          accentClass: 'border-l-red-500',
          valueColorClass: 'text-red-700',
          activeRing: 'ring-2 ring-red-400',
        },
        {
          icon: <DollarSign size={22} />,
          label: 'Valor total',
          value: formatMoney(data.total_value),
          filterValue: null,
          noClick: true,
          iconColorClass: 'text-[hsl(var(--primary))]',
          iconBgClass: 'bg-emerald-50',
          accentClass: 'border-l-emerald-700',
          valueColorClass: 'text-[hsl(var(--primary))]',
          activeRing: '',
        },
      ]
    : []

  return (
    <InventoryShell>
      <PageTransition className="flex flex-col gap-6 px-6 py-6 pb-10">
        <header className="flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" aria-hidden="true">
            <Package size={22} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Stock producto</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Gestiona existencias y costos para decisiones de reposición</p>
          </div>
        </header>

        {error ? (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        ) : null}
        {!error && loading && !data ? <LoadingSpinner message="Cargando indicadores..." /> : null}

        {data ? (
          <motion.section
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
            aria-label="KPIs de inventario"
            variants={kpiContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {KPI_CARDS.map((kpi) => {
              const isActive = kpi.filterValue && statusFilters.includes(kpi.filterValue)
              const isClickable = !kpi.noClick
              return (
                <motion.div
                  key={kpi.label}
                  variants={kpiItemVariants}
                  whileHover={isClickable ? { scale: 1.04, y: -4, transition: { type: 'spring', stiffness: 380, damping: 22 } } : undefined}
                  whileTap={isClickable ? { scale: 0.98 } : undefined}
                  onClick={isClickable ? () => handleKpiClick(kpi.filterValue) : undefined}
                  className={isClickable ? 'cursor-pointer' : undefined}
                  title={isClickable ? (isActive ? 'Quitar filtro' : kpi.filterValue ? `Filtrar por ${kpi.label.toLowerCase()}` : 'Ver todos los productos') : undefined}
                >
                  <Card className={`border-l-4 ${kpi.accentClass} overflow-hidden h-full transition-shadow ${isActive ? kpi.activeRing : ''}`}>
                    <CardContent className="flex items-center gap-2.5 p-3">
                      <span
                        className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${kpi.iconBgClass} ${kpi.iconColorClass}`}
                        aria-hidden="true"
                      >
                        {kpi.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-[hsl(var(--muted-foreground))] leading-tight">{kpi.label}</p>
                        <p className={`text-xl font-bold leading-tight mt-0.5 ${kpi.valueColorClass}`}>{kpi.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.section>
        ) : null}

        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
        <Card aria-labelledby="scd-inventory-heading">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle id="scd-inventory-heading" className="text-base">Inventario de productos</CardTitle>
              <Button type="button" onClick={() => setModalOpen(true)} className="gap-1.5">
                <Plus size={16} />
                Nuevo producto
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            {actionError ? (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
                {actionError}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 items-center" role="search" aria-label="Filtrar inventario">
              <div className="relative flex-1 min-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" aria-hidden="true">
                  <Search size={16} />
                </span>
                <input
                  type="search"
                  placeholder="Buscar por nombre de producto…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Buscar productos por nombre"
                  autoComplete="off"
                  className="h-9 w-full rounded-md border border-[hsl(var(--border))] bg-white pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                />
              </div>
              <CategoryFilterSelect value={categoryFilter} onChange={setCategoryFilter} options={categoriesCatalog} />
            </div>

            <ProductsTable
              items={items}
              loading={itemsLoading}
              error={itemsError}
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onEmptyAction={() => setModalOpen(true)}
              onPatchStock={handlePatchStock}
              onPatchUnitCost={handlePatchUnitCost}
              onDeleteItem={handleDeleteItem}
              statusFilters={statusFilters}
            />
          </CardContent>
        </Card>
        </motion.div>

        <NuevoProductoModal
          open={modalOpen}
          localId={localId}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setCurrentPage(1)
            load()
            loadCategoriesCatalog()
            loadItems(currentFilters, 1).catch(() => {})
          }}
        />
      </PageTransition>
    </InventoryShell>
  )
}

export default StockControlDashboard
