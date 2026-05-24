import { useCallback, useEffect, useState } from 'react'
import { getSupplierDetailForBusiness, patchSupplier } from '../../lib/providersApi'
import { formatCLPDisplay as formatMoneyClp } from '../../lib/formatCLP'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

function displayStr(value) {
  const s = value != null ? String(value).trim() : ''
  return s || '—'
}

/**
 * Modal de detalle de proveedor (HU-69): datos de contacto, KPIs y productos en inventario.
 */
function SupplierDetailModal({ open, supplierId, businessId, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [commercialSaving, setCommercialSaving] = useState(false)
  const [commercialError, setCommercialError] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [leadTime, setLeadTime] = useState('')
  const [commercialNotes, setCommercialNotes] = useState('')

  const load = useCallback(async () => {
    if (!supplierId || !businessId) return
    setError('')
    setLoading(true)
    setDetail(null)
    try {
      const data = await getSupplierDetailForBusiness(supplierId, businessId)
      setDetail(data && typeof data === 'object' ? data : null)
      if (data && typeof data === 'object') {
        setPaymentTerms(data.payment_terms_days != null ? String(data.payment_terms_days) : '')
        setLeadTime(data.delivery_lead_time_days != null ? String(data.delivery_lead_time_days) : '')
        setCommercialNotes(data.commercial_notes != null ? String(data.commercial_notes) : '')
      }
    } catch (e) {
      setDetail(null)
      setError(e?.message || 'No se pudo cargar el detalle del proveedor.')
    } finally {
      setLoading(false)
    }
  }, [supplierId, businessId])

  useEffect(() => {
    if (!open || !supplierId || !businessId) {
      setDetail(null)
      setError('')
      setLoading(false)
      return
    }
    load()
  }, [open, supplierId, businessId, load])

  if (!open || !supplierId || !businessId) return null

  const products = Array.isArray(detail?.purchased_products) ? detail.purchased_products : []

  const saveCommercial = async (ev) => {
    ev.preventDefault()
    setCommercialError('')
    setCommercialSaving(true)
    try {
      const body = {}
      if (paymentTerms.trim() !== '') {
        const n = parseInt(paymentTerms, 10)
        if (!Number.isFinite(n) || n < 0) throw new Error('Plazo de pago inválido.')
        body.payment_terms_days = n
      } else {
        body.payment_terms_days = null
      }
      if (leadTime.trim() !== '') {
        const n = parseInt(leadTime, 10)
        if (!Number.isFinite(n) || n < 0) throw new Error('Plazo de entrega inválido.')
        body.delivery_lead_time_days = n
      } else {
        body.delivery_lead_time_days = null
      }
      body.commercial_notes = commercialNotes.trim() || null
      const updated = await patchSupplier(supplierId, businessId, body)
      setDetail((prev) => (prev && typeof prev === 'object' ? { ...prev, ...updated } : updated))
    } catch (e) {
      setCommercialError(e?.message || 'No se pudieron guardar las condiciones.')
    } finally {
      setCommercialSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-2xl w-full flex flex-col overflow-hidden p-0"
        style={{ maxHeight: 'min(92vh, 820px)' }}
      >
        {/* Fixed header */}
        <DialogHeader className="shrink-0 px-7 pt-6 pb-4 border-b border-[hsl(var(--border))]">
          <DialogTitle>Detalle del proveedor</DialogTitle>
        </DialogHeader>

        {/* Scrollable body — no visible scrollbar */}
        <div className="flex-1 overflow-y-auto min-h-0 no-scrollbar px-7 py-5">
          <div className="flex flex-col gap-6">
            {loading ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]" role="status">Cargando…</p>
            ) : null}

            {error ? (
              <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</p>
            ) : null}

            {!loading && !error && detail ? (
              <>
                {/* Name + badge */}
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">{displayStr(detail.name)}</h3>
                  <Badge variant={detail.is_active === false ? 'destructive' : 'success'}>
                    {detail.is_active === false ? 'Inactivo' : 'Activo'}
                  </Badge>
                </div>

                {/* Contact grid */}
                <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  {[
                    ['RUT', detail.rut],
                    ['Teléfono', detail.phone],
                    ['Email', detail.email],
                    ['Dirección', detail.address],
                    ['Contacto', detail.contact_name],
                    ['Categoría', detail.category],
                  ].map(([label, val]) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <dt className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{label}</dt>
                      <dd className="text-[hsl(var(--foreground))] font-medium">{displayStr(val)}</dd>
                    </div>
                  ))}
                </dl>

                {/* Commercial conditions */}
                <form onSubmit={saveCommercial} className="flex flex-col gap-4 border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--accent)/0.4)]">
                  <h4 className="font-semibold text-[hsl(var(--foreground))]">Condiciones comerciales</h4>
                  {commercialError ? (
                    <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{commercialError}</p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="sd-payment-terms">Plazo de pago (días)</Label>
                      <Input id="sd-payment-terms" type="number" min="0" value={paymentTerms}
                        onChange={(ev) => setPaymentTerms(ev.target.value)} placeholder="Ej. 30" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="sd-lead-time">Plazo de entrega típico (días)</Label>
                      <Input id="sd-lead-time" type="number" min="0" value={leadTime}
                        onChange={(ev) => setLeadTime(ev.target.value)} placeholder="Ej. 3" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="sd-notes">Observaciones</Label>
                    <textarea id="sd-notes" value={commercialNotes}
                      onChange={(ev) => setCommercialNotes(ev.target.value)}
                      placeholder="Condiciones u notas" rows={3}
                      className="w-full rounded-md border border-[hsl(var(--border))] bg-white px-3 py-2 text-sm shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                    />
                  </div>
                  <Button type="submit" disabled={commercialSaving} className="self-start">
                    {commercialSaving ? 'Guardando…' : 'Guardar condiciones'}
                  </Button>
                </form>

                {/* KPI cards */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Total productos (unidades)', detail.purchased_products_count ?? 0, false],
                    ['Total compras (CLP)', formatMoneyClp(detail.supplier_purchases_total_clp), true],
                  ].map(([label, val, isMoney]) => (
                    <div key={label} className="flex flex-col gap-1 rounded-xl border border-[hsl(var(--border))] bg-white px-5 py-4">
                      <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{label}</span>
                      <span className={`text-2xl font-bold ${isMoney ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--foreground))]'}`}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Products table */}
                <div>
                  <h4 className="font-semibold text-[hsl(var(--foreground))] mb-3">Productos en inventario</h4>
                  {products.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] bg-[hsl(var(--accent)/0.4)] rounded-lg px-4 py-3">
                      No hay productos asociados a este proveedor.
                    </p>
                  ) : (
                    <div className="rounded-xl border border-[hsl(var(--border))] overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">Costo unit. (CLP)</TableHead>
                            <TableHead className="text-right">Subtotal (CLP)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((p) => (
                            <TableRow key={String(p.product_id)}>
                              <TableCell className="font-medium">{displayStr(p.name)}</TableCell>
                              <TableCell className="text-right">{p.quantity ?? 0}</TableCell>
                              <TableCell className="text-right">{formatMoneyClp(p.unit_price_clp)}</TableCell>
                              <TableCell className="text-right">{formatMoneyClp(p.line_total_clp)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}

export default SupplierDetailModal
