import { useState } from 'react'
import { apiRequest, getAuthContext } from '../lib/apiClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function CreateLocalModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({ name: '', address: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (!formData.name.trim())    throw new Error('El nombre del local es requerido')
      if (!formData.address.trim()) throw new Error('La dirección es requerida')
      if (!formData.phone.trim())   throw new Error('El teléfono es requerido')

      const { token, businessId } = await getAuthContext()
      if (!businessId) throw new Error('No se encontró business_id en el token')

      await apiRequest('/locals', {
        method: 'POST',
        token,
        body: {
          business_id: businessId,
          name: formData.name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
        },
      })

      setFormData({ name: '', address: '', phone: '' })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Local</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre del Local *</Label>
            <Input id="name" name="name" type="text" placeholder="Ej: Local Centro" value={formData.name} onChange={handleChange} disabled={loading} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Dirección *</Label>
            <Input id="address" name="address" type="text" placeholder="Ej: Calle Principal 123, Ciudad" value={formData.address} onChange={handleChange} disabled={loading} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Teléfono *</Label>
            <Input id="phone" name="phone" type="tel" placeholder="Ej: +1234567890" value={formData.phone} onChange={handleChange} disabled={loading} required />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Creando...' : 'Crear Local'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CreateLocalModal
