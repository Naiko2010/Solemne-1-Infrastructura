import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/**
 * Listado de mesas en vista gráfica (tarjetas)
 */
export default function MesasVisualization({ mesas = [], loading = false, onMesaSelect = null, onEditMesa = null, onDeleteMesa = null }) {

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando mesas...</p>
      </div>
    )
  }

  if (!mesas || mesas.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center gap-3 text-[hsl(var(--muted-foreground))]">
        <svg className="w-12 h-12 opacity-30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <p className="text-sm">No hay mesas para mostrar</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
      {mesas.map((mesa, i) => (
        <MesaCard
          key={mesa.id}
          mesa={mesa}
          index={i}
          onMesaSelect={onMesaSelect}
          onEditMesa={onEditMesa}
          onDeleteMesa={onDeleteMesa}
        />
      ))}
    </div>
  )
}

const STATE_COLORS = {
  libre:    'hsl(var(--mesa-libre))',
  ocupada:  'hsl(var(--mesa-ocupada))',
  en_cobro: 'hsl(var(--mesa-cobro))',
  inactiva: 'hsl(var(--mesa-inactiva))',
}

const STATE_BG = {
  libre:    'bg-[hsl(var(--mesa-libre))]/10',
  ocupada:  'bg-[hsl(var(--mesa-ocupada))]/10',
  en_cobro: 'bg-[hsl(var(--mesa-cobro))]/10',
  inactiva: 'bg-[hsl(var(--mesa-inactiva))]/10',
}

const STATE_BADGE_BG = {
  libre:    'bg-[hsl(var(--mesa-libre))]/15 text-[hsl(var(--mesa-libre))]',
  ocupada:  'bg-[hsl(var(--mesa-ocupada))]/15 text-[hsl(var(--mesa-ocupada))]',
  en_cobro: 'bg-[hsl(var(--mesa-cobro))]/15 text-[hsl(var(--mesa-cobro))]',
  inactiva: 'bg-[hsl(var(--mesa-inactiva))]/15 text-[hsl(var(--mesa-inactiva))]',
}

const STATE_LABEL = {
  libre:    'Libre',
  ocupada:  'Ocupada',
  en_cobro: 'En Cobro',
  inactiva: 'Inactiva',
}

const STATE_BTN = {
  libre:    'bg-[hsl(var(--mesa-libre))] hover:bg-[hsl(var(--mesa-libre))]/90 text-white',
  ocupada:  'bg-[hsl(var(--mesa-ocupada))] hover:bg-[hsl(var(--mesa-ocupada))]/90 text-white',
  en_cobro: 'bg-[hsl(var(--mesa-cobro))] hover:bg-[hsl(var(--mesa-cobro))]/90 text-white',
  inactiva: 'bg-[hsl(var(--mesa-inactiva))]/40 text-[hsl(var(--muted-foreground))] cursor-not-allowed',
}

function MesaCard({ mesa, index, onMesaSelect, onEditMesa, onDeleteMesa }) {
  const stateKey = mesa.is_active ? (mesa.state || 'libre') : 'inactiva'
  const stateLabel = STATE_LABEL[stateKey] || 'Libre'
  const borderColor = STATE_COLORS[stateKey] || STATE_COLORS.libre

  const handleOpen = () => onMesaSelect && onMesaSelect(mesa)
  const handleEdit = (e) => { e.stopPropagation(); onEditMesa && onEditMesa(mesa) }
  const handleDelete = (e) => { e.stopPropagation(); onDeleteMesa && onDeleteMesa(mesa) }

  const staggerClass = `stagger-${Math.min((index % 6) + 1, 6)}`

  return (
    <div
      className={`animate-fade-in-up ${staggerClass} relative flex flex-col rounded-xl border border-[hsl(var(--border))] bg-white shadow-sm overflow-hidden`}
      style={{ borderLeftColor: borderColor, borderLeftWidth: '4px' }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 pt-3 pb-2 ${STATE_BG[stateKey]}`}>
        <span className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
          {mesa.name || mesa.numero}
        </span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATE_BADGE_BG[stateKey]}`}>
          {stateLabel}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1 flex-1">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{mesa.zona || 'General'}</p>
        <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
            <path d="M5 19C5 15.686 8.134 13 12 13C15.866 13 19 15.686 19 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>{mesa.capacidad || 4} personas</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 pb-3 flex items-center gap-1">
        <button
          className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${STATE_BTN[stateKey]}`}
          onClick={handleOpen}
          disabled={!mesa.is_active}
        >
          {stateKey === 'inactiva' ? 'Inactiva' : 'Abrir Mesa'}
        </button>

        <div className="flex items-center gap-1 ml-1">
          {onEditMesa && (
            <button
              className="w-6 h-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] transition-colors text-xs"
              onClick={handleEdit}
              title="Editar mesa"
              aria-label="Editar mesa"
            >
              ✎
            </button>
          )}
          {onDeleteMesa && (
            <button
              className="w-6 h-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] hover:bg-red-50 transition-colors text-xs"
              onClick={handleDelete}
              title="Eliminar mesa"
              aria-label="Eliminar mesa"
            >
              🗑
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
