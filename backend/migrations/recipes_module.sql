-- ============================================================
-- MÓDULO DE RECETAS - TABLAS BASE
-- Supabase / PostgreSQL
-- ============================================================

-- Tabla: recipe_categories
CREATE TABLE IF NOT EXISTS recipe_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: recipes (recetas)
-- Almacena definiciones de recetas sin costos fijos (se calculan dinámicamente)
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id UUID NOT NULL REFERENCES locals(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES recipe_categories(id) ON DELETE SET NULL,
  
  -- Configuración de venta
  price_sale DECIMAL(10, 2) NOT NULL CHECK (price_sale > 0),
  portions_yield INT NOT NULL DEFAULT 1 CHECK (portions_yield > 0),
  prep_time_minutes INT DEFAULT 0,
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Índices
  CONSTRAINT unique_recipe_per_local UNIQUE (local_id, name)
);

-- Tabla: recipe_ingredients (JUNCTION)
-- Mapea: recipe -> product (ingrediente) + cantidad requerida
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  
  -- Cantidad y unidad
  quantity_required DECIMAL(10, 3) NOT NULL CHECK (quantity_required > 0),
  unit VARCHAR(50) NOT NULL, -- "g", "ml", "unidad", "kg", etc.
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Índices
  CONSTRAINT unique_ingredient_per_recipe UNIQUE (recipe_id, product_id)
);

-- Tabla: recipe_consumption_history (para auditoría)
-- Se registra cada consumo de ingredientes al vender una receta
CREATE TABLE IF NOT EXISTS recipe_consumption_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  quantity_sold INT NOT NULL CHECK (quantity_sold > 0),
  
  -- Costos al momento del consumo (snapshot)
  total_cost_at_sale DECIMAL(10, 2) NOT NULL,
  price_at_sale DECIMAL(10, 2) NOT NULL,
  margin_at_sale DECIMAL(5, 2) NOT NULL, -- porcentaje
  
  consumed_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================

CREATE INDEX idx_recipes_local_id ON recipes(local_id);
CREATE INDEX idx_recipes_category_id ON recipes(category_id);
CREATE INDEX idx_recipes_is_active ON recipes(is_active);
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_product_id ON recipe_ingredients(product_id);
CREATE INDEX idx_recipe_consumption_recipe_id ON recipe_consumption_history(recipe_id);
CREATE INDEX idx_recipe_consumption_order_id ON recipe_consumption_history(order_id);
CREATE INDEX idx_recipe_consumption_date ON recipe_consumption_history(consumed_at);

-- ============================================================
-- RLS POLICIES (Multi-tenant)
-- ============================================================

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_consumption_history ENABLE ROW LEVEL SECURITY;

-- Política: Users solo ven recetas de su local
CREATE POLICY recipes_select_by_local ON recipes
  FOR SELECT
  USING (
    local_id IN (
      SELECT id FROM locals WHERE business_id = current_setting('app.current_business_id')::UUID
    )
  );

CREATE POLICY recipes_insert_own_business ON recipes
  FOR INSERT
  WITH CHECK (
    local_id IN (
      SELECT id FROM locals WHERE business_id = current_setting('app.current_business_id')::UUID
    )
  );

CREATE POLICY recipes_update_own_business ON recipes
  FOR UPDATE
  USING (
    local_id IN (
      SELECT id FROM locals WHERE business_id = current_setting('app.current_business_id')::UUID
    )
  );

CREATE POLICY recipes_delete_own_business ON recipes
  FOR DELETE
  USING (
    local_id IN (
      SELECT id FROM locals WHERE business_id = current_setting('app.current_business_id')::UUID
    )
  );

-- Similar para recipe_ingredients y recipe_consumption_history
CREATE POLICY recipe_ingredients_select ON recipe_ingredients
  FOR SELECT
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE local_id IN (
        SELECT id FROM locals WHERE business_id = current_setting('app.current_business_id')::UUID
      )
    )
  );

CREATE POLICY recipe_consumption_select ON recipe_consumption_history
  FOR SELECT
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE local_id IN (
        SELECT id FROM locals WHERE business_id = current_setting('app.current_business_id')::UUID
      )
    )
  );

-- ============================================================
-- INITIAL DATA: Categorías de recetas
-- ============================================================

INSERT INTO recipe_categories (name, description) VALUES
  ('Entradas', 'Platos para comenzar'),
  ('Platos Principales', 'Platos fuertes'),
  ('Postres', 'Dulces y postres'),
  ('Bebidas', 'Bebidas'),
  ('Sándwiches', 'Sándwiches y bocadillos'),
  ('Ensaladas', 'Ensaladas y platos frescos')
ON CONFLICT DO NOTHING;

-- ============================================================
-- VISTA: Recipe Details (para queries rápidas)
-- ============================================================

CREATE OR REPLACE VIEW v_recipes_with_costs AS
SELECT 
  r.id,
  r.local_id,
  r.name,
  r.description,
  r.price_sale,
  r.portions_yield,
  r.prep_time_minutes,
  r.is_active,
  r.category_id,
  rc.name AS category_name,
  -- Costo total (suma dinámica de ingredientes)
  COALESCE(SUM(
    ri.quantity_required * 
    COALESCE(
      (p.purchase_price::NUMERIC / 
       NULLIF(COALESCE(p.package_quantity, 1)::NUMERIC, 0)), 
      0
    )
  ), 0) AS total_cost,
  -- Margen de ganancia
  CASE 
    WHEN r.price_sale > 0 THEN 
      ROUND(((r.price_sale - COALESCE(SUM(
        ri.quantity_required * 
        COALESCE(
          (p.purchase_price::NUMERIC / 
           NULLIF(COALESCE(p.package_quantity, 1)::NUMERIC, 0)), 
          0
        )
      ), 0)) / r.price_sale) * 100, 2)
    ELSE 0
  END AS margin_percent,
  COUNT(DISTINCT ri.product_id) AS ingredient_count,
  r.created_at,
  r.updated_at
FROM recipes r
LEFT JOIN recipe_categories rc ON r.category_id = rc.id
LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
LEFT JOIN products p ON ri.product_id = p.id
GROUP BY r.id, r.local_id, r.name, r.description, r.price_sale, 
         r.portions_yield, r.prep_time_minutes, r.is_active, 
         r.category_id, rc.name, r.created_at, r.updated_at;
