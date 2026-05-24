import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import ErrorBoundary from '../components/ErrorBoundary'
import AdminDashboard from '../components/AdminDashboard'
import LocalDashboard from '../components/LocalDashboard'
import AdministrativeModule from '../components/AdministrativeModule'
import InventoryHub from '../components/inventory/InventoryHub'
import StockControlDashboard from '../components/inventory/StockControlDashboard'
import SuppliersKpisDashboard from '../components/inventory/SuppliersKpisDashboard'
import WeeklyPurchasesPage from '../components/inventory/weeklyPurchases/WeeklyPurchasesPage'
import WeeklyPurchaseDetailPage from '../components/inventory/weeklyPurchases/WeeklyPurchaseDetailPage'
import RecipesPage from '../components/inventory/recipes/RecipesPage'
import POSModule from '../components/pos/POSModule'
import MesaDetail from '../components/pos/MesaDetail'
import WorkerLocalSelector from '../components/WorkerLocalSelector'
import { WORKER_ROLES } from '../constants/roles'
import { isSuperAdminRole } from '../auth/roleLabel'
import { useAuth } from '../context/AuthContext'

/** Opt-in a banderas de React Router v7 (menos advertencias en consola durante el desarrollo). */
const ROUTER_FUTURE_FLAGS = { v7_startTransition: true, v7_relativeSplatPath: true }

/** Persistent layout wrapper — sidebar stays mounted across all admin routes */
function AdminLayout() {
  return <AppShell />
}

/** /local/:id sin subruta → redirige al dashboard del local */
function LocalModulesHomeRedirect() {
  const { localId } = useParams()
  const { state } = useLocation()
  return <Navigate to={`/local/${localId}/dashboard`} replace state={state ?? {}} />
}

/** Rutas antiguas bajo /proveedores/compras-semanales → URL canónica /inventario/compras-semanales */
function LegacyProveedoresComprasSemanalesRedirect() {
  const { localId } = useParams()
  return <Navigate to={`/local/${localId}/inventario/compras-semanales`} replace />
}

function LegacyProveedoresComprasSemanalesDetailRedirect() {
  const { localId, orderId } = useParams()
  return <Navigate to={`/local/${localId}/inventario/compras-semanales/${orderId}`} replace />
}

/** @param {'superadmin' | 'admin'} variant */
function AdminAppRoutes({ variant }) {
  const homeAtRoot = variant === 'admin'
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        {homeAtRoot && <Route path="/" element={<AdminDashboard />} />}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/local/:localId/inventario/stock" element={<StockControlDashboard />} />
        <Route path="/local/:localId/inventario/recipes" element={<RecipesPage />} />
        <Route path="/local/:localId/inventario/compras-semanales/:orderId" element={<WeeklyPurchaseDetailPage />} />
        <Route path="/local/:localId/inventario/compras-semanales" element={<WeeklyPurchasesPage />} />
        <Route
          path="/local/:localId/inventario/proveedores/compras-semanales/:orderId"
          element={<LegacyProveedoresComprasSemanalesDetailRedirect />}
        />
        <Route
          path="/local/:localId/inventario/proveedores/compras-semanales"
          element={<LegacyProveedoresComprasSemanalesRedirect />}
        />
        <Route path="/local/:localId/inventario/proveedores" element={<SuppliersKpisDashboard />} />
        <Route path="/local/:localId/inventario" element={<InventoryHub />} />
        <Route path="/local/:localId/administrativo/:sectionId?" element={<AdministrativeModule />} />
        <Route path="/local/:localId/pos" element={<POSModule />} />
        <Route path="/local/:localId/pos/mesa/:mesaId" element={<MesaDetail />} />
        <Route path="/local/:localId/dashboard" element={<LocalDashboard />} />
        <Route path="/local/:localId" element={<LocalModulesHomeRedirect />} />
        {homeAtRoot ? (
          <Route path="*" element={<Navigate to="/" replace />} />
        ) : (
          <>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </>
        )}
      </Route>
    </Routes>
  )
}

function WorkerAppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WorkerLocalSelector />} />
      <Route path="/local/:localId/pos" element={<POSModule />} />
      <Route path="/local/:localId/pos/mesa/:mesaId" element={<MesaDetail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function AuthenticatedApp() {
  const { userRole } = useAuth()

  let routes = <AdminAppRoutes variant="admin" />
  if (isSuperAdminRole(userRole)) {
    routes = <AdminAppRoutes variant="superadmin" />
  } else if (WORKER_ROLES.includes(userRole)) {
    routes = <WorkerAppRoutes />
  }

  return (
    <ErrorBoundary>
      <Router future={ROUTER_FUTURE_FLAGS}>{routes}</Router>
    </ErrorBoundary>
  )
}
