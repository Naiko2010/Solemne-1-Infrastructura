import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocals } from './useLocals'

/**
 * Resuelve el local activo según router state y/o catálogo de locales.
 *
 * @param {string|undefined} localId — `:localId` de la ruta
 * @param {'state-then-placeholder' | 'state-then-locales' | 'locales-only'} [strategy]
 *   - state-then-placeholder: `location.state.local` o `{ id, name: 'Local …' }` (inventario)
 *   - state-then-locales: state, luego `useLocals().find`, o `null` (administrativo)
 *   - locales-only: solo catálogo, sin `location.state` (POS)
 */
export function useSelectedLocal(localId, strategy = 'state-then-placeholder') {
  const location = useLocation()
  const { locales } = useLocals()

  return useMemo(() => {
    if (strategy !== 'locales-only' && location.state?.local) {
      return location.state.local
    }
    if (strategy === 'state-then-locales' || strategy === 'locales-only') {
      return locales.find((l) => String(l.id) === String(localId)) ?? null
    }
    return { id: localId, name: `Local ${localId ?? ''}` }
  }, [location.state, localId, locales, strategy])
}
