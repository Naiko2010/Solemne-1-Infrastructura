-- Órdenes de compra semanales a proveedores (HU-34 / compras semanales).
-- Ejecutar en Supabase SQL Editor. Revisar si ya existen tablas homónimas.

CREATE TABLE IF NOT EXISTS public.weekly_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  local_id uuid REFERENCES public.locals (id) ON DELETE SET NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  week_start_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_estimated_clp integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wpo_status_check CHECK (
    status IN (
      'draft',
      'sent',
      'in_transit',
      'partially_received',
      'received',
      'cancelled'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_wpo_business ON public.weekly_purchase_orders (business_id);
CREATE INDEX IF NOT EXISTS idx_wpo_week ON public.weekly_purchase_orders (week_start_date);
CREATE INDEX IF NOT EXISTS idx_wpo_supplier ON public.weekly_purchase_orders (supplier_id);

CREATE TABLE IF NOT EXISTS public.weekly_purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.weekly_purchase_orders (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity_ordered numeric NOT NULL,
  unit_price_clp integer NOT NULL DEFAULT 0,
  line_notes text,
  quantity_received numeric NOT NULL DEFAULT 0,
  product_name_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wpoi_qty_ordered_pos CHECK (quantity_ordered > 0),
  CONSTRAINT wpoi_qty_received_nonneg CHECK (quantity_received >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wpoi_order ON public.weekly_purchase_order_items (order_id);

COMMENT ON TABLE public.weekly_purchase_orders IS 'Órdenes de compra planificadas por semana (lunes) y proveedor.';
COMMENT ON TABLE public.weekly_purchase_order_items IS 'Líneas de producto de una orden de compra semanal.';

-- RLS (mismo criterio que suppliers / locals)
ALTER TABLE public.weekly_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wpo_select_same_business" ON public.weekly_purchase_orders;
CREATE POLICY "wpo_select_same_business"
  ON public.weekly_purchase_orders
  FOR SELECT
  TO authenticated
  USING (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  );

DROP POLICY IF EXISTS "wpo_insert_same_business" ON public.weekly_purchase_orders;
CREATE POLICY "wpo_insert_same_business"
  ON public.weekly_purchase_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  );

DROP POLICY IF EXISTS "wpo_update_same_business" ON public.weekly_purchase_orders;
CREATE POLICY "wpo_update_same_business"
  ON public.weekly_purchase_orders
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

DROP POLICY IF EXISTS "wpo_delete_same_business" ON public.weekly_purchase_orders;
CREATE POLICY "wpo_delete_same_business"
  ON public.weekly_purchase_orders
  FOR DELETE
  TO authenticated
  USING (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  );

DROP POLICY IF EXISTS "wpoi_select_via_order" ON public.weekly_purchase_order_items;
CREATE POLICY "wpoi_select_via_order"
  ON public.weekly_purchase_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.weekly_purchase_orders w
      WHERE w.id = weekly_purchase_order_items.order_id
        AND w.business_id IS NOT NULL
        AND (
          w.business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
          OR w.business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
        )
    )
  );

DROP POLICY IF EXISTS "wpoi_insert_via_order" ON public.weekly_purchase_order_items;
CREATE POLICY "wpoi_insert_via_order"
  ON public.weekly_purchase_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.weekly_purchase_orders w
      WHERE w.id = weekly_purchase_order_items.order_id
        AND w.business_id IS NOT NULL
        AND (
          w.business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
          OR w.business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
        )
    )
  );

DROP POLICY IF EXISTS "wpoi_update_via_order" ON public.weekly_purchase_order_items;
CREATE POLICY "wpoi_update_via_order"
  ON public.weekly_purchase_order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.weekly_purchase_orders w
      WHERE w.id = weekly_purchase_order_items.order_id
        AND w.business_id IS NOT NULL
        AND (
          w.business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
          OR w.business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.weekly_purchase_orders w
      WHERE w.id = weekly_purchase_order_items.order_id
        AND w.business_id IS NOT NULL
        AND (
          w.business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
          OR w.business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
        )
    )
  );

DROP POLICY IF EXISTS "wpoi_delete_via_order" ON public.weekly_purchase_order_items;
CREATE POLICY "wpoi_delete_via_order"
  ON public.weekly_purchase_order_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.weekly_purchase_orders w
      WHERE w.id = weekly_purchase_order_items.order_id
        AND w.business_id IS NOT NULL
        AND (
          w.business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
          OR w.business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
        )
    )
  );
