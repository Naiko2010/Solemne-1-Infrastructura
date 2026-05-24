"""
MIGRATIONS: Recipe Management Module (HU-XX / SCRUM-XXX)

Tables:
- recipe_categories
- recipes
- recipe_ingredients
- recipe_cost_cache (optional, for performance)

Migration script for Supabase PostgreSQL
"""

-- ============================================================
-- 1. RECIPE CATEGORIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS recipe_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(local_id, name),
    
    -- Foreign Keys
    CONSTRAINT fk_recipe_categories_local FOREIGN KEY (local_id)
        REFERENCES locals(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_recipe_categories_local_id ON recipe_categories(local_id);
CREATE INDEX idx_recipe_categories_is_active ON recipe_categories(is_active);

-- RLS
ALTER TABLE recipe_categories ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. RECIPES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id UUID NOT NULL,
    recipe_category_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Comercial
    price_sale INT NOT NULL CHECK (price_sale > 0), -- CLP (sin decimales)
    
    -- Physical attributes
    servings INT NOT NULL CHECK (servings > 0), -- porciones
    prep_time_minutes INT CHECK (prep_time_minutes >= 0), -- minutos de preparación
    
    -- Status & Audit
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(local_id, name),
    
    -- Foreign Keys
    CONSTRAINT fk_recipes_local FOREIGN KEY (local_id)
        REFERENCES locals(id) ON DELETE CASCADE,
    CONSTRAINT fk_recipes_category FOREIGN KEY (recipe_category_id)
        REFERENCES recipe_categories(id) ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX idx_recipes_local_id ON recipes(local_id);
CREATE INDEX idx_recipes_category_id ON recipes(recipe_category_id);
CREATE INDEX idx_recipes_is_active ON recipes(is_active);
CREATE INDEX idx_recipes_local_active ON recipes(local_id, is_active);

-- RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. RECIPE_INGREDIENTS JUNCTION TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL,
    product_id UUID NOT NULL,
    
    -- Consumption
    quantity_required DECIMAL(10, 2) NOT NULL CHECK (quantity_required > 0),
    unit VARCHAR(20) NOT NULL CHECK (unit IN ('g', 'kg', 'ml', 'L', 'unit')),
    
    -- Order & Status
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(recipe_id, product_id),
    
    -- Foreign Keys
    CONSTRAINT fk_recipe_ingredients_recipe FOREIGN KEY (recipe_id)
        REFERENCES recipes(id) ON DELETE CASCADE,
    CONSTRAINT fk_recipe_ingredients_product FOREIGN KEY (product_id)
        REFERENCES products(id) ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_product_id ON recipe_ingredients(product_id);
CREATE INDEX idx_recipe_ingredients_active ON recipe_ingredients(is_active);

-- RLS
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RECIPE COST CACHE (Optional, for performance)
-- ============================================================

CREATE TABLE IF NOT EXISTS recipe_cost_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL UNIQUE,
    local_id UUID NOT NULL,
    
    -- Calculated costs (updated when ingredients change)
    total_cost_per_recipe INT NOT NULL DEFAULT 0, -- CLP
    cost_per_serving INT NOT NULL DEFAULT 0, -- CLP
    margin_amount INT NOT NULL DEFAULT 0, -- CLP = price_sale - total_cost
    margin_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0, -- % = (margin / price_sale) * 100
    
    -- Metadata
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
    
    -- Foreign Keys
    CONSTRAINT fk_recipe_cost_cache_recipe FOREIGN KEY (recipe_id)
        REFERENCES recipes(id) ON DELETE CASCADE,
    CONSTRAINT fk_recipe_cost_cache_local FOREIGN KEY (local_id)
        REFERENCES locals(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_recipe_cost_cache_recipe_id ON recipe_cost_cache(recipe_id);
CREATE INDEX idx_recipe_cost_cache_local_id ON recipe_cost_cache(local_id);

-- ============================================================
-- 5. VIEW: RECIPE_DETAIL (helpful for queries)
-- ============================================================

CREATE OR REPLACE VIEW recipes_with_costs AS
SELECT
    r.id,
    r.local_id,
    r.name,
    r.description,
    r.price_sale,
    r.servings,
    r.prep_time_minutes,
    r.is_active,
    rc.name AS category_name,
    COALESCE(rcc.total_cost_per_recipe, 0) AS estimated_cost,
    COALESCE(rcc.cost_per_serving, 0) AS cost_per_serving,
    COALESCE(rcc.margin_amount, r.price_sale) AS margin_amount,
    COALESCE(rcc.margin_percentage, 100) AS margin_percentage,
    ARRAY_AGG(
        JSON_BUILD_OBJECT(
            'product_id', ri.product_id,
            'product_name', p.name,
            'quantity_required', ri.quantity_required,
            'unit', ri.unit
        ) ORDER BY ri.sort_order
    ) AS ingredients,
    r.created_at,
    r.updated_at
FROM recipes r
LEFT JOIN recipe_categories rc ON r.recipe_category_id = rc.id
LEFT JOIN recipe_cost_cache rcc ON r.id = rcc.recipe_id
LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
LEFT JOIN products p ON ri.product_id = p.id
WHERE ri.is_active OR ri.id IS NULL
GROUP BY r.id, rc.name, rcc.id;

-- ============================================================
-- 6. TRIGGER: Update recipe updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_recipe_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_recipe_timestamp
    BEFORE UPDATE ON recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_recipe_timestamp();

CREATE TRIGGER trg_update_recipe_ingredients_timestamp
    BEFORE UPDATE ON recipe_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_recipe_timestamp();

-- ============================================================
-- 7. RLS POLICIES (multi-tenant by local_id)
-- ============================================================

-- Recipe Categories: Select
CREATE POLICY "recipe_categories_select_by_local"
    ON recipe_categories
    FOR SELECT
    USING (local_id IN (
        SELECT local_id FROM users_locals WHERE user_id = auth.uid()
    ));

-- Recipe Categories: Insert/Update/Delete (admin only)
CREATE POLICY "recipe_categories_modify_local_admin"
    ON recipe_categories
    FOR ALL
    USING (
        local_id IN (SELECT local_id FROM users_locals WHERE user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('SUPERADMIN', 'ADMIN'))
    );

-- Recipes: Select
CREATE POLICY "recipes_select_by_local"
    ON recipes
    FOR SELECT
    USING (local_id IN (
        SELECT local_id FROM users_locals WHERE user_id = auth.uid()
    ));

-- Recipes: Insert/Update/Delete
CREATE POLICY "recipes_modify_by_local_admin"
    ON recipes
    FOR ALL
    USING (
        local_id IN (SELECT local_id FROM users_locals WHERE user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('SUPERADMIN', 'ADMIN'))
    );

-- Recipe Ingredients: Select
CREATE POLICY "recipe_ingredients_select_via_recipe"
    ON recipe_ingredients
    FOR SELECT
    USING (recipe_id IN (
        SELECT id FROM recipes WHERE local_id IN (
            SELECT local_id FROM users_locals WHERE user_id = auth.uid()
        )
    ));

-- Recipe Ingredients: Modify
CREATE POLICY "recipe_ingredients_modify_via_recipe_admin"
    ON recipe_ingredients
    FOR ALL
    USING (
        recipe_id IN (
            SELECT id FROM recipes WHERE local_id IN (
                SELECT local_id FROM users_locals WHERE user_id = auth.uid()
            )
        )
        AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('SUPERADMIN', 'ADMIN'))
    );

-- Recipe Cost Cache: Select
CREATE POLICY "recipe_cost_cache_select_by_local"
    ON recipe_cost_cache
    FOR SELECT
    USING (local_id IN (
        SELECT local_id FROM users_locals WHERE user_id = auth.uid()
    ));
