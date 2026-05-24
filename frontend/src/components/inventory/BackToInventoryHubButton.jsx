import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

/**
 * Vuelta al hub de inventario con el mismo estilo en Recetas, Stock, Proveedores y Compras semanales.
 * @param {{ local?: unknown } | null | undefined} [navState] — p. ej. `{ local: selectedLocal }` para conservar contexto del local.
 */
function BackToInventoryHubButton({ navState } = {}) {
  const navigate = useNavigate()
  const { localId } = useParams()

  const handleClick = () => {
    const opts =
      navState != null && typeof navState === 'object' && Object.keys(navState).length > 0
        ? { state: navState }
        : undefined
    navigate(`/local/${localId}/inventario`, opts)
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 pl-2 pr-4 py-2 rounded-full border border-[hsl(var(--primary)/0.35)] bg-gradient-to-b from-white to-green-50 shadow-sm text-sm font-bold text-[hsl(var(--primary))] cursor-pointer transition-all duration-100 hover:border-[hsl(var(--primary)/0.55)] hover:shadow-md hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[hsl(var(--primary)/0.12)] text-emerald-700" aria-hidden="true">
          <ChevronLeft size={18} />
        </span>
        <span>Centro de inventario</span>
      </button>
    </div>
  )
}

export default BackToInventoryHubButton
