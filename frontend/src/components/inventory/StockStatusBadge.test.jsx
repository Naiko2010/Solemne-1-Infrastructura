import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StockStatusBadge from './StockStatusBadge'

describe('StockStatusBadge', () => {
  it('muestra Crítico y data attribute', () => {
    render(<StockStatusBadge row={{ stock_status: 'CRITICO' }} />)
    expect(screen.getByText('Crítico')).toBeInTheDocument()
    expect(screen.getByText('Crítico')).toHaveAttribute('data-stock-status', 'critical')
  })

  it('muestra Óptimo para OPTIMO', () => {
    render(<StockStatusBadge row={{ stock_status: 'OPTIMO' }} />)
    const badge = screen.getByText('Óptimo')
    expect(badge).toHaveAttribute('data-stock-status', 'optimal')
  })
})
