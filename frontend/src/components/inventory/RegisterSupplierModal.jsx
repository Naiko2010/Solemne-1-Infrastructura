import { useEffect, useState } from 'react'
import { getAuthContext } from '../../lib/apiClient'
import { postSupplier } from '../../lib/providersApi'
import ModernDateField from './ModernDateField'
import {
  formatRutForDisplay,
  normalizeRutInput,
  validateChileRutMessage,
} from '../../utils/chileRut'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const INITIAL = {
  name: '', rut: '', address: '', category: '',
  contact_name: '', phone: '', email: '', start_date: '',
}

const CL_PHONE_PREFIX = '+56 9'
const CL_PHONE_DIGITS = 8

function normalizeChileMobileDigits(value) {
  const rawDigits = String(value ?? '').replace(/\D/g, '')
  let digits = rawDigits
  if (digits.startsWith('56')) digits = digits.slice(2)
  if (digits.startsWith('9'))  digits = digits.slice(1)
  return digits.slice(0, CL_PHONE_DIGITS)
}

function RegisterSupplierModal({ open, onClose, onSuccess, businessId }) {
  const [form,        setFormState] = useState(INITIAL)
  const [submitting,  setSubmitting] = useState(false)
  const [error,       setError]      = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    if (!open) return
    setFormState(INITIAL)
    setError('')
    setFieldErrors({})
    setSubmitting(false)
  }, [open])

  const setField = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const validate = () => {
    const next = {}
    const req = [
      ['name',         'Nombre comercial'],
      ['rut',          'RUT'],
      ['address',      'Dirección'],
      ['category',     'Categoría'],
      ['contact_name', 'Contacto'],
      ['phone',        'Teléfono'],
      ['email',        'Email'],
    ]
    for (const [key, label] of req) {
      if (!String(form[key] ?? '').trim()) next[key] = `${label} es obligatorio.`
    }
    if (!next.rut) {
      const rutErr = validateChileRutMessage(form.rut)
      if (rutErr) next.rut = rutErr
    }
    if (!next.phone) {
      const digits = normalizeChileMobileDigits(form.phone)
      if (digits.length !== CL_PHONE_DIGITS) next.phone = 'Ingresa 8 dígitos después de +56 9.'
    }
    if (!next.email && String(form.email).trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email).trim())) {
        next.email = 'Ingresa un email válido.'
      }
    }
    setFieldErrors(next)
    if (Object.keys(next).length > 0) {
      setError(`Corrige los campos requeridos: ${Object.values(next).join(' • ')}`)
    }
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setSubmitting(true)
    try {
      const { businessId: bidFromUser } = await getAuthContext()
      const bid = businessId || bidFromUser
      const body = {
        name:         form.name.trim(),
        rut:          normalizeRutInput(form.rut.trim()),
        address:      form.address.trim(),
        category:     form.category.trim(),
        contact_name: form.contact_name.trim(),
        phone:        `${CL_PHONE_PREFIX}${normalizeChileMobileDigits(form.phone)}`,
        email:        form.email.trim(),
      }
      if (form.start_date) body.start_date = form.start_date
      if (bid)             body.business_id = bid

      try {
        await postSupplier(body)
      } catch (apiErr) {
        if (body.start_date) {
          const fallback = { ...body }
          delete fallback.start_date
          await postSupplier(fallback)
        } else {
          throw apiErr
        }
      }
      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(err?.message || 'No se pudo registrar el proveedor.')
    } finally {
      setSubmitting(false)
    }
  }

  const fe = (key) => fieldErrors[key]
  const inputCls = (key) =>
    `h-10 w-full rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] ${
      fe(key) ? 'border-red-400' : 'border-[hsl(var(--border))]'
    }`

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose?.() }}>
      <DialogContent
        className="max-w-2xl w-full flex flex-col overflow-hidden p-0"
        style={{ maxHeight: 'min(92vh, 780px)' }}
        onInteractOutside={(e) => {
          const original = e.detail?.originalEvent ?? e
          const target = original?.target
          if (target instanceof Element && target.closest('[data-calendar-panel="true"]')) {
            e.preventDefault()
          }
        }}
      >
        {/* Fixed header */}
        <DialogHeader className="shrink-0">
          <DialogTitle>Registrar proveedor</DialogTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Complete los datos del nuevo proveedor
          </p>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <form id="rs-form" onSubmit={handleSubmit} className="flex flex-col gap-5 px-7 py-6">

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 leading-snug" role="alert">
                {error}
              </p>
            )}

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs-name">Nombre comercial <span className="text-red-500">*</span></Label>
              <input
                id="rs-name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Ej: Distribuidora XYZ"
                autoComplete="organization"
                className={inputCls('name')}
              />
              {fe('name') && <span className="text-xs text-red-500">{fe('name')}</span>}
            </div>

            {/* RUT + Category row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rs-rut">RUT <span className="text-red-500">*</span></Label>
                <input
                  id="rs-rut"
                  value={formatRutForDisplay(form.rut)}
                  onChange={(e) => setField('rut', normalizeRutInput(e.target.value))}
                  placeholder="12.345.678-9"
                  autoComplete="off"
                  inputMode="text"
                  className={inputCls('rut')}
                />
                {fe('rut') && <span className="text-xs text-red-500">{fe('rut')}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rs-category">Categoría <span className="text-red-500">*</span></Label>
                <input
                  id="rs-category"
                  value={form.category}
                  onChange={(e) => setField('category', e.target.value)}
                  placeholder="Ej: Lácteos"
                  className={inputCls('category')}
                />
                {fe('category') && <span className="text-xs text-red-500">{fe('category')}</span>}
              </div>
            </div>

            {/* Address */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs-address">Dirección <span className="text-red-500">*</span></Label>
              <input
                id="rs-address"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                placeholder="Ej: Av. Providencia 1234, Santiago"
                autoComplete="street-address"
                className={inputCls('address')}
              />
              {fe('address') && <span className="text-xs text-red-500">{fe('address')}</span>}
            </div>

            {/* Contact + Phone row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rs-contact">Contacto <span className="text-red-500">*</span></Label>
                <input
                  id="rs-contact"
                  value={form.contact_name}
                  onChange={(e) => setField('contact_name', e.target.value)}
                  placeholder="Nombre completo"
                  autoComplete="name"
                  className={inputCls('contact_name')}
                />
                {fe('contact_name') && <span className="text-xs text-red-500">{fe('contact_name')}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rs-phone">Teléfono <span className="text-red-500">*</span></Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] shrink-0 bg-[hsl(var(--muted))] px-2 rounded-md border border-[hsl(var(--border))] h-10 flex items-center">
                    {CL_PHONE_PREFIX}
                  </span>
                  <input
                    id="rs-phone"
                    type="tel"
                    value={normalizeChileMobileDigits(form.phone)}
                    onChange={(e) => setField('phone', normalizeChileMobileDigits(e.target.value))}
                    placeholder="12345678"
                    inputMode="numeric"
                    maxLength={CL_PHONE_DIGITS}
                    className={`${inputCls('phone')} flex-1 min-w-0`}
                  />
                </div>
                {fe('phone') && <span className="text-xs text-red-500">{fe('phone')}</span>}
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs-email">Email <span className="text-red-500">*</span></Label>
              <input
                id="rs-email"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="contacto@proveedor.cl"
                autoComplete="email"
                className={inputCls('email')}
              />
              {fe('email') && <span className="text-xs text-red-500">{fe('email')}</span>}
            </div>

            {/* Start date */}
            <ModernDateField
              label="Fecha desde (histórico proveedor)"
              value={form.start_date}
              onChange={(iso) => setField('start_date', iso)}
              disabled={submitting}
            />

          </form>
        </div>

        {/* Fixed footer */}
        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="rs-form" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default RegisterSupplierModal
