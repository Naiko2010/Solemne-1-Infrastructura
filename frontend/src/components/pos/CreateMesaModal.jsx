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

const INITIAL_FORM = { name: '', capacidad: '', zona: '' }

export default function CreateMesaModal({ mesas, onClose, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const validate = () => {
    const next = {}

    if (!form.name.trim()) {
      next.name = 'El número de mesa es obligatorio'
    } else if (mesas.some((m) => m.name.trim().toLowerCase() === form.name.trim().toLowerCase())) {
      next.name = `Ya existe una mesa con el nombre "${form.name}"`
    }

    if (!form.capacidad) {
      next.capacidad = 'La capacidad es obligatoria'
    } else if (Number(form.capacidad) <= 0 || !Number.isInteger(Number(form.capacidad))) {
      next.capacidad = 'Ingresa un número entero mayor a 0'
    }

    if (!form.zona.trim()) {
      next.zona = 'La zona es obligatoria'
    }

    return next
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
    setServerError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    setServerError('')
    try {
      await onSubmit({ name: form.name.trim(), capacidad: form.capacidad, zona: form.zona.trim() })
      onClose()
    } catch (err) {
      setServerError(err.message || 'Error al crear la mesa')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear Mesa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-1">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="mesa-name">
              Número / Nombre de Mesa <span className="text-[hsl(var(--destructive))]">*</span>
            </Label>
            <Input
              id="mesa-name"
              name="name"
              type="text"
              placeholder="Ej: Mesa 1, VIP-A, Terraza 3"
              value={form.name}
              onChange={handleChange}
              disabled={submitting}
              className={errors.name ? 'border-[hsl(var(--destructive))]' : ''}
            />
            {errors.name && <p className="text-xs text-[hsl(var(--destructive))]">{errors.name}</p>}
          </div>

          {/* Capacidad */}
          <div className="space-y-1.5">
            <Label htmlFor="mesa-capacidad">
              Capacidad (personas) <span className="text-[hsl(var(--destructive))]">*</span>
            </Label>
            <Input
              id="mesa-capacidad"
              name="capacidad"
              type="number"
              min="1"
              placeholder="Ej: 4"
              value={form.capacidad}
              onChange={handleChange}
              disabled={submitting}
              className={errors.capacidad ? 'border-[hsl(var(--destructive))]' : ''}
            />
            {errors.capacidad && <p className="text-xs text-[hsl(var(--destructive))]">{errors.capacidad}</p>}
          </div>

          {/* Zona */}
          <div className="space-y-1.5">
            <Label htmlFor="mesa-zona">
              Zona <span className="text-[hsl(var(--destructive))]">*</span>
            </Label>
            <Input
              id="mesa-zona"
              name="zona"
              type="text"
              placeholder="Ej: Salón, Terraza, Bar, VIP"
              value={form.zona}
              onChange={handleChange}
              disabled={submitting}
              className={errors.zona ? 'border-[hsl(var(--destructive))]' : ''}
            />
            {errors.zona && <p className="text-xs text-[hsl(var(--destructive))]">{errors.zona}</p>}
          </div>

          {serverError && (
            <p className="text-xs text-[hsl(var(--destructive))] bg-red-50 border border-red-200 rounded px-3 py-2">
              {serverError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
            >
              {submitting ? 'Creando...' : 'Crear Mesa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
