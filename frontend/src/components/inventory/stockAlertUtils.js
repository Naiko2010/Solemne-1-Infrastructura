/**
 * % dispuesto = stock_actual / stock_máximo (qué fracción del tope tienes; ej. máx 100, actual 30 → 30%).
 * Umbrales sobre ese ratio: ≤25% crítico, ≤50% bajo, >50% óptimo.
 * Sin stock_máximo en la fila: no hay ratio; stock 0 → crítico, si no → óptimo.
 * Si el API envía `stock_status`, se respeta tal cual.
 */
const REF_CRIT_PCT = 0.25
const REF_LOW_PCT = 0.5

/** @returns {'critical' | 'low' | 'optimal'} */
export function stockLevelFromRow(row) {
  const sc = Number(row.stock_current ?? 0)
  const smaxRaw = row.stock_max
  const smax = smaxRaw != null && Number(smaxRaw) > 0 ? Number(smaxRaw) : null

  if (smax == null) {
    return sc <= 0 ? 'critical' : 'optimal'
  }

  // Ocupación: stock_actual / stock_máximo
  const ratio = sc / smax
  if (ratio <= REF_CRIT_PCT) return 'critical'
  if (ratio <= REF_LOW_PCT) return 'low'
  return 'optimal'
}

export function getStockAlertLevel(row) {
  const api = row.stock_status
  if (api === 'CRITICO') return 'critical'
  if (api === 'BAJO') return 'low'
  if (api === 'OPTIMO') return null

  const level = stockLevelFromRow(row)
  if (level === 'critical') return 'critical'
  if (level === 'low') return 'low'
  return null
}

/** Etiqueta en español y variante visual para badges de estado. */
export function getStockStatusMeta(row) {
  const level = getStockAlertLevel(row)
  if (level === 'critical') return { label: 'Crítico', variant: 'critical' }
  if (level === 'low') return { label: 'Bajo', variant: 'low' }
  return { label: 'Óptimo', variant: 'optimal' }
}
