import { cn } from '@/lib/utils'

const OPTIONS = [
  {
    value: 'CRITICO',
    label: 'Crítico',
    activeClass: 'bg-red-500 text-white border-red-500',
    inactiveClass:
      'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-300',
  },
  {
    value: 'BAJO',
    label: 'Bajo',
    activeClass: 'bg-amber-500 text-white border-amber-500',
    inactiveClass:
      'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300',
  },
  {
    value: 'OPTIMO',
    label: 'Óptimo',
    activeClass: 'bg-emerald-500 text-white border-emerald-500',
    inactiveClass:
      'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300',
  },
]

/** Filtro por estado de stock como pills de toggle coloreados. */
function StatusFilterCheckboxes({ value, onChange }) {
  const toggle = (v) => {
    const set = new Set(value)
    if (set.has(v)) set.delete(v)
    else set.add(v)
    onChange([...set].sort())
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide shrink-0">
        Estado:
      </span>
      {OPTIONS.map((opt) => {
        const isActive = value.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer select-none',
              isActive ? opt.activeClass : opt.inactiveClass,
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default StatusFilterCheckboxes
