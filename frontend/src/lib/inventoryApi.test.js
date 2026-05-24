import { describe, it, expect } from 'vitest'
import {
  buildInventoryStockListPath,
  buildInventoryProductsPath,
  buildSuppliersWithMetricsPath,
  buildSupplierDetailPath,
  buildSupplierPurchaseHistoryPath,
  buildCategoriesListPath,
} from './inventoryApi'

describe('buildInventoryStockListPath (HU-47/HU-48 filtros)', () => {
  const local = '11111111-1111-1111-1111-111111111111'
  const cat = '22222222-2222-2222-2222-222222222222'

  it('sin filtros: solo path base', () => {
    expect(buildInventoryStockListPath(local)).toBe(`/inventory/locals/${local}/stock`)
  })

  it('incluye category', () => {
    expect(buildInventoryStockListPath(local, { category: cat })).toBe(
      `/inventory/locals/${local}/stock?category=${encodeURIComponent(cat)}`,
    )
  })

  it('incluye search recortado', () => {
    expect(buildInventoryStockListPath(local, { search: '  arroz  ' })).toBe(
      `/inventory/locals/${local}/stock?search=${encodeURIComponent('arroz')}`,
    )
  })

  it('combina category y search', () => {
    const path = buildInventoryStockListPath(local, { category: cat, search: 'leche' })
    expect(path).toContain(`category=${encodeURIComponent(cat)}`)
    expect(path).toContain(`search=${encodeURIComponent('leche')}`)
    expect(path.startsWith(`/inventory/locals/${local}/stock?`)).toBe(true)
  })

  it('omite search vacío', () => {
    expect(buildInventoryStockListPath(local, { search: '   ' })).toBe(`/inventory/locals/${local}/stock`)
  })

  it('repite status en la query cuando hay varios', () => {
    const path = buildInventoryStockListPath(local, { status: ['CRITICO', 'BAJO'] })
    expect(path).toContain('status=CRITICO')
    expect(path).toContain('status=BAJO')
    expect(path.split('status=').length - 1).toBe(2)
  })

  it('combina status con category', () => {
    const path = buildInventoryStockListPath(local, {
      category: cat,
      status: ['OPTIMO'],
    })
    expect(path).toContain(`category=${encodeURIComponent(cat)}`)
    expect(path).toContain('status=OPTIMO')
  })

  it('incluye limit y offset en /stock cuando se pasan', () => {
    const path = buildInventoryStockListPath(local, { limit: 10, offset: 20 })
    expect(path).toContain('limit=10')
    expect(path).toContain('offset=20')
  })
})

describe('buildInventoryProductsPath (listado paginado /products)', () => {
  const local = '11111111-1111-1111-1111-111111111111'
  const cat = '22222222-2222-2222-2222-222222222222'

  it('incluye limit y offset por defecto', () => {
    const path = buildInventoryProductsPath(local, {})
    expect(path).toContain(`/inventory/locals/${local}/products?`)
    expect(path).toContain('limit=50')
    expect(path).toContain('offset=0')
  })

  it('combina filtros con paginación', () => {
    const path = buildInventoryProductsPath(local, {
      category: cat,
      search: 'arroz',
      status: ['BAJO'],
      limit: 10,
      offset: 30,
    })
    expect(path).toContain(`category=${encodeURIComponent(cat)}`)
    expect(path).toContain('search=arroz')
    expect(path).toContain('status=BAJO')
    expect(path).toContain('limit=10')
    expect(path).toContain('offset=30')
  })
})

describe('buildSuppliersWithMetricsPath (HU-68)', () => {
  it('incluye business_id en query', () => {
    const bid = '33333333-3333-3333-3333-333333333333'
    expect(buildSuppliersWithMetricsPath(bid)).toBe(`/suppliers?business_id=${encodeURIComponent(bid)}`)
  })

  it('HU-85: añade search y category cuando vienen en filters', () => {
    const bid = '33333333-3333-3333-3333-333333333333'
    const path = buildSuppliersWithMetricsPath(bid, { search: '  acme ', category: ' Insumos ' })
    expect(path).toContain(`business_id=${encodeURIComponent(bid)}`)
    expect(path).toContain(`search=${encodeURIComponent('acme')}`)
    expect(path).toContain(`category=${encodeURIComponent('Insumos')}`)
  })
})

describe('buildSupplierDetailPath (HU-69)', () => {
  it('incluye supplier id y business_id', () => {
    const sid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const bid = '33333333-3333-3333-3333-333333333333'
    expect(buildSupplierDetailPath(sid, bid)).toBe(
      `/suppliers/${encodeURIComponent(sid)}?business_id=${encodeURIComponent(bid)}`,
    )
  })
})

describe('buildCategoriesListPath (HU-87)', () => {
  const local = '11111111-1111-1111-1111-111111111111'

  it('incluye local_id en query', () => {
    expect(buildCategoriesListPath(local)).toBe(`/categories?local_id=${encodeURIComponent(local)}`)
  })
})

describe('buildSupplierPurchaseHistoryPath (HU-84)', () => {
  const sid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  const bid = '33333333-3333-3333-3333-333333333333'

  it('incluye business_id', () => {
    expect(buildSupplierPurchaseHistoryPath(sid, bid)).toBe(
      `/suppliers/${encodeURIComponent(sid)}/purchase-history?business_id=${encodeURIComponent(bid)}`,
    )
  })

  it('incluye week_from y week_to cuando se pasan', () => {
    const path = buildSupplierPurchaseHistoryPath(sid, bid, {
      weekFrom: '2026-04-06',
      weekTo: '2026-04-20',
    })
    expect(path).toContain(`business_id=${encodeURIComponent(bid)}`)
    expect(path).toContain('week_from=2026-04-06')
    expect(path).toContain('week_to=2026-04-20')
  })
})
