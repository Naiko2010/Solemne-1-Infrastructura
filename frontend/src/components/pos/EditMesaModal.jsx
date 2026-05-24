import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Modal para editar una mesa existente
 * Permite cambiar: nombre, capacidad, zona, estado activo/inactivo
 */
export default function EditMesaModal({ mesa, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: mesa.name || '',
    capacidad: mesa.capacidad || 4,
    zona: mesa.zona || '',
    is_active: mesa.is_active !== false,
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = () => {
    const next = {}

    if (!form.name.trim()) {
      next.name = 'El nombre es obligatorio'
    }

    if (form.capacidad < 1 || form.capacidad > 100) {
      next.capacidad = 'La capacidad debe estar entre 1 y 100'
    }

    if (!form.zona.trim()) {
      next.zona = 'La zona es obligatoria'
    }

    return Object.keys(next).length === 0 ? {} : next
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validate()

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        id: mesa.id,
        name: form.name.trim(),
        capacidad: form.capacidad,
        zona: form.zona.trim(),
        is_active: form.is_active,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Mesa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-mesa-name">
              Nombre <span className="text-[hsl(var(--destructive))]">*</span>
            </Label>
            <Input
              id="edit-mesa-name"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ej: mesa 1, mesa A, etc."
              className={errors.name ? 'border-[hsl(var(--destructive))]' : ''}
            />
            {errors.name && <p className="text-xs text-[hsl(var(--destructive))]">{errors.name}</p>}
          </div>

          {/* Capacidad */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-mesa-capacidad">
              Capacidad (personas) <span className="text-[hsl(var(--destructive))]">*</span>
            </Label>
            <Input
              id="edit-mesa-capacidad"
              type="number"
              name="capacidad"
              value={form.capacidad}
              onChange={handleChange}
              min="1"
              max="100"
              className={errors.capacidad ? 'border-[hsl(var(--destructive))]' : ''}
            />
            {errors.capacidad && <p className="text-xs text-[hsl(var(--destructive))]">{errors.capacidad}</p>}
          </div>

          {/* Zona */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-mesa-zona">
              Zona <span className="text-[hsl(var(--destructive))]">*</span>
            </Label>
            <Input
              id="edit-mesa-zona"
              type="text"
              name="zona"
              value={form.zona}
              onChange={handleChange}
              placeholder="Ej: Salón, Patio, Terraza"
              className={errors.zona ? 'border-[hsl(var(--destructive))]' : ''}
            />
            {errors.zona && <p className="text-xs text-[hsl(var(--destructive))]">{errors.zona}</p>}
          </div>

          {/* Estado activo/inactivo */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-mesa-active" className="flex items-center gap-2 cursor-pointer">
              <input
                id="edit-mesa-active"
                type="checkbox"
                name="is_active"
                checked={form.is_active}
                onChange={handleChange}
                className="w-4 h-4 rounded accent-[hsl(var(--primary))]"
              />
              <span>Mesa activa</span>
            </Label>
            <p className="text-xs text-[hsl(var(--muted-foreground))] pl-6">
              {form.is_active
                ? 'La mesa está disponible para usar'
                : 'La mesa está inactiva y no aparecerá en el listado'}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
