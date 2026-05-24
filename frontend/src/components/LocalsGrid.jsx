import { Building2, MapPin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

function LocalCard({ local, index, onSelect }) {
  const initials = local.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <button
      type="button"
      onClick={() => onSelect(local, index)}
      className="group relative w-full text-left overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-white shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
    >
      {/* Header */}
      <div className="relative px-6 py-6 overflow-hidden bg-[hsl(var(--primary))]">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full border-[20px] border-white" />
          <div className="absolute -right-2 -bottom-10 h-24 w-24 rounded-full border-[16px] border-white" />
        </div>

        <div className="relative flex items-center gap-4">
          {/* Avatar with initials */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/30">
            <span className="text-lg font-black text-white tracking-tight">{initials}</span>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-white text-lg leading-tight truncate">{local.name}</h3>
            {local.address ? (
              <div className="mt-1 flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-white/70 shrink-0" />
                <p className="text-xs text-white/75 truncate">{local.address}</p>
              </div>
            ) : (
              <p className="text-xs text-white/50 mt-1">Sin dirección registrada</p>
            )}
          </div>
        </div>
      </div>

    </button>
  )
}

function LocalsGrid({ locales, onLocalSelect, onCreateLocal }) {
  return (
    <div className="min-h-full bg-[hsl(var(--background))]">
      {/* Page hero */}
      <div
        className="px-6 py-12"
        style={{ background: 'linear-gradient(160deg, hsl(var(--primary)/0.06) 0%, hsl(var(--background)) 70%)' }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary)/0.1)] px-3 py-1 text-xs font-semibold text-[hsl(var(--primary))] mb-3">
                <Building2 className="h-3.5 w-3.5" />
                SibaGestión
              </div>
              <h1 className="text-3xl font-black text-[hsl(var(--foreground))] tracking-tight">
                Tus Locales
              </h1>
              <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))] max-w-md">
                {locales.length > 0
                  ? `Tienes ${locales.length} local${locales.length !== 1 ? 'es' : ''} registrado${locales.length !== 1 ? 's' : ''}. Selecciona uno para gestionarlo.`
                  : 'Crea tu primer local para comenzar a operar.'}
              </p>
            </div>
            <Button onClick={onCreateLocal} className="shrink-0 gap-2 rounded-xl px-5">
              <Plus className="h-4 w-4" />
              Crear Local
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-12">
        <div className="mx-auto max-w-5xl">
          {locales.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[hsl(var(--border))] bg-white py-24 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/0.08)]">
                <Building2 className="h-10 w-10 text-[hsl(var(--primary))]" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-[hsl(var(--foreground))]">
                No hay locales disponibles
              </h3>
              <p className="mb-8 text-sm text-[hsl(var(--muted-foreground))] max-w-xs">
                Agrega tu primer local para empezar a gestionar tu negocio con SibaGestión.
              </p>
              <Button onClick={onCreateLocal} className="gap-2 rounded-xl px-6">
                <Plus className="h-4 w-4" />
                Crear primer local
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {locales.map((local, i) => (
                <LocalCard
                  key={local.id}
                  local={local}
                  index={i}
                  onSelect={onLocalSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LocalsGrid
