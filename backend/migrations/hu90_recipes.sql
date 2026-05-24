-- HU-70..HU-83 - Módulo de recetas (base de datos)
-- Ejecutar en Supabase SQL Editor. Idempotente.

CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  local_id uuid NOT NULL REFERENCES public.locals (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  price_sale integer NOT NULL DEFAULT 0,
  yield_portions integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  current_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipes_name_nonempty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT recipes_price_sale_positive CHECK (price_sale > 0),
  CONSTRAINT recipes_yield_portions_positive CHECK (yield_portions >= 1)
);

CREATE INDEX IF NOT EXISTS idx_recipes_business_id ON public.recipes (business_id);
CREATE INDEX IF NOT EXISTS idx_recipes_local_id ON public.recipes (local_id);
CREATE INDEX IF NOT EXISTS idx_recipes_category_id ON public.recipes (category_id);
CREATE INDEX IF NOT EXISTS idx_recipes_name ON public.recipes (name);
CREATE INDEX IF NOT EXISTS idx_recipes_active ON public.recipes (is_active);

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity_required numeric(12,4) NOT NULL,
  unit text NOT NULL DEFAULT 'unidad',
  unit_cost_clp integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipe_ingredients_qty_positive CHECK (quantity_required > 0),
  CONSTRAINT recipe_ingredients_unit_cost_non_negative CHECK (unit_cost_clp >= 0),
  CONSTRAINT recipe_ingredients_unique_product_per_recipe UNIQUE (recipe_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON public.recipe_ingredients (recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_product_id ON public.recipe_ingredients (product_id);

CREATE TABLE IF NOT EXISTS public.recipe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes (id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipe_versions_version_positive CHECK (version_number >= 1),
  CONSTRAINT recipe_versions_unique_version UNIQUE (recipe_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe_id ON public.recipe_versions (recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_active ON public.recipe_versions (recipe_id, is_active);

CREATE TABLE IF NOT EXISTS public.recipe_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id uuid NOT NULL REFERENCES public.locals (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  recipe_id uuid NOT NULL REFERENCES public.recipes (id) ON DELETE RESTRICT,
  quantity_delta numeric(12,4) NOT NULL,
  source text NOT NULL DEFAULT 'recipe_sale',
  reference_id text,
  consumed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_consumptions_local_id ON public.recipe_consumptions (local_id);
CREATE INDEX IF NOT EXISTS idx_recipe_consumptions_product_id ON public.recipe_consumptions (product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_consumptions_recipe_id ON public.recipe_consumptions (recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_consumptions_created_at ON public.recipe_consumptions (created_at DESC);

COMMENT ON TABLE public.recipes IS 'Catálogo de recetas por local.';
COMMENT ON TABLE public.recipe_ingredients IS 'Ingredientes que componen una receta y su costo unitario de referencia.';
COMMENT ON TABLE public.recipe_versions IS 'Historial/versionado de recetas.';
COMMENT ON TABLE public.recipe_consumptions IS 'Movimientos de consumo de ingredientes por venta de receta.';
