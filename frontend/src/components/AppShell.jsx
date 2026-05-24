import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlerts } from '../hooks/useAlerts'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Store, ChevronDown, ChevronLeft, ChevronRight,
  DollarSign, FileText, BarChart3, Wallet, Bell, Gift,
  Table2, BookOpen, Monitor, ChefHat, ClipboardList,
  Package, Truck, ShoppingCart, BookMarked, PackageOpen,
  LogOut, Utensils,
} from 'lucide-react'

/* ── key sets for accordion auto-open ──────────────────────────── */
const ADMIN_KEYS = new Set(['administracion', 'ventas', 'rendiciones', 'reportes', 'flujo-caja', 'alertas', 'bonos'])
const POS_KEYS   = new Set(['pos', 'pos-mesas', 'pos-menu', 'pos-bar', 'pos-cocina', 'pos-pedidos'])
const INV_KEYS   = new Set(['inv-hub', 'inv-prov', 'inv-stock', 'inv-compras', 'inv-recetas'])

/* ── active-key derived from pathname ──────────────────────────── */
function deriveActiveKey(pathname) {
  if (pathname.includes('/inventario/proveedores'))     return 'inv-prov'
  if (pathname.includes('/inventario/stock'))           return 'inv-stock'
  if (pathname.includes('/inventario/compras-semanales')) return 'inv-compras'
  if (pathname.includes('/inventario/recipes'))         return 'inv-recetas'
  if (pathname.includes('/inventario'))                 return 'inv-hub'
  if (pathname.includes('/pos'))                        return 'pos-mesas'
  if (pathname.includes('/administrativo/ventas'))      return 'ventas'
  if (pathname.includes('/administrativo/rendiciones')) return 'rendiciones'
  if (pathname.includes('/administrativo/reportes'))    return 'reportes'
  if (pathname.includes('/administrativo/flujo-caja'))  return 'flujo-caja'
  if (pathname.includes('/administrativo/alertas'))     return 'alertas'
  if (pathname.includes('/administrativo/bonos'))       return 'bonos'
  if (pathname.includes('/administrativo'))             return 'administracion'
  if (pathname.includes('/dashboard'))                  return 'dashboard'
  return 'locales'
}

/* ── nav config ─────────────────────────────────────────────────── */
const ACCORDIONS = [
  {
    key: 'administracion',
    label: 'Administración',
    icon: Wallet,
    items: [
      { key: 'ventas',      label: 'Ventas',        icon: DollarSign },
      { key: 'rendiciones', label: 'Rendiciones',   icon: FileText   },
      { key: 'reportes',    label: 'Reportes',      icon: BarChart3  },
      { key: 'flujo-caja',  label: 'Flujo de caja', icon: Wallet     },
      { key: 'alertas',     label: 'Alertas',       icon: Bell       },
      { key: 'bonos',       label: 'Bonos',         icon: Gift       },
    ],
  },
  {
    key: 'pos',
    label: 'POS Restaurante',
    icon: Table2,
    items: [
      { key: 'pos-mesas',   label: 'Gestión de Mesas', icon: Table2        },
      { key: 'pos-menu',    label: 'Menú',              icon: BookOpen,      disabled: true },
      { key: 'pos-bar',     label: 'Pantalla Bar',      icon: Monitor,       disabled: true },
      { key: 'pos-cocina',  label: 'Pantalla Cocina',   icon: ChefHat,       disabled: true },
      { key: 'pos-pedidos', label: 'Toma de Pedidos',   icon: ClipboardList, disabled: true },
    ],
  },
  {
    key: 'inventario',
    label: 'Inventario',
    icon: PackageOpen,
    items: [
      { key: 'inv-hub',     label: 'Estado Actual Inventario', icon: PackageOpen  },
      { key: 'inv-prov',    label: 'Proveedores',        icon: Truck        },
      { key: 'inv-stock',   label: 'Stock de productos', icon: Package      },
      { key: 'inv-compras', label: 'Pedidos semanales',  icon: ShoppingCart },
      { key: 'inv-recetas', label: 'Recetas',            icon: BookMarked   },
    ],
  },
]

