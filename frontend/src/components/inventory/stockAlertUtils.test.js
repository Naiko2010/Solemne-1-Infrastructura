import { describe, it, expect } from 'vitest'
import { getStockStatusMeta, getStockAlertLevel, stockLevelFromRow } from './stockAlertUtils'

describe('stockAlertUtils', () => {
  it('usa stock_status del API', () => {
    expect(getStockAlertLevel({ stock_status: 'CRITICO', stock_current: 5 })).toBe('critical')
    expect(getStockStatusMeta({ stock_status: 'CRITICO' }).variant).toBe('critical')
    expect(getStockStatusMeta({ stock_status: 'CRITICO' }).label).toBe('Crítico')

    expect(getStockStatusMeta({ stock_status: 'BAJO' }).variant).toBe('low')
    expect(getStockStatusMeta({ stock_status: 'BAJO' }).label).toBe('Bajo')

    expect(getStockStatusMeta({ stock_status: 'OPTIMO' }).variant).toBe('optimal')
    expect(getStockStatusMeta({ stock_status: 'OPTIMO' }).label).toBe('Óptimo')
  })

  it('clasifica por % del actual vs máximo (25% / 50%)', () => {
    expect(stockLevelFromRow({ stock_current: 25, stock_min: 0, stock_max: 100 })).toBe('critical')
    expect(stockLevelFromRow({ stock_current: 26, stock_min: 0, stock_max: 100 })).toBe('low')
    expect(stockLevelFromRow({ stock_current: 50, stock_min: 0, stock_max: 100 })).toBe('low')
    expect(stockLevelFromRow({ stock_current: 51, stock_min: 0, stock_max: 100 })).toBe('optimal')
  })

  it('sin máximo no calcula %; solo agotado es crítico', () => {
    expect(stockLevelFromRow({ stock_current: 0, stock_min: 10, stock_max: null })).toBe('critical')
    expect(stockLevelFromRow({ stock_current: 10, stock_min: 10, stock_max: null })).toBe('optimal')
  })

  it('sin API status aplica la misma regla', () => {
    expect(getStockAlertLevel({ stock_current: 20, stock_min: 0, stock_max: 100 })).toBe('critical')
    expect(getStockAlertLevel({ stock_current: 40, stock_min: 0, stock_max: 100 })).toBe('low')
    expect(getStockAlertLevel({ stock_current: 60, stock_min: 0, stock_max: 100 })).toBe(null)
    expect(getStockStatusMeta({ stock_current: 60, stock_min: 0, stock_max: 100 }).label).toBe('Óptimo')
  })
})
