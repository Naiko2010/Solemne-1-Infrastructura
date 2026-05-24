import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const mo = i + 1
  let label = String(mo)
  try {
    label = new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(new Date(2000, mo - 1, 15))
    label = label.charAt(0).toUpperCase() + label.slice(1)
  } catch { /* keep */ }
  return { value: mo, label }
})

/* Years from 1960 to current+1 — ascending so oldest is at top of list */
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR + 2 - 1960 },
  (_, i) => 1960 + i,
)

function parseIsoToParts(iso) {
  if (!iso || typeof iso !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, mo, d }
}

function partsToIso(y, mo, d) {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function daysInMonth(y, mo) {
  return new Date(y, mo, 0).getDate()
}

function formatDisplay(iso) {
  const p = parseIsoToParts(iso)
  if (!p) return ''
  try {
    return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(
      new Date(p.y, p.mo - 1, p.d),
    )
  } catch { return iso }
}

function monthTitle(y, mo) {
  try {
    return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date(y, mo - 1, 1))
  } catch { return `${mo}/${y}` }
}

/**
 * Selector de fecha con calendario propio (sin input[type=date] nativo).
 * value / onChange usan ISO `YYYY-MM-DD`.
 */
function ModernDateField({ id, label, value, onChange, disabled, 'aria-label': ariaLabel }) {
  const autoId  = useId()
  const fieldId = id || `mdate-${autoId}`

  const [open, setOpen]       = useState(false)
  const [panelBox, setPanelBox] = useState(null)

  const wrapRef    = useRef(null)
  const controlRef = useRef(null)
  const btnRef     = useRef(null)
  const panelRef   = useRef(null)

  const selected = parseIsoToParts(value)
  const [view, setView] = useState(() => ({
    y:  selected?.y  ?? CURRENT_YEAR,
    mo: selected?.mo ?? new Date().getMonth() + 1,
  }))
  const { y: viewY, mo: viewMo } = view

  /* Sync view with value whenever panel opens */
  useEffect(() => {
    if (!open) return
    const p = parseIsoToParts(value)
    if (p) setView({ y: p.y, mo: p.mo })
  }, [open, value])

  /* Day grid */
  const cells = useMemo(() => {
    const firstDow = new Date(viewY, viewMo - 1, 1).getDay()
    const total    = daysInMonth(viewY, viewMo)
    const out = []
    for (let i = 0; i < firstDow; i++) out.push({ type: 'blank', key: `b-${i}` })
    for (let d = 1; d <= total; d++) out.push({ type: 'day', d, key: `d-${d}` })
    while (out.length % 7 !== 0) out.push({ type: 'blank', key: `t-${out.length}` })
    return out
  }, [viewY, viewMo])

  const close = useCallback(() => setOpen(false), [])

  /* Position panel below trigger */
  useLayoutEffect(() => {
    if (!open) { setPanelBox(null); return }
    const EST_H = 360
    const place = () => {
      const anchor = controlRef.current || btnRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const vw = window.innerWidth, vh = window.innerHeight, margin = 8
      let width = Math.max(300, Math.round(rect.width))
      width = Math.min(width, vw - 2 * margin)
      let left = rect.right - width
      if (left < margin) left = margin
      if (left + width > vw - margin) left = Math.max(margin, vw - margin - width)
      let top = rect.bottom + 6
      if (top + EST_H > vh - margin) top = Math.max(margin, rect.top - EST_H - 6)
      setPanelBox({
        position: 'fixed',
        top:   `${Math.round(top)}px`,
        left:  `${Math.round(left)}px`,
        width: `${Math.round(width)}px`,
        zIndex: 99999,
        pointerEvents: 'auto',
      })
    }
    let r1 = requestAnimationFrame(() => { place(); requestAnimationFrame(place) })
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { cancelAnimationFrame(r1); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])

  /* Close on outside click — use target.closest() because composedPath() may be
     empty when called from a document-level listener after propagation ends */
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      const t = e.target
      const wrap  = wrapRef.current
      const panel = panelRef.current
      if (wrap  && (wrap === t  || wrap.contains(t)))  return
      if (panel && (panel === t || panel.contains(t))) return
      close()
    }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown',   onKey)
    }
  }, [open, close])

  /* Stop pointerdown/mousedown from reaching Radix's document-level DismissableLayer.
     We use a NATIVE listener on the actual panel DOM node so it fires during the DOM
     bubble phase, before any document-level listener regardless of registration order.
     We do NOT stop `click`, so pickDay (onClick) and onChange (select) still fire. */
  useEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return
    const stop = (e) => e.stopPropagation()
    panel.addEventListener('pointerdown', stop)
    panel.addEventListener('mousedown', stop)
    return () => {
      panel.removeEventListener('pointerdown', stop)
      panel.removeEventListener('mousedown', stop)
    }
  }, [open, panelBox])

  const shiftMonth = (delta) =>
    setView(({ y, mo }) => {
      const d = new Date(y, mo - 1 + delta, 1)
      return { y: d.getFullYear(), mo: d.getMonth() + 1 }
    })

  const setMonth = (mo) => {
    const m = Number(mo)
    if (!Number.isFinite(m) || m < 1 || m > 12) return
    setView(({ y }) => ({ y, mo: m }))
  }

  const setYear = (y) => {
    const yy = Number(y)
    if (!Number.isFinite(yy)) return
    setView(({ mo }) => ({ y: yy, mo }))
  }

  const pickDay = (d) => {
    const safe = Math.min(Math.max(1, d), daysInMonth(viewY, viewMo))
    onChange?.(partsToIso(viewY, viewMo, safe))
    close()
    btnRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-1.5" ref={wrapRef}>
      {label && (
        <span className="text-sm font-medium text-[hsl(var(--foreground))]" id={`${fieldId}-lbl`}>
          {label}
        </span>
      )}

      <div className="flex items-center gap-2" ref={controlRef}>
        <button
          ref={btnRef}
          type="button"
          id={fieldId}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-labelledby={label ? `${fieldId}-lbl` : undefined}
          aria-label={!label ? (ariaLabel || 'Fecha') : undefined}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-white text-sm shadow-sm hover:bg-[hsl(var(--accent))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] disabled:opacity-50 min-w-[180px]"
        >
          <Calendar size={16} className="text-[hsl(var(--muted-foreground))] shrink-0" />
          <span>{value ? formatDisplay(value) : 'Seleccionar fecha'}</span>
        </button>
      </div>

      {open && panelBox && createPortal(
        <div
          ref={panelRef}
          id={`${fieldId}-panel`}
          role="dialog"
          aria-label="Calendario"
          data-calendar-panel="true"
          style={panelBox}
          onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation() }}
          onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation() }}
          className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-2xl p-4 flex flex-col gap-3"
        >
          {/* Month / year navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Mes anterior"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] shrink-0 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex gap-2 flex-1 justify-center">
              {/* Month selector */}
              <select
                value={viewMo}
                onChange={(e) => setMonth(e.target.value)}
                aria-label="Mes"
                className="h-8 rounded-lg border border-[hsl(var(--border))] bg-white px-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] cursor-pointer"
              >
                {MONTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {/* Year selector — full range 1960 → current+1 */}
              <select
                value={viewY}
                onChange={(e) => setYear(e.target.value)}
                aria-label="Año"
                className="h-8 rounded-lg border border-[hsl(var(--border))] bg-white px-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] cursor-pointer w-20"
              >
                {YEAR_OPTIONS.map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Mes siguiente"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] shrink-0 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1" aria-hidden="true">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-center text-xs font-bold text-[hsl(var(--muted-foreground))] py-1">
                {w}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c) =>
              c.type === 'blank' ? (
                <span key={c.key} />
              ) : (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => pickDay(c.d)}
                  className={cn(
                    'w-full aspect-square rounded-lg text-sm font-medium transition-colors flex items-center justify-center',
                    selected && selected.y === viewY && selected.mo === viewMo && selected.d === c.d
                      ? 'bg-[hsl(var(--primary))] text-white font-bold'
                      : 'hover:bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]',
                  )}
                >
                  {c.d}
                </button>
              ),
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export default ModernDateField