/* ── Sidebar ────────────────────────────────────────────────────── */
function Sidebar({ collapsed, onToggle }) {
  const { user, userRole, logout } = useAuth()
  const navigate   = useNavigate()
  const { pathname, state: locState } = useLocation()

  const localIdMatch = pathname.match(/\/local\/([^/]+)/)
  const localId  = localIdMatch ? localIdMatch[1] : null
  const activeKey = deriveActiveKey(pathname)
  const navState  = locState?.local ? { local: locState.local } : localId ? { local: { id: localId } } : {}

  /* manually-toggled accordion overrides */
  const [userOpen, setUserOpen] = useState({ administracion: false, pos: false, inventario: false })

  const isOpen = (key) => {
    if (key === 'administracion' && ADMIN_KEYS.has(activeKey)) return true
    if (key === 'pos'            && POS_KEYS.has(activeKey))   return true
    if (key === 'inventario'     && INV_KEYS.has(activeKey))   return true
    return userOpen[key] ?? false
  }

  const toggleAccordion = (key) => {
    const autoOpen =
      (key === 'administracion' && ADMIN_KEYS.has(activeKey)) ||
      (key === 'pos'            && POS_KEYS.has(activeKey))   ||
      (key === 'inventario'     && INV_KEYS.has(activeKey))
    if (!autoOpen) setUserOpen((p) => ({ ...p, [key]: !p[key] }))
  }

  const goAccordion = (key) => {
    if (!localId) return
    switch (key) {
      case 'administracion': navigate(`/local/${localId}/administrativo/ventas`, { state: navState }); break
      case 'pos':            navigate(`/local/${localId}/pos`, { state: navState }); break
      case 'inventario':     navigate(`/local/${localId}/inventario`, { state: navState }); break
      default: break
    }
  }

  const goItem = (item) => {
    switch (item.key) {
      case 'locales':   navigate('/admin'); break
      case 'dashboard': navigate(localId ? `/local/${localId}/dashboard` : '/admin', { state: navState }); break
      case 'pos-mesas': case 'pos-menu': case 'pos-bar': case 'pos-cocina': case 'pos-pedidos':
        if (localId) navigate(`/local/${localId}/pos`, { state: navState }); break
      case 'inv-hub':     if (localId) navigate(`/local/${localId}/inventario`, { state: navState }); break
      case 'inv-prov':    if (localId) navigate(`/local/${localId}/inventario/proveedores`, { state: navState }); break
      case 'inv-stock':   if (localId) navigate(`/local/${localId}/inventario/stock`, { state: navState }); break
      case 'inv-compras': if (localId) navigate(`/local/${localId}/inventario/compras-semanales`, { state: navState }); break
      case 'inv-recetas': if (localId) navigate(`/local/${localId}/inventario/recipes`, { state: navState }); break
      default:
        if (ADMIN_KEYS.has(item.key) && localId)
          navigate(`/local/${localId}/administrativo/${item.key}`, { state: navState })
    }
  }

  /* DESCUBRIR items — Dashboard only when a local is selected */
  const discoverItems = [
    { key: 'locales',   label: 'Tus Locales', icon: Store },
    ...(localId ? [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
  ]

  const navBtn = (item, small = false) => {
    const isActive = activeKey === item.key
    const Icon = item.icon
    const isDisabled = item.disabled === true
    return (
      <button
        key={item.key}
        onClick={() => !isDisabled && goItem(item)}
        title={collapsed ? item.label : undefined}
        disabled={isDisabled}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 rounded-lg font-medium transition-colors text-left',
          small ? 'py-1.5 text-sm' : 'py-2 text-sm',
          isDisabled
            ? 'text-white/30 cursor-not-allowed opacity-50'
            : isActive
              ? 'bg-white/20 text-white'
              : 'text-white/75 hover:bg-white/15 hover:text-white',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon size={small ? 14 : 16} className="shrink-0" />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="truncate flex items-center gap-1.5"
            >
              {item.label}
              {isDisabled && <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70">pronto</span>}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    )
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="shrink-0 flex flex-col bg-[hsl(var(--primary))] text-white h-screen sticky top-0 overflow-hidden z-20"
    >
      {/* Header */}
      <div className={cn('flex items-center border-b border-white/15 min-h-[60px]', collapsed ? 'justify-center px-2' : 'px-4 gap-2')}>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="logo-text"
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              <Utensils size={20} className="shrink-0" />
              <span className="font-extrabold text-sm tracking-tight truncate">SibaGestion</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/15 transition-colors shrink-0"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* User */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="px-4 py-3 border-b border-white/15"
          >
            <p className="text-xs font-medium text-white truncate">{user?.email}</p>
            <p className="text-[10px] text-white/60 mt-0.5">{userRole || 'Usuario'}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {/* DESCUBRIR */}
        <div className="mb-3">
          <AnimatePresence>
            {!collapsed && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="px-3 pb-1 text-[10px] font-bold text-white/40 uppercase tracking-widest"
              >
                DESCUBRIR
              </motion.p>
            )}
          </AnimatePresence>
          {discoverItems.map((item) => navBtn(item))}
        </div>

        {/* Accordions — only when a local is selected */}
        {localId && ACCORDIONS.map((section) => {
          const open = isOpen(section.key)
          const hasActive = activeKey === section.key || section.items.some((i) => activeKey === i.key)
          const Icon = section.icon
          return (
            <div key={section.key} className="mb-1">
              <div className="flex items-center gap-0">
                <button
                  onClick={() => {
                    if (collapsed) { onToggle(); setUserOpen((p) => ({ ...p, [section.key]: true })) }
                    else goAccordion(section.key)
                  }}
                  title={collapsed ? section.label : undefined}
                  className={cn(
                    'flex-1 flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors',
                    hasActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/15 hover:text-white',
                    collapsed ? 'justify-center px-0 rounded-lg' : 'rounded-l-lg',
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 truncate text-left"
                      >
                        {section.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
                {!collapsed && (
                  <button
                    onClick={() => toggleAccordion(section.key)}
                    className={cn(
                      'flex items-center justify-center w-8 h-8 shrink-0 rounded-r-lg transition-colors',
                      hasActive ? 'bg-white/20 text-white hover:bg-white/30' : 'text-white/60 hover:bg-white/15 hover:text-white',
                    )}
                  >
                    <motion.span
                      animate={{ rotate: open ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-center"
                    >
                      <ChevronDown size={14} />
                    </motion.span>
                  </button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {open && !collapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="pl-3 py-1 flex flex-col gap-0.5">
                      {section.items.map((item) => navBtn(item, true))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 border-t border-white/15 pt-3">
        <button
          onClick={logout}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-red-500/20 hover:text-red-200 transition-colors',
            collapsed && 'justify-center px-0',
          )}
        >
          <LogOut size={16} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Cerrar sesión
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}

/* ── AlertBell — campana con badge de alertas pendientes en el header ── */
function AlertBell({ localId }) {
  const navigate  = useNavigate()
  const { pathname, state: locState } = useLocation()
  const { pendingCount } = useAlerts(localId)

  if (!localId) return null

  const navState = locState?.local ? { local: locState.local } : { local: { id: localId } }
  const isActive = pathname.includes('/administrativo/alertas')

  return (
    <button
      onClick={() => navigate(`/local/${localId}/administrativo/alertas`, { state: navState })}
      title={pendingCount > 0 ? `${pendingCount} alerta(s) pendiente(s)` : 'Alertas'}
      className={cn(
        'relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
        isActive
          ? 'bg-amber-100 text-amber-700'
          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
      )}
    >
      <Bell size={18} />
      {pendingCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
          {pendingCount > 99 ? '99+' : pendingCount}
        </span>
      )}
    </button>
  )
}

/* ── AppShell — persistent layout via Outlet ────────────────────── */
function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem('appSidebarCollapsed') === '1' } catch { return false }
  })

  const { pathname } = useLocation()
  const localIdMatch = pathname.match(/\/local\/([^/]+)/)
  const localId = localIdMatch ? localIdMatch[1] : null

  const handleToggle = () => {
    setCollapsed((v) => {
      const next = !v
      try { window.localStorage.setItem('appSidebarCollapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]">
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {localId && (
          <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-2 border-b border-[hsl(var(--border))] bg-white">
            <AlertBell localId={localId} />
          </div>
        )}
        <Outlet />
      </div>
    </div>
  )
}

export default AppShell
