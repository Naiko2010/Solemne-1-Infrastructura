-- Catálogo de proveedores por negocio y FK product.supplier_id.
-- Ejecutar en Supabase SQL Editor (o psql). Revisar si ya existen objetos homónimos.

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_name_nonempty CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON public.suppliers (business_id);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products (supplier_id);

COMMENT ON TABLE public.suppliers IS 'Proveedores del negocio (business_id).';

-- RLS (API con JWT usuario autenticado vía PostgREST; mismo criterio que locals)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select_authenticated_same_business" ON public.suppliers;
CREATE POLICY "suppliers_select_authenticated_same_business"
  ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  );

DROP POLICY IF EXISTS "suppliers_insert_authenticated_same_business" ON public.suppliers;
CREATE POLICY "suppliers_insert_authenticated_same_business"
  ON public.suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  );

DROP POLICY IF EXISTS "suppliers_update_authenticated_same_business" ON public.suppliers;
CREATE POLICY "suppliers_update_authenticated_same_business"
  ON public.suppliers
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
