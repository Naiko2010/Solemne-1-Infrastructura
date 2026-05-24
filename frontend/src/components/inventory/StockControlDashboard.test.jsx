import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import StockControlDashboard from './StockControlDashboard'
import { AuthProvider } from '../../context/AuthContext'

vi.mock('../../lib/apiClient', () => ({
  getAuthContext: vi.fn(() => Promise.resolve({ token: 'test-token' })),
}))

const mockKpis = {
  total_products: 5,
  optimal_stock_count: 2,
  low_stock_count: 1,
  critical_stock_count: 1,
  total_value: 468000,
}

vi.mock('../../lib/inventoryApi', () => ({
  getInventoryKpisByLocal: vi.fn(() => Promise.resolve(mockKpis)),
  getInventoryProductsPage: vi.fn(() =>
    Promise.resolve({ items: [], total: 0, limit: 10, offset: 0 }),
  ),
  getInventoryStockList: vi.fn(() => Promise.resolve([])),
  patchInventoryProductUnitCost: vi.fn(),
  patchInventoryStock: vi.fn(),
}))

const mockUser = { email: 'a@b.cl', user_metadata: {} }

function renderStock() {
  return render(
    <AuthProvider user={mockUser} userRole="Admin" logout={vi.fn()}>
      <MemoryRouter initialEntries={['/local/loc-1/inventario/stock']}>
        <Routes>
          <Route path="/local/:localId/inventario/stock" element={<StockControlDashboard />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('StockControlDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra cinco KPIs en orden: total, óptimo, bajo, crítico, valor', async () => {
    renderStock()

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    const region = screen.getByRole('region', { name: /KPIs de inventario/i })
    const labels = [
      'Total productos',
      'Stock óptimo',
      'Stock bajo',
      'Stock crítico',
      'Valor total',
    ]
    labels.forEach((label) => {
      expect(within(region).getByText(label)).toBeInTheDocument()
    })

    const values = [...region.querySelectorAll('p.text-xl')].map((el) => el.textContent.trim())
    expect(values).toEqual(['5', '2', '1', '1', '$468.000'])
  })
})
