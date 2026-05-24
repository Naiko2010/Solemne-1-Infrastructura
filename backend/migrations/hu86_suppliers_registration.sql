-- HU-86: Registro extendido de proveedores (RUT, contacto, dirección, etc.)
-- Ejecutar en Supabase SQL Editor. Idempotente.

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS rut text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.suppliers.rut IS 'RUT Chile normalizado (ej. 12.345.678-5)';
COMMENT ON COLUMN public.suppliers.category IS 'Categoría comercial del proveedor';

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_business_rut
  ON public.suppliers (business_id, rut)
  WHERE rut IS NOT NULL AND btrim(rut) <> '';
