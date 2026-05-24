import { useState, useEffect, useMemo } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { formatCLPDisplay as formatMoney } from '../lib/formatCLP'
import { useLocals } from '../hooks/useLocals'
import { getInventoryKpisByLocal } from '../lib/inventoryApi'
import { getLocalDashboard, getOrdersByLocal } from '../lib/administrativeApi'
import { getAuthContext } from '../lib/apiClient'
import { generateIncomeTrendFromOrders } from '../utils/chartDataHelpers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageTransition from './PageTransition'
import LoadingSpinner from './LoadingSpinner'
import IncomeChart from './charts/IncomeChart'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  Package, CheckCircle, TrendingDown, AlertTriangle, DollarSign,
  TrendingUp, Wallet,
} from 'lucide-react'

const PIE_COLORS = ['#16a34a', '#f59e0b', '#ef4444']

const STAGGER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const ITEM = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
}

function KpiCard({ icon: Icon, label, value, iconColor, iconBg, accentColor, loading }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -3, transition: { type: 'spring', stiffness: 380, damping: 22 } }}
      whileTap={{ scale: 0.97 }}
    >
      <Card className={`border-l-4 ${accentColor} overflow-hidden h-full`}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${iconBg} ${iconColor}`}>
            <Icon size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-tight">{label}</p>
            {loading
              ? <div className="h-7 w-16 bg-[hsl(var(--muted))] rounded animate-pulse mt-0.5" />
              : <p className={`text-2xl font-bold leading-tight mt-0.5 ${iconColor}`}>{value}</p>
            }
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}


function LocalDashboard() {
  const { localId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { locales } = useLocals()

  const localName = useMemo(() => {
    const stateLocalName = location.state?.local?.name
    if (stateLocalName && !/^[0-9a-f]{8}-/.test(stateLocalName)) return stateLocalName
    const found = locales.find((l) => String(l.id) === String(localId))
    return found?.name || `Local ${localId ?? ''}`
  }, [location.state, localId, locales])

  const navState = useMemo(() => ({ local: { id: localId, name: localName } }), [localId, localName])

  const [invKpis, setInvKpis] = useState(null)
  const [invLoading, setInvLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)
  const [dashLoading, setDashLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)

  useEffect(() => {
    if (!localId) return
    let ignore = false

    setInvLoading(true)
    getInventoryKpisByLocal(localId)
      .then((data) => { if (!ignore) setInvKpis(data) })
      .catch(() => { if (!ignore) setInvKpis(null) })
      .finally(() => { if (!ignore) setInvLoading(false) })

    setDashLoading(true)
    setOrdersLoading(true)
    getAuthContext()
      .then(({ token }) => Promise.all([
        getLocalDashboard(localId, token),
        getOrdersByLocal(localId, token),
      ]))
      .then(([dash, ords]) => {
        if (!ignore) {
          setDashboard(dash)
          setOrders(Array.isArray(ords) ? ords : [])
        }
      })
      .catch(() => { if (!ignore) { setDashboard(null); setOrders([]) } })
      .finally(() => { if (!ignore) { setDashLoading(false); setOrdersLoading(false) } })

    return () => { ignore = true }
  }, [localId])

  const incomeTrend = useMemo(() => generateIncomeTrendFromOrders(orders), [orders])

  const pieData = useMemo(() => {
    if (!invKpis) return []
    return [
      { name: 'Óptimo',     value: invKpis.optimal_stock_count  ?? 0 },
      { name: 'Stock bajo', value: invKpis.low_stock_count      ?? 0 },
      { name: 'Crítico',    value: invKpis.critical_stock_count ?? 0 },
    ].filter((d) => d.value > 0)
  }, [invKpis])

  const finCards = [
    { icon: TrendingUp, label: 'Ventas Hoy',    value: formatMoney(dashboard?.daily_sales),        iconColor: 'text-emerald-600',           iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-500' },
    { icon: DollarSign, label: 'Ventas del Mes', value: formatMoney(dashboard?.monthly_sales),     iconColor: 'text-[hsl(var(--primary))]', iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-700' },
    { icon: Wallet,     label: 'Flujo de Caja',  value: formatMoney(dashboard?.monthly_cash_flow), iconColor: 'text-blue-600',              iconBg: 'bg-blue-50',    accentColor: 'border-l-blue-500'   },
  ]

  const invCards = [
    { icon: Package,       label: 'Total productos', value: invKpis?.total_products       ?? '—', iconColor: 'text-[hsl(var(--primary))]', iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-700' },
    { icon: CheckCircle,   label: 'Stock óptimo',    value: invKpis?.optimal_stock_count  ?? '—', iconColor: 'text-emerald-600',            iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-500' },
    { icon: TrendingDown,  label: 'Stock bajo',      value: invKpis?.low_stock_count      ?? '—', iconColor: 'text-amber-600',              iconBg: 'bg-amber-50',   accentColor: 'border-l-amber-500'   },
    { icon: AlertTriangle, label: 'Stock crítico',   value: invKpis?.critical_stock_count ?? '—', iconColor: 'text-red-600',                iconBg: 'bg-red-50',     accentColor: 'border-l-red-500'     },
    { icon: DollarSign,    label: 'Valor total inv.', value: formatMoney(invKpis?.total_value),    iconColor: 'text-[hsl(var(--primary))]', iconBg: 'bg-emerald-50', accentColor: 'border-l-emerald-700' },
  ]

  return (
    <>
      <header className="shrink-0 bg-white border-b border-[hsl(var(--border))] px-6 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-base font-bold text-[hsl(var(--foreground))]">{localName}</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Panel general</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <PageTransition className="flex flex-col gap-6 p-6 max-w-6xl mx-auto pb-10">

          {/* Resumen Financiero */}
          <section>
            <div className="mb-3">
              <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Resumen Financiero</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Actividad del local</p>
            </div>
            <motion.div
              className="grid grid-cols-2 lg:grid-cols-4 gap-3"
              variants={STAGGER} initial="hidden" animate="visible"
            >
              {finCards.map((k) => (
                <motion.div key={k.label} variants={ITEM}>
                  <KpiCard {...k} loading={dashLoading} />
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tendencia de Ingresos</CardTitle>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="h-48 flex items-center justify-center"><LoadingSpinner /></div>
                ) : incomeTrend.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
                    Sin pedidos registrados en el período.
                  </p>
                ) : (
                  <IncomeChart data={incomeTrend} />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribución de Stock</CardTitle>
              </CardHeader>
              <CardContent>
                {invLoading ? (
                  <div className="h-48 flex items-center justify-center"><LoadingSpinner /></div>
                ) : pieData.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
                    Sin datos de inventario.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={72}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [`${v} productos`, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-3 px-2 pt-1">
                      {pieData.map((entry, i) => (
                        <div key={entry.name} className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3.5 w-3.5 rounded-full shrink-0"
                              style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                            />
                            <span className="text-sm text-[hsl(var(--muted-foreground))] font-medium">{entry.name}</span>
                          </div>
                          <span className="text-xl font-extrabold text-[hsl(var(--foreground))]">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>


          {/* Resumen de Inventario */}
          <section>
            <div className="mb-3">
              <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Resumen de Inventario</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Estado actual del stock</p>
            </div>
            {invLoading && !invKpis ? (
              <LoadingSpinner message="Cargando inventario..." />
            ) : (
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
                variants={STAGGER} initial="hidden" animate="visible"
              >
                {invCards.map((k) => (
                  <motion.div key={k.label} variants={ITEM}>
                    <KpiCard {...k} loading={invLoading} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </section>

        </PageTransition>
      </div>
    </>
  )
}

export default LocalDashboard
