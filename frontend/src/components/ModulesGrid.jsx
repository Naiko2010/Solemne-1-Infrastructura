import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, UtensilsCrossed, Package, Settings, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const modules = [
  {
    id: 'administrativo',
    title: 'Administrativo',
    subtitle: 'Gestión financiera y operativa del negocio',
    Icon: LayoutGrid,
    features: ['Dashboard', 'Flujo de Caja', 'Ventas', 'Alertas', 'Rendiciones', 'Bonos', 'Reportes'],
    disabled: false,
  },
  {
    id: 'pos',
    title: 'POS Restaurante',
    subtitle: 'Sistema punto de venta para restaurante y bar',
    Icon: UtensilsCrossed,
    features: ['Gestión de Mesas', 'Menú', 'Pantalla Bar', 'Pantalla Cocina', 'Toma de Pedidos'],
    disabled: false,
  },
  {
    id: 'inventario',
    title: 'Inventario',
    subtitle: 'Recetas, stock de productos y proveedores',
    Icon: Package,
    features: ['Recetas', 'Stock de productos', 'Proveedores', 'Órdenes de Compra'],
    disabled: false,
  },
  {
    id: 'configuracion',
    title: 'Configuración',
    subtitle: 'Administración del sistema y usuarios',
    Icon: Settings,
    features: ['Gestión de Usuarios', 'Configuración General', 'Parámetros del Sistema', 'Auditoría'],
    disabled: true,
  },
]

function ModulesGrid({ localId, localName }) {
  const navigate = useNavigate()

  const moduleNavState = useMemo(
    () => ({ local: { id: localId, name: localName || 'Local' } }),
    [localId, localName],
  )

  const handleModuleClick = (moduleId) => {
    if (moduleId === 'administrativo') {
      navigate(`/local/${localId}/administrativo/dashboard`, { state: moduleNavState })
      return
    }
    if (moduleId === 'pos') {
      navigate(`/local/${localId}/pos`, { state: moduleNavState })
      return
    }
    if (moduleId === 'inventario') {
      navigate(`/local/${localId}/inventario`, { state: moduleNavState })
      return
    }
    navigate(`/local/${localId}/administrativo/${moduleId}`, { state: moduleNavState })
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-extrabold text-[hsl(var(--primary))] tracking-tight">
            Módulos Disponibles
          </h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Selecciona un módulo para continuar
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {modules.map((mod, i) => (
            <div
              key={mod.id}
              className={cn(
                'animate-fade-in-up group relative overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200',
                mod.disabled
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:shadow-md hover:-translate-y-1 cursor-pointer',
                `stagger-${i + 1}`,
              )}
            >
              {mod.disabled && (
                <div className="absolute right-3 top-3 z-10">
                  <Badge variant="secondary">En desarrollo</Badge>
                </div>
              )}

              {/* Card header */}
              <div className="flex items-center gap-4 bg-[hsl(var(--primary))] px-5 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
                  <mod.Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white leading-tight">{mod.title}</h3>
                  <p className="text-xs text-white/75 mt-0.5 truncate">{mod.subtitle}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-white/60 shrink-0 transition-transform group-hover:translate-x-1" />
              </div>

              {/* Card body */}
              <div className="flex flex-col gap-5 p-5">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Funcionalidades
                  </p>
                  <ul className="space-y-1">
                    {mod.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[hsl(var(--foreground))]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  className="w-full"
                  onClick={() => !mod.disabled && handleModuleClick(mod.id)}
                  disabled={mod.disabled}
                >
                  {mod.disabled ? 'Próximamente' : 'Acceder al Módulo'}
                  {!mod.disabled && <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ModulesGrid
