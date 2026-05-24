import { useCallback } from 'react'
import { getLocalById } from '../lib/providersApi'

/**
 * Resuelve `business_id` del local vía API (misma lógica que compras semanales).
 * @param {string|undefined} localId
 * @returns {() => Promise<string|null>}
 */
export function useLocalBusinessId(localId) {
  return useCallback(async () => {
    if (!localId) return null
    const loc = await getLocalById(localId)
    return loc?.business_id != null ? String(loc.business_id) : null
  }, [localId])
}
