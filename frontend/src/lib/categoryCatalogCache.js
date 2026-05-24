/** Caché en memoria por local para listados de categorías (HU-87). */

const TTL_MS = 5 * 60 * 1000

/** @type {Map<string, { rows: Array<{ id: string, name: string, is_active?: boolean }>, at: number }>} */
const byLocal = new Map()

export function getCachedCategories(localId) {
  if (!localId) return null
  const e = byLocal.get(String(localId))
  if (!e) return null
  if (Date.now() - e.at > TTL_MS) {
    byLocal.delete(String(localId))
    return null
  }
  return e.rows
}

export function setCachedCategories(localId, rows) {
  if (!localId) return
  const list = Array.isArray(rows) ? rows : []
  byLocal.set(String(localId), { rows: list, at: Date.now() })
}

export function mergeCategoryIntoCache(localId, row) {
  if (!localId || !row) return
  const cur = getCachedCategories(localId) || []
  const id = String(row.id)
  const idx = cur.findIndex((r) => String(r.id) === id)
  let next
  if (idx >= 0) {
    next = [...cur]
    next[idx] = { ...cur[idx], ...row }
  } else {
    next = [...cur, row]
  }
  setCachedCategories(localId, next)
}

