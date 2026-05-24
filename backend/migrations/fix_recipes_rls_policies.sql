-- ============================================================
-- FIX: Policies RLS de recetas
--
-- Problema: las políticas usaban current_setting('app.current_business_id')
-- que nunca se setea en la sesión → error 42704 en PostgreSQL.
--
-- Solución: usar auth.jwt() para leer business_id del JWT de Supabase,
-- que está disponible en user_metadata o app_metadata del token.
--
-- Cómo ejecutar: pega este script en el SQL Editor de Supabase.
-- ============================================================

-- ── Limpiar policies rotas ───────────────────────────────────

DROP POLICY IF EXISTS recipes_select_by_local          ON recipes;
DROP POLICY IF EXISTS recipes_insert_own_business       ON recipes;
DROP POLICY IF EXISTS recipes_update_own_business       ON recipes;
DROP POLICY IF EXISTS recipes_delete_own_business       ON recipes;
DROP POLICY IF EXISTS recipe_ingredients_select         ON recipe_ingredients;
DROP POLICY IF EXISTS recipe_consumption_select         ON recipe_consumption_history;

-- ── Helper: extrae business_id del JWT ──────────────────────
-- Busca en user_metadata primero, luego en app_metadata.
-- Retorna NULL (no explota) si ninguno está presente.

CREATE OR REPLACE FUNCTION auth_business_id() RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt()->'user_metadata'->>'business_id'),
    (auth.jwt()->'app_metadata'->>'business_id')
  )::UUID
$$;

-- ── Policies corregidas para `recipes` ──────────────────────

CREATE POLICY recipes_select_by_local ON recipes
  FOR SELECT
  USING (
    local_id IN (
      SELECT id FROM locals WHERE business_id = auth_business_id()
    )
  );

CREATE POLICY recipes_insert_own_business ON recipes
  FOR INSERT
  WITH CHECK (
    local_id IN (
      SELECT id FROM locals WHERE business_id = auth_business_id()
    )
  );

CREATE POLICY recipes_update_own_business ON recipes
  FOR UPDATE
  USING (
    local_id IN (
      SELECT id FROM locals WHERE business_id = auth_business_id()
    )
  );

CREATE POLICY recipes_delete_own_business ON recipes
  FOR DELETE
  USING (
    local_id IN (
      SELECT id FROM locals WHERE business_id = auth_business_id()
    )
  );

-- ── Policies corregidas para `recipe_ingredients` ───────────

CREATE POLICY recipe_ingredients_select ON recipe_ingredients
  FOR SELECT
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE local_id IN (
        SELECT id FROM locals WHERE business_id = auth_business_id()
      )
    )
  );

CREATE POLICY recipe_ingredients_insert ON recipe_ingredients
  FOR INSERT
  WITH CHECK (
    recipe_id IN (
      SELECT id FROM recipes WHERE local_id IN (
        SELECT id FROM locals WHERE business_id = auth_business_id()
      )
    )
  );

CREATE POLICY recipe_ingredients_update ON recipe_ingredients
  FOR UPDATE
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE local_id IN (
        SELECT id FROM locals WHERE business_id = auth_business_id()
      )
    )
  );

CREATE POLICY recipe_ingredients_delete ON recipe_ingredients
  FOR DELETE
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE local_id IN (
        SELECT id FROM locals WHERE business_id = auth_business_id()
      )
    )
  );

-- ── Policies corregidas para `recipe_consumption_history` ───

CREATE POLICY recipe_consumption_select ON recipe_consumption_history
  FOR SELECT
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE local_id IN (
        SELECT id FROM locals WHERE business_id = auth_business_id()
      )
    )
  );
