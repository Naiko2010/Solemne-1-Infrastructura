import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSelectedLocal } from '../../hooks/useSelectedLocal'
import { motion } from 'framer-motion'
import { getAuthContext } from '../../lib/apiClient'
import {
  deleteSupplier,
  getLocalById,
  getSupplierKpisByLocal,
  getSuppliersWithMetricsForBusiness,
  patchSupplier,
} from '../../lib/providersApi'
import { useAuth } from '../../context/AuthContext'
import { formatCLPDisplay as formatMoneyClp } from '../../lib/formatCLP'
import InventoryShell from './InventoryShell'
import LoadingSpinner from '../LoadingSpinner'
import RegisterSupplierModal from './RegisterSupplierModal'
import SupplierDetailModal from './SupplierDetailModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Users, CheckCircle, DollarSign, Store, Plus, Clock, Eye, Power, Trash2 } from 'lucide-react'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const CURRENT_YEAR = new Date().getFullYear()

const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

const STAGGER = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }
const ITEM    = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } }

function supplierAvatar(name, index) {
  const letter = String(name || '?').trim().charAt(0).toUpperCase()
  const color  = AVATAR_COLORS[index % AVATAR_COLORS.length]
  return { letter, color }
}

function SuppliersKpisDashboard() {
  const { isInventoryAdmin: canAccess } = useAuth()
  const { localId } = useParams()
  const selectedLocal = useSelectedLocal(localId)

  const [year,  setYear]  = useState(CURRENT_YEAR)
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [suppliersRows,      setSuppliersRows]      = useState([])
  const [suppliersLoading,   setSuppliersLoading]   = useState(true)
  const [suppliersError,     setSuppliersError]     = useState('')
  const [resolvedBusinessId, setResolvedBusinessId] = useState(null)
  const [registerOpen,   setRegisterOpen]   = useState(false)
  const [detailId,       setDetailId]       = useState(null)
  const [updatedAt,      setUpdatedAt]      = useState(null)
  const [rowActionId,    setRowActionId]    = useState(null)  // id in-flight
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const load = useCallback(async () => {
    if (!canAccess) { setLoading(false); setData(null); setError(''); return }
    if (!localId)   { setError('No se indicó un local.'); setLoading(false); return }
    setError('')
    setLoading(true)
    setUpdatedAt(new Date())
    try {
      const payload = await getSupplierKpisByLocal(localId, { year, month })
      setData(payload)
    } catch (e) {
      setData(null)
      setError(e?.message || 'No se pudieron cargar los KPIs de proveedores.')
    } finally {
      setLoading(false)
    }
  }, [localId, year, month, canAccess])

  const loadSuppliersList = useCallback(async () => {
    if (!canAccess || !localId) {
      setSuppliersRows([])
      setSuppliersLoading(false)
      setResolvedBusinessId(null)
      return
    }
    setSuppliersError('')
    setSuppliersLoading(true)
    try {
      const [{ businessId: bidFromToken }, loc] = await Promise.all([
        getAuthContext(),
        getLocalById(localId),
      ])
      const businessId =
        loc?.business_id != null ? String(loc.business_id) :
        bidFromToken != null     ? String(bidFromToken)     : null
      if (!businessId) {
        setSuppliersRows([])
        setSuppliersError('No se pudo determinar el negocio del local.')
        setResolvedBusinessId(null)
        return
      }
      setResolvedBusinessId(businessId)
      const rows = await getSuppliersWithMetricsForBusiness(businessId)
      setSuppliersRows(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setSuppliersRows([])
      setResolvedBusinessId(null)
      setSuppliersError(e?.message || 'No se pudo cargar el listado de proveedores.')
    } finally {
      setSuppliersLoading(false)
    }
  }, [localId, canAccess])

  const handleToggleActive = useCallback(async (row) => {
    if (!resolvedBusinessId || rowActionId) return
    const newActive = row.is_active === false ? true : false
    setRowActionId(String(row.id))
    setSuppliersRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, is_active: newActive } : r))
    try {
      await patchSupplier(String(row.id), resolvedBusinessId, { is_active: newActive })
      await loadSuppliersList()
    } catch {
      setSuppliersRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, is_active: row.is_active } : r))
    } finally {
      setRowActionId(null)
    }
  }, [resolvedBusinessId, rowActionId, loadSuppliersList])

  const handleDelete = useCallback(async (row) => {
    if (!resolvedBusinessId || rowActionId) return
    setRowActionId(String(row.id))
    setConfirmDeleteId(null)
    try {
      await deleteSupplier(String(row.id), resolvedBusinessId)
      setSuppliersRows((prev) => prev.filter((r) => String(r.id) !== String(row.id)))
      await load()
    } catch (e) {
      setSuppliersError(e?.message || 'No se pudo eliminar el proveedor.')
    } finally {
      setRowActionId(null)
    }
  }, [resolvedBusinessId, rowActionId, load])

  const availableYears = useMemo(() => {
    const set = new Set([CURRENT_YEAR])
    for (const row of suppliersRows) {
      const raw = row.start_date || row.created_at
      if (!raw) continue
      const y = new Date(raw).getFullYear()
      if (Number.isFinite(y) && y > 1900 && y <= CURRENT_YEAR + 1) set.add(y)
    }
    return Array.from(set).sort((a, b) => a - b)
  }, [suppliersRows])

  useEffect(() => { load() },             [load])
  useEffect(() => { loadSuppliersList() }, [loadSuppliersList])

  const kpiCards = [
    { icon: Users,       label: 'Total proveedores',    value: data?.total_suppliers ?? '—',              iconColor: 'text-blue-600',                iconBg: 'bg-blue-50',    accent: 'border-l-blue-500'    },
    { icon: CheckCircle, label: 'Proveedores activos',  value: data?.active_suppliers ?? '—',             iconColor: 'text-emerald-600',             iconBg: 'bg-emerald-50', accent: 'border-l-emerald-500' },
    { icon: DollarSign,  label: 'Compras del mes (CLP)', value: formatMoneyClp(data?.month_purchases_clp), iconColor: 'text-[hsl(var(--primary))]',   iconBg: 'bg-emerald-50', accent: 'border-l-emerald-700' },
  ]

  return (
    <InventoryShell>
      {/* No mx-auto — content anchors to the left with padding only */}
      <div className="px-6 py-6 flex flex-col gap-6 pb-10">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <header className="flex items-center gap-4">
            <span className="flex items-center justify-center w-13 h-13 rounded-xl bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] p-3">
              <Store size={26} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Proveedores</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                Gestiona proveedores y monitorea su impacto en compras
              </p>
            </div>
          </header>

          {canAccess && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Period selector */}
              <div className="flex items-center gap-0 rounded-lg border border-[hsl(var(--border))] bg-white overflow-hidden shadow-sm">
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="h-9 border-0 bg-transparent px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[hsl(var(--primary)/0.3)] cursor-pointer"
                  aria-label="Año"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <div className="w-px h-5 bg-[hsl(var(--border))]" />
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="h-9 border-0 bg-transparent px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[hsl(var(--primary)/0.3)] cursor-pointer"
                  aria-label="Mes"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>

              {resolvedBusinessId && (
                <Button
                  type="button"
                  onClick={() => setRegisterOpen(true)}
                  disabled={suppliersLoading}
                  className="gap-2 h-9"
                >
                  <Plus size={16} />
                  Registrar proveedor
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── Last updated ── */}
        {updatedAt && canAccess && (
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] -mt-2">
            <Clock size={14} className="shrink-0" />
            <span>
              Actualizado:{' '}
              <strong className="text-[hsl(var(--foreground))]">
                {new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(updatedAt)}
              </strong>
            </span>
          </div>
        )}

        {/* ── Access error ── */}
        {!canAccess && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
            Solo administradores pueden ver los KPIs de proveedores.
          </div>
        )}

        {/* ── KPI error ── */}
        {canAccess && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
            {error}
          </div>
        )}

        {/* ── KPI cards ── */}
        {canAccess && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            variants={STAGGER} initial="hidden" animate="visible"
          >
            {kpiCards.map((k) => (
              <motion.div key={k.label} variants={ITEM}>
                <Card className={`border-l-4 ${k.accent} h-full`}>
                  <CardContent className="flex items-center gap-4 p-5">
                    <span className={`flex items-center justify-center w-12 h-12 rounded-full shrink-0 ${k.iconBg} ${k.iconColor}`}>
                      <k.icon size={24} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-[hsl(var(--muted-foreground))] leading-tight">{k.label}</p>
                      {loading
                        ? <div className="h-8 w-16 bg-[hsl(var(--muted))] rounded animate-pulse mt-1" />
                        : <p className={`text-3xl font-bold leading-tight mt-1 ${k.iconColor}`}>{k.value}</p>
                      }
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Suppliers table ── */}
        {canAccess && (
          <Card>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[hsl(var(--border))]">
              <div>
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Listado de proveedores</h2>
                {!suppliersLoading && (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                    {suppliersRows.length} proveedor{suppliersRows.length !== 1 ? 'es' : ''} registrado{suppliersRows.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            {suppliersError && (
              <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
                {suppliersError}
              </div>
            )}

            {suppliersLoading ? (
              <div className="py-12">
                <LoadingSpinner message="Cargando proveedores…" />
              </div>
            ) : suppliersRows.length === 0 && !suppliersError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <span className="flex items-center justify-center w-14 h-14 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] mb-4">
                  <Store size={26} />
                </span>
                <p className="text-base font-medium text-[hsl(var(--foreground))]">Sin proveedores registrados</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                  Registra tu primer proveedor con el botón de arriba.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[hsl(var(--muted)/0.5)] hover:bg-[hsl(var(--muted)/0.5)]">
                      <TableHead className="pl-6 py-3 text-sm font-semibold">Proveedor</TableHead>
                      <TableHead className="py-3 text-sm font-semibold">Estado</TableHead>
                      <TableHead className="text-right py-3 text-sm font-semibold">Uds. en inventario</TableHead>
                      <TableHead className="text-right py-3 text-sm font-semibold">Valor inventario</TableHead>
                      <TableHead className="pr-6 py-3 text-right text-sm font-semibold">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliersRows.map((row, idx) => {
                      const inactive = row.is_active === false
                      const isBusy   = rowActionId === String(row.id)
                      const { letter, color } = supplierAvatar(row.name, idx)
                      const avatarCls = inactive ? 'bg-gray-100 text-gray-400' : color
                      const isConfirmingDelete = confirmDeleteId === String(row.id)

                      return (
                        <TableRow
                          key={row.id}
                          className={`transition-colors ${inactive ? 'bg-[hsl(var(--muted)/0.25)] opacity-60' : 'hover:bg-[hsl(var(--muted)/0.3)]'}`}
                        >
                          <TableCell className="pl-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`flex items-center justify-center w-10 h-10 rounded-full text-base font-bold shrink-0 ${avatarCls}`}>
                                {letter}
                              </span>
                              <span className={`font-semibold text-base ${inactive ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'}`}>
                                {row.name || '—'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge
                              className={`text-sm px-3 py-1 ${inactive
                                ? 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-100'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              }`}
                            >
                              {inactive ? 'Inactivo' : 'Activo'}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right tabular-nums text-base py-4 ${inactive ? 'text-gray-400' : 'text-[hsl(var(--muted-foreground))]'}`}>
                            {row.purchased_products_count ?? 0}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums text-base font-semibold py-4 ${inactive ? 'text-gray-400' : 'text-[hsl(var(--primary))]'}`}>
                            {formatMoneyClp(row.supplier_purchases_total_clp)}
                          </TableCell>
                          <TableCell className="pr-6 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-red-600 font-medium whitespace-nowrap">¿Eliminar?</span>
                                  <Button type="button" variant="destructive" size="sm" disabled={isBusy}
                                    onClick={() => handleDelete(row)} className="h-7 px-2 text-xs">
                                    {isBusy ? '…' : 'Sí'}
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm"
                                    onClick={() => setConfirmDeleteId(null)} className="h-7 px-2 text-xs">
                                    No
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    title="Ver detalle"
                                    disabled={isBusy}
                                    onClick={() => setDetailId(row.id != null ? String(row.id) : null)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.08)] disabled:opacity-40 transition-colors"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    title={inactive ? 'Habilitar proveedor' : 'Deshabilitar proveedor'}
                                    disabled={isBusy}
                                    onClick={() => handleToggleActive(row)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-40 transition-colors ${
                                      inactive
                                        ? 'text-emerald-600 hover:bg-emerald-50'
                                        : 'text-amber-500 hover:bg-amber-50'
                                    }`}
                                  >
                                    <Power size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Eliminar proveedor"
                                    disabled={isBusy}
                                    onClick={() => setConfirmDeleteId(String(row.id))}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        )}

        <RegisterSupplierModal
          open={registerOpen}
          onClose={() => setRegisterOpen(false)}
          businessId={resolvedBusinessId}
          onSuccess={() => { load(); loadSuppliersList() }}
        />

        <SupplierDetailModal
          open={detailId != null && detailId !== ''}
          supplierId={detailId}
          businessId={resolvedBusinessId}
          onClose={() => setDetailId(null)}
        />
      </div>
    </InventoryShell>
  )
}

export default SuppliersKpisDashboard
