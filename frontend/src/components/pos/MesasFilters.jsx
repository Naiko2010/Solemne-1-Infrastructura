import { useState, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/**
 * Aplica filtros a las mesas
 */
function applyFilters(mesas, filters) {
  return mesas.filter((mesa) => {
    if (filters.nombre.trim()) {
      const nombre = `${mesa.name || ''}`.toLowerCase()
      const numero = `${mesa.numero || ''}`.toLowerCase()
      const searchTerm = filters.nombre.toLowerCase()
      if (!nombre.includes(searchTerm) && !numero.includes(searchTerm)) {
        return false
      }
    }

    if (filters.estado) {
      const mesaState = !mesa.is_active ? 'inactiva' : (mesa.state || 'libre')
      if (mesaState !== filters.estado) {
        return false
      }
    }

    if (filters.zona) {
      if (mesa.zona !== filters.zona) {
        return false
      }
    }

    return true
  })
}

export default function MesasFilters({ mesas = [], onFilteredMesasChange = null }) {
  const [filters, setFilters] = useState({
    nombre: '',
    estado: '',
    zona: '',
  })

  const estadoOptions = useMemo(() => ['libre', 'ocupada', 'en_cobro'], [])

  const zonaOptions = useMemo(() => {
    const zonas = new Set(mesas.map((m) => m.zona).filter(Boolean))
    return Array.from(zonas).sort()
  }, [mesas])

  const filteredMesas = useMemo(() => applyFilters(mesas, filters), [mesas, filters])

  const handleFiltersChange = useCallback(
    (newFilters) => {
      setFilters(newFilters)
      const filtered = applyFilters(mesas, newFilters)
      if (onFilteredMesasChange) {
        onFilteredMesasChange(filtered, newFilters)
      }
    },
    [mesas, onFilteredMesasChange]
  )

  const handleNombreChange = (e) => handleFiltersChange({ ...filters, nombre: e.target.value })
  const handleEstadoChange = (e) => handleFiltersChange({ ...filters, estado: e.target.value })
  const handleZonaChange = (e) => handleFiltersChange({ ...filters, zona: e.target.value })
  const handleLimpiarFiltros = () => handleFiltersChange({ nombre: '', estado: '', zona: '' })

  const tieneFilterosActivos = filters.nombre.trim() !== '' || filters.estado !== '' || filters.zona !== ''

  return (
    <div className="bg-white border border-[hsl(var(--border))] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Filtros de Mesas</h3>
        {tieneFilterosActivos && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
            onClick={handleLimpiarFiltros}
            title="Limpiar todos los filtros"
          >
            ✕ Limpiar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Filtro por nombre/número */}
        <div className="space-y-1">
          <Label htmlFor="filter-nombre" className="text-xs">
            Nombre/Número
            {filters.nombre && <Badge className="ml-1 text-[10px] py-0 bg-[hsl(var(--primary))]">{filters.nombre}</Badge>}
          </Label>
          <Input
            id="filter-nombre"
            type="text"
            placeholder="Ej: mesa 1, A3..."
            value={filters.nombre}
            onChange={handleNombreChange}
            className="h-8 text-xs"
          />
        </div>

        {/* Filtro por estado */}
        <div className="space-y-1">
          <Label htmlFor="filter-estado" className="text-xs">
            Estado
            {filters.estado && <Badge className="ml-1 text-[10px] py-0 bg-[hsl(var(--primary))]">{filters.estado}</Badge>}
          </Label>
          <select
            id="filter-estado"
            value={filters.estado}
            onChange={handleEstadoChange}
            className="w-full h-8 text-xs rounded-md border border-[hsl(var(--border))] bg-white px-2 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30"
          >
            <option value="">Todos</option>
            {estadoOptions.map((estado) => (
              <option key={estado} value={estado}>
                {estado === 'libre' && '✓ Disponible'}
                {estado === 'ocupada' && '⊙ Ocupada'}
                {estado === 'en_cobro' && '💳 En Cobro'}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por zona */}
        <div className="space-y-1">
          <Label htmlFor="filter-zona" className="text-xs">
            Zona
            {filters.zona && <Badge className="ml-1 text-[10px] py-0 bg-[hsl(var(--primary))]">{filters.zona}</Badge>}
          </Label>
          <select
            id="filter-zona"
            value={filters.zona}
            onChange={handleZonaChange}
            className="w-full h-8 text-xs rounded-md border border-[hsl(var(--border))] bg-white px-2 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30"
          >
            <option value="">Todas</option>
            {zonaOptions.map((zona) => (
              <option key={zona} value={zona}>{zona}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Resultado */}
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Mostrando <strong>{filteredMesas.length}</strong> de <strong>{mesas.length}</strong> mesas
        {tieneFilterosActivos && ' (filtrado)'}
      </p>
    </div>
  )
}
