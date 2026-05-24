-- Fecha de inicio de la relación comercial del proveedor con la empresa.
-- Ejecutar en Supabase SQL Editor. Idempotente.

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS start_date date;

COMMENT ON COLUMN public.suppliers.start_date IS 'Fecha desde la cual el proveedor trabaja con la empresa';
