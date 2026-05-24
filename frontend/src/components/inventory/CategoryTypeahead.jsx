import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { resolveCategoryNameForLocal } from '../../lib/inventoryApi'
import { cn } from '@/lib/utils'

/**
 * Categoría libre (HU-87): sin listado de sugerencias; escribes el nombre y Enter
 * crea la fila en `categories` del local o reutiliza una existente (mismo nombre, sin distinguir mayúsculas).
 */
function CategoryTypeahead({ localId, value, onChange, disabled, 'aria-invalid': ariaInvalid }) {
  const baseId = useId()
  const inputDomId = `${baseId}-input`
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [okHint, setOkHint] = useState(false)
  const okTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (okTimerRef.current) clearTimeout(okTimerRef.current)
    }
  }, [])

  const commitCategory = useCallback(async () => {
    const trimmed = String(value || '').trim()
    if (!trimmed || !localId || disabled) return
    setLoadError('')
    setSaving(true)
    setOkHint(false)
    if (okTimerRef.current) clearTimeout(okTimerRef.current)
    try {
      const name = await resolveCategoryNameForLocal(localId, trimmed)
      onChange(name)
      setOkHint(true)
      okTimerRef.current = setTimeout(() => setOkHint(false), 2200)
    } catch (err) {
      setOkHint(false)
      setLoadError(err?.message || 'No se pudo guardar la categoría.')
    } finally {
      setSaving(false)
    }
  }, [localId, value, onChange, disabled])

  const onKeyDown = (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault()
      ev.stopPropagation()
      void commitCategory()
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        id={inputDomId}
        type="text"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        aria-invalid={ariaInvalid || undefined}
        disabled={disabled || saving}
        placeholder="Escribe la categoría y pulsa Enter para guardarla"
        className={cn(
          'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-white px-3 py-1 text-sm shadow-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] disabled:opacity-50',
          ariaInvalid && 'border-[hsl(var(--destructive))]'
        )}
      />
      {loadError ? (
        <p className="text-xs text-[hsl(var(--destructive))]" role="alert">
          {loadError}
        </p>
      ) : null}
      {saving ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]" aria-live="polite">
          Guardando categoría…
        </p>
      ) : null}
      {okHint && !loadError && !saving ? (
        <p className="text-xs text-emerald-600" aria-live="polite">
          Categoría guardada en el local.
        </p>
      ) : null}
    </div>
  )
}

export default CategoryTypeahead
