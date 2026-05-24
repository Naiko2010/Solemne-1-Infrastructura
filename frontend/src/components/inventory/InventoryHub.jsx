import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelectedLocal } from '../../hooks/useSelectedLocal'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { getInventoryKpisByLocal, getInventoryStockList } from '../../lib/inventoryApi'
import InventoryShell from './InventoryShell'
import LoadingSpinner from '../LoadingSpinner'
import { getStockAlertLevel } from './stockAlertUtils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { formatCLPDisplay as formatMoney } from '../../lib/formatCLP'
import {
  Package, CheckCircle, TrendingDown, AlertTriangle, DollarSign,
  Info, ArrowRight,
} from 'lucide-react'

const STAGGER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const ITEM = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
}

const PIE_COLORS = ['#16a34a', '#f59e0b', '#ef4444']

function InventoryHub() {
  const navigate  = useNavigate()
  const { localId } = useParams()
  const selectedLocal = useSelectedLocal(localId)

  const nav = (path) => navigate(`/local/${localId}/${path}`, { state: { local: selectedLocal } })

  const [kpis, setKpis]           = useState(null)
  const [kpisLoading, setKL]      = useState(true)
  const [items, setItems]         = useState([])
  const [itemsLoading, setIL]     = useState(true)

  const loadKpis = useCallback(async () => {
    if (!localId) { setKL(false); return }
    setKL(true)
    try { setKpis(await getInventoryKpisByLocal(localId)) } catch { setKpis(null) } finally { setKL(false) }
  }, [localId])

  const loadItems = useCallback(async () => {
    if (!localId) { setIL(false); return }
    setIL(true)
    try {
      const rows = await getInventoryStockList(localId)
      setItems(Array.isArray(rows) ? rows : [])
    } catch { setItems([]) } finally { setIL(false) }
  }, [localId])

  useEffect(() => { loadKpis(); loadItems() }, [loadKpis, loadItems])

  /* ── alert items ──────────────────────────────────────────── */
  const alerts = useMemo(() => {
    const rows = []
    for (const row of items) {
      const level = getStockAlertLevel(row)
      if (!level) continue
      rows.push({
        id:     row.inventory_id ?? row.product_id,
        name:   row.product_name || row.name || 'Producto',
        level,
        stock:  Number(row.stock_current ?? 0),
        min:    row.stock_min != null ? Number(row.stock_min) : null,
        cat:    row.category_name || '—',
      })
    }
    rows.sort((a, b) => (a.level === 'critical' ? -1 : b.level === 'critical' ? 1 : 0))
    return rows
  }, [items])

  /* ── pie chart data ────────────────────────────────────────── */
  const pieData = useMemo(() => {
    if (!kpis) return []
    return [
      { name: 'Óptimo',     value: kpis.optimal_stock_count  ?? 0 },
      { name: 'Stock bajo', value: kpis.low_stock_count      ?? 0 },
      { name: 'Crítico',    value: kpis.critical_stock_count ?? 0 },
    ].filter((d) => d.value > 0)
  }, [kpis])

  /* ── bar chart data: top alert products ───────────────────── */
  const barData = useMemo(() =>
    alerts.slice(0, 10).map((a) => ({
      name:   a.name.length > 14 ? a.name.slice(0, 13) + '…' : a.name,
      Actual: a.stock,
      Mínimo: a.min ?? 0,
    }))
  , [alerts])

  /* ── KPI cards ─────────────────────────────────────────────── */
  const KPI_CARDS = [
    { icon: Package,       label: 'Total productos',  value: kpis?.total_products ?? '—',       iconColor: 'text-[hsl(var(--primary))]', bg: 'bg-emerald-50', accent: 'border-l-emerald-700' },
    { icon: CheckCircle,   label: 'Stock óptimo',     value: kpis?.optimal_stock_count ?? '—',  iconColor: 'text-emerald-600',            bg: 'bg-emerald-50', accent: 'border-l-emerald-500' },
    { icon: TrendingDown,  label: 'Stock bajo',       value: kpis?.low_stock_count ?? '—',      iconColor: 'text-amber-600',              bg: 'bg-amber-50',   accent: 'border-l-amber-500'   },
    { icon: AlertTriangle, label: 'Stock crítico',    value: kpis?.critical_stock_count ?? '—', iconColor: 'text-red-600',                bg: 'bg-red-50',     accent: 'border-l-red-500'     },
    { icon: DollarSign,    label: 'Valor total',      value: formatMoney(kpis?.total_value),    iconColor: 'text-[hsl(var(--primary))]', bg: 'bg-emerald-50', accent: 'border-l-emerald-700' },
  ]

  const loading = kpisLoading || itemsLoading

  return (
    <InventoryShell>
      <div className="px-6 py-6 flex flex-col gap-6 pb-10">
        <header>
          <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">Estado Actual Inventario</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{selectedLocal?.name}</p>
        </header>

        {loading && !kpis && !items.length ? (
          <LoadingSpinner message="Cargando inventario..." />
        ) : (
          <>
            {/* KPI cards */}
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
              variants={STAGGER} initial="hidden" animate="visible"
            >
              {KPI_CARDS.map((k) => (
                <motion.div key={k.label} variants={ITEM}>
                  <Card className={`border-l-4 ${k.accent} h-full`}>
                    <CardContent className="flex items-center gap-4 p-5">
                      <span className={`flex items-center justify-center w-12 h-12 rounded-full shrink-0 ${k.bg} ${k.iconColor}`}>
                        <k.icon size={22} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-[hsl(var(--muted-foreground))] leading-tight">{k.label}</p>
                        {kpisLoading
                          ? <div className="h-8 w-14 bg-[hsl(var(--muted))] rounded animate-pulse mt-1" />
                          : <p className={`text-2xl font-bold mt-0.5 ${k.iconColor}`}>{k.value}</p>
                        }
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Donut — stock status */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Distribución de stock</CardTitle>
                </CardHeader>
                <CardContent>
                  {kpisLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <LoadingSpinner />
                    </div>
                  ) : pieData.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">Sin datos</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%" cy="50%"
                          innerRadius={55} outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [`${v} productos`, n]} />
                        <Legend iconType="circle" iconSize={10} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Bar chart — products with alerts */}
              <Card className="lg:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Productos en alerta (stock actual vs mínimo)</CardTitle>
                </CardHeader>
                <CardContent>
                  {itemsLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <LoadingSpinner />
                    </div>
                  ) : barData.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
                      No hay productos en alerta. Todo en orden.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={barData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="Actual" fill="#16a34a" radius={[0, 3, 3, 0]} barSize={12} />
                        <Bar dataKey="Mínimo" fill="#fca5a5" radius={[0, 3, 3, 0]} barSize={12} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Alerts */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-500" />
                    Alertas de inventario
                    {alerts.length > 0 && (
                      <Badge variant="destructive" className="text-xs px-2 py-0.5">{alerts.length}</Badge>
                    )}
                  </CardTitle>
                  <Button type="button" variant="ghost" size="sm" onClick={() => nav('inventario/stock')} className="gap-1 text-sm">
                    Ver stock completo <ArrowRight size={14} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {itemsLoading ? (
                  <LoadingSpinner message="Cargando alertas..." />
                ) : alerts.length === 0 ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-emerald-600">
                    <CheckCircle size={16} />
                    Todo el inventario está en niveles óptimos.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Summary pills */}
                    <div className="flex gap-2 mb-1">
                      {[
                        { level: 'critical', label: 'Crítico', color: 'bg-red-100 text-red-700 border-red-200' },
                        { level: 'low',      label: 'Bajo',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
                      ].map(({ level, label, color }) => {
                        const cnt = alerts.filter((a) => a.level === level).length
                        if (!cnt) return null
                        return (
                          <span key={level} className={`text-sm font-semibold px-3 py-1 rounded-full border ${color}`}>
                            {cnt} {label}
                          </span>
                        )
                      })}
                    </div>

                    {/* Alert rows */}
                    <div className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                      {alerts.slice(0, 8).map((a) => (
                        <div
                          key={a.id}
                          className={`flex items-center gap-3 px-5 py-3 ${
                            a.level === 'critical' ? 'bg-red-50/60' : 'bg-amber-50/60'
                          }`}
                        >
                          <span className={a.level === 'critical' ? 'text-red-500' : 'text-amber-500'} aria-hidden="true">
                            {a.level === 'critical' ? <AlertTriangle size={17} /> : <Info size={17} />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-[hsl(var(--foreground))] truncate">{a.name}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                              Stock: <strong>{a.stock}</strong>{a.min != null && ` | Mín: ${a.min}`} · {a.cat}
                            </p>
                          </div>
                          <Badge
                            className={`shrink-0 text-xs px-2 py-0.5 ${
                              a.level === 'critical'
                                ? 'bg-red-100 text-red-700 hover:bg-red-100 border border-red-200'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200'
                            }`}
                          >
                            {a.level === 'critical' ? 'Crítico' : 'Bajo'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    {alerts.length > 8 && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] text-center mt-1">
                        +{alerts.length - 8} más · <button onClick={() => nav('inventario/stock')} className="underline hover:text-[hsl(var(--primary))]">Ver todos</button>
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </InventoryShell>
  )
}

export default InventoryHub
