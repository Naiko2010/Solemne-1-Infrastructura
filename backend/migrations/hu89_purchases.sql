-- HU-89: Registro de compras a proveedores.
-- Ejecutar en Supabase SQL Editor. Idempotente.

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  local_id uuid NOT NULL REFERENCES public.locals (id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  unit_cost_clp integer NOT NULL DEFAULT 0,
  total_clp integer NOT NULL DEFAULT 0,
  purchase_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchases_quantity_gt_zero CHECK (quantity > 0),
  CONSTRAINT purchases_unit_cost_non_negative CHECK (unit_cost_clp >= 0),
  CONSTRAINT purchases_total_non_negative CHECK (total_clp >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchases_business_id ON public.purchases (business_id);
CREATE INDEX IF NOT EXISTS idx_purchases_local_id ON public.purchases (local_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON public.purchases (product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON public.purchases (purchase_date);

COMMENT ON TABLE public.purchases IS 'Compras registradas a proveedores por local.';

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchases_select_same_business" ON public.purchases;
CREATE POLICY "purchases_select_same_business"
  ON public.purchases
  FOR SELECT
  TO authenticated
  USING (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  );

DROP POLICY IF EXISTS "purchases_insert_same_business" ON public.purchases;
CREATE POLICY "purchases_insert_same_business"
  ON public.purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  );

DROP POLICY IF EXISTS "purchases_update_same_business" ON public.purchases;
CREATE POLICY "purchases_update_same_business"
  ON public.purchases
  FOR UPDATE
  TO authenticated
  USING (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  )
  WITH CHECK (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  );
