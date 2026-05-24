import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL_VALUE = '__ALL__'

/**
 * Selector de categoría para inventario.
 * `options`: { id: string (UUID), name: string }[] — id se envía al API como query `category`.
 */
function CategoryFilterSelect({ value, onChange, options }) {
  return (
    <Select
      value={value || ALL_VALUE}
      onValueChange={(v) => onChange(v === ALL_VALUE ? '' : v)}
    >
      <SelectTrigger className="h-9 text-sm min-w-[180px]" aria-label="Filtrar por categoría">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>Todas las categorías</SelectItem>
        {options.map(({ id, name }) => (
          <SelectItem key={id} value={id}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default CategoryFilterSelect
