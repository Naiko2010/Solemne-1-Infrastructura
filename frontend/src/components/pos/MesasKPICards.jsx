import { useMesasKPIs } from '../../hooks/useMesasKPIs'

const KPI_CONFIG = [
  {
    key: 'total',
    label: 'Total Mesas',
    colorClass: 'text-[hsl(var(--primary))]',
    bgClass: 'bg-[hsl(var(--primary))]/10',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-5 h-5">
        <rect x="3" y="8" width="18" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 11V18M19 11V18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M3 18H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'libres',
    label: 'Mesas Libres',
    colorClass: 'text-[hsl(var(--mesa-libre))]',
    bgClass: 'bg-[hsl(var(--mesa-libre))]/10',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-5 h-5">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'ocupadas',
    label: 'Mesas Ocupadas',
    colorClass: 'text-[hsl(var(--mesa-ocupada))]',
    bgClass: 'bg-[hsl(var(--mesa-ocupada))]/10',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-5 h-5">
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 19C5 15.686 8.134 13 12 13C15.866 13 19 15.686 19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'en_cobro',
    label: 'Mesas en Cobro',
    colorClass: 'text-[hsl(var(--mesa-cobro))]',
    bgClass: 'bg-[hsl(var(--mesa-cobro))]/10',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-5 h-5">
        <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 10H21" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 15H10M14 15H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
]

function KPICard({ config, value, loading, index }) {
  const staggerClass = `stagger-${Math.min(index + 1, 6)}`
  return (
    <article className={`animate-fade-in-up ${staggerClass} flex items-center gap-3 p-4 bg-white rounded-xl border border-[hsl(var(--border))] shadow-sm`}>
      <div className={`w-10 h-10 flex items-center justify-center rounded-lg shrink-0 ${config.bgClass} ${config.colorClass}`}>
        {config.icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-[hsl(var(--foreground))] leading-none">
          {loading ? '—' : value ?? 0}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{config.label}</p>
      </div>
    </article>
  )
}

export default function MesasKPICards({ localId, onRefreshReady }) {
  const { kpis, loading, error, refresh } = useMesasKPIs(localId)

  // Expose refresh fn to parent (POSModule)
  if (onRefreshReady) onRefreshReady(refresh)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Estado de Mesas</h3>
      </div>

      {error && (
        <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CONFIG.map((config, i) => (
          <KPICard
            key={config.key}
            config={config}
            value={kpis?.[config.key]}
            loading={loading}
            index={i}
          />
        ))}
      </div>

      {kpis?.generated_at && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Actualizado: {new Date(kpis.generated_at).toLocaleTimeString('es-AR')}
        </p>
      )}
    </section>
  )
}
