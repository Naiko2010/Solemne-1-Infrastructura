-- Alinear esquema con el backend (reporte comparativo y listados).
-- Si la tabla se creó sin esta columna, el SELECT falla con 42703.
ALTER TABLE public.weekly_purchase_orders
  ADD COLUMN IF NOT EXISTS total_estimated_clp integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.weekly_purchase_orders.total_estimated_clp IS 'Total estimado de la orden en CLP (suma de líneas).';
