import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SuppliersKpisDashboard from './SuppliersKpisDashboard'
import { AuthProvider } from '../../context/AuthContext'
import * as providersApi from '../../lib/providersApi'

vi.mock('../../lib/apiClient', () => ({
  getAuthContext: vi.fn(() => Promise.resolve({ token: 'test-token', businessId: 'biz-1' })),
}))

const mockKpis = {
  total_suppliers: 4,
  active_suppliers: 3,
  month_purchases_clp: 1250000,
  year: 2026,
  month: 4,
  period_start: '2026-04-01',
  period_end: '2026-04-30',
}

const mockSupplierDetail = {
  id: 's-1',
  name: 'Proveedor Demo',
  is_active: true,
  rut: '12.345.678-5',
  phone: '+56 9 1111 2222',
  email: 'demo@example.com',
  address: 'Calle 1',
  contact_name: 'Ana',
  category: 'Insumos',
  purchased_products_count: 12,
  supplier_purchases_total_clp: 48000,
  purchased_products: [{ product_id: 'p-1', name: 'Item A', quantity: 12, unit_price_clp: 4000, line_total_clp: 48000 }],
}

vi.mock('../../lib/providersApi', () => ({
  getSupplierKpisByLocal: vi.fn(() => Promise.resolve(mockKpis)),
  getSuppliersWithMetricsForBusiness: vi.fn(() =>
    Promise.resolve([
      {
        id: 's-1',
        name: 'Proveedor Demo',
        is_active: true,
        purchased_products_count: 12,
        supplier_purchases_total_clp: 48000,
      },
    ]),
  ),
  getLocalById: vi.fn(() => Promise.resolve({ id: 'loc-1', business_id: 'biz-1' })),
  getSupplierDetailForBusiness: vi.fn(() => Promise.resolve(mockSupplierDetail)),
}))

const mockUser = { email: 'a@b.cl', user_metadata: {} }

function renderSuppliers(role = 'Admin') {
  return render(
    <AuthProvider user={mockUser} userRole={role} logout={vi.fn()}>
      <MemoryRouter initialEntries={['/local/loc-1/inventario/proveedores']}>
        <Routes>
          <Route path="/local/:localId/inventario/proveedores" element={<SuppliersKpisDashboard />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('SuppliersKpisDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra tres KPIs: total, activos y compras del mes', async () => {
    renderSuppliers('Admin')

    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    expect(screen.getByText('Total proveedores')).toBeInTheDocument()
    expect(screen.getByText('Proveedores activos')).toBeInTheDocument()
    expect(screen.getByText('Compras del mes (CLP)')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('$1.250.000')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Listado de proveedores/i })).toBeInTheDocument()
    })
    expect(screen.getByText('Proveedor Demo')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('$48.000')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Registrar proveedor/i })).toBeInTheDocument()
  })

  it('sin rol admin muestra mensaje de permisos', async () => {
    renderSuppliers('Empleado')

    await waitFor(() => {
      expect(
        screen.getByText(/Solo administradores pueden ver los KPIs de proveedores/i),
      ).toBeInTheDocument()
    })
  })

  it('abre el modal de registro al pulsar Registrar proveedor', async () => {
    const user = userEvent.setup()
    renderSuppliers('Admin')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Registrar proveedor/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Registrar proveedor/i }))

    expect(await screen.findByRole('heading', { name: /Registrar proveedor/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Nombre comercial/i })).toBeInTheDocument()
  })

  it('abre el modal de detalle al pulsar Ver detalle (HU-69)', async () => {
    const user = userEvent.setup()
    renderSuppliers('Admin')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ver detalle/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Ver detalle/i }))

    await waitFor(() => {
      expect(providersApi.getSupplierDetailForBusiness).toHaveBeenCalledWith('s-1', 'biz-1')
    })

    expect(await screen.findByRole('heading', { name: /Detalle del proveedor/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Proveedor Demo$/ })).toBeInTheDocument()
    expect(screen.getByText('Item A')).toBeInTheDocument()
  })
})
