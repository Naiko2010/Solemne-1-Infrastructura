-- Agrega total_estimated_clp a weekly_purchase_orders si la tabla fue creada sin él.
-- Seguro ejecutar varias veces (IF NOT EXISTS).

ALTER TABLE public.weekly_purchase_orders
  ADD COLUMN IF NOT EXISTS total_estimated_clp integer NOT NULL DEFAULT 0;
