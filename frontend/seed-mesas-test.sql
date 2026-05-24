-- ============================================================================
-- SIMULADOR DE MESA OCUPADA - DATOS DE PRUEBA (VERSIÓN SQL PURO)
-- ============================================================================
-- Script para crear mesas con orden activa y productos asociados
-- Para fin de testing del comportamiento de HU-59, HU-60, HU-61, HU-62
--
-- LOCAL: Restaurante Principal (838d770e-e781-4bf2-8b4a-20a622a5cc7f)
--
-- INSTRUCCIONES:
-- 1. Abre Supabase Studio -> SQL Editor -> Crea nueva query
-- 2. Copia TODO este contenido y pégalo.
-- 3. Ejecuta la query (Botón ▶️ o Ctrl+Enter)
-- 4. Vuelve al frontend: http://localhost:5173/pos y recarga la página.
-- ============================================================================

-- ============================================================================
-- 1. LIMPIAR DATOS ANTERIORES PARA EVITAR DUPLICADOS Y ERRORES
-- ============================================================================
DELETE FROM order_items WHERE order_id IN (
  SELECT id FROM orders WHERE mesa_id IN (
    SELECT id FROM mesas WHERE local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid AND name IN ('Mesa 1', 'Mesa 2')
  )
);
DELETE FROM orders WHERE mesa_id IN (
  SELECT id FROM mesas WHERE local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid AND name IN ('Mesa 1', 'Mesa 2')
);

-- ============================================================================
-- 2. ASEGURAR QUE LAS MESAS EXISTAN
-- ============================================================================
INSERT INTO mesas (local_id, name, numero, capacidad, zona, is_active)
SELECT '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid, 'Mesa 1', 1, 4, 'Salón Principal', true
WHERE NOT EXISTS (SELECT 1 FROM mesas WHERE local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid AND name = 'Mesa 1');

INSERT INTO mesas (local_id, name, numero, capacidad, zona, is_active)
SELECT '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid, 'Mesa 2', 2, 6, 'Salón Principal', true
WHERE NOT EXISTS (SELECT 1 FROM mesas WHERE local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid AND name = 'Mesa 2');

-- ============================================================================
-- 3. ASEGURAR CATEGORÍA
-- ============================================================================
INSERT INTO categories (local_id, name, is_active) 
SELECT '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid, 'Bebidas y Alimentos', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid AND name = 'Bebidas y Alimentos');

-- ============================================================================
-- 4. ACTUALIZAR O CREAR PRODUCTOS DE PRUEBA (Para HU-62)
-- ============================================================================
-- Limpiar descripciones viejas si el producto existía
UPDATE products SET description = 'Hamburguesa doble. Añadidos: Tocino, Extra Queso.', price = 15000 
WHERE name = 'Hamburguesa Premium' AND category_id IN (SELECT id FROM categories WHERE local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid);

UPDATE products SET description = 'Ensalada de la casa. Sin añadidos.', price = 8000 
WHERE name = 'Ensalada Fresca' AND category_id IN (SELECT id FROM categories WHERE local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid);

-- Insertar si no existían
INSERT INTO products (category_id, name, description, price, is_active)
SELECT c.id, 'Hamburguesa Premium', 'Hamburguesa doble. Añadidos: Tocino, Extra Queso.', 15000, true
FROM categories c 
WHERE c.local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid AND c.name = 'Bebidas y Alimentos'
  AND NOT EXISTS (SELECT 1 FROM products p JOIN categories c2 ON p.category_id=c2.id WHERE p.name='Hamburguesa Premium' AND c2.local_id='838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid LIMIT 1);

INSERT INTO products (category_id, name, description, price, is_active)
SELECT c.id, 'Ensalada Fresca', 'Ensalada de la casa. Sin añadidos.', 8000, true
FROM categories c 
WHERE c.local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid AND c.name = 'Bebidas y Alimentos'
  AND NOT EXISTS (SELECT 1 FROM products p JOIN categories c2 ON p.category_id=c2.id WHERE p.name='Ensalada Fresca' AND c2.local_id='838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid LIMIT 1);

INSERT INTO products (category_id, name, description, price, is_active)
SELECT c.id, 'Jugo Natural', 'Jugo de naranja natural', 4000, true
FROM categories c 
WHERE c.local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid AND c.name = 'Bebidas y Alimentos'
  AND NOT EXISTS (SELECT 1 FROM products p JOIN categories c2 ON p.category_id=c2.id WHERE p.name='Jugo Natural' AND c2.local_id='838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid LIMIT 1);

-- ============================================================================
-- 5. CREAR ORDEN PARA MESA 1 (OCUPADA - in_progress) -> Para HU-59 y HU-60
-- ============================================================================
WITH mesa1 AS (
  SELECT id FROM mesas WHERE local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid AND name = 'Mesa 1' LIMIT 1
)
INSERT INTO orders (local_id, mesa_id, status, payment_method, source, subtotal, tax, discount, total, created_at)
SELECT '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid, id, 'in_progress', 'cash', 'dine-in', 19000, 0, 0, 19000, NOW()
FROM mesa1;

-- Agregar Items a Mesa 1 (HU-61)
WITH order1 AS (
   SELECT o.id FROM orders o JOIN mesas m ON o.mesa_id = m.id WHERE m.local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid AND m.name = 'Mesa 1' AND o.status = 'in_progress' LIMIT 1
), p1 AS (
   SELECT p.id as pid FROM products p JOIN categories c ON p.category_id=c.id WHERE p.name='Hamburguesa Premium' AND c.local_id='838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid LIMIT 1
), p3 AS (
  SELECT p.id as pid FROM products p JOIN categories c ON p.category_id=c.id WHERE p.name='Jugo Natural' AND c.local_id='838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid LIMIT 1
)
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
SELECT (SELECT id FROM order1), (SELECT pid FROM p1), 1, 15000, 15000
WHERE (SELECT id FROM order1) IS NOT NULL AND (SELECT pid FROM p1) IS NOT NULL
UNION ALL
SELECT (SELECT id FROM order1), (SELECT pid FROM p3), 1, 4000, 4000
WHERE (SELECT id FROM order1) IS NOT NULL AND (SELECT pid FROM p3) IS NOT NULL;

-- ============================================================================
-- 6. CREAR ORDEN PARA MESA 2 (EN COBRO - ready) -> Para HU-59 y HU-60
-- ============================================================================
WITH mesa2 AS (
  SELECT id FROM mesas WHERE local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid AND name = 'Mesa 2' LIMIT 1
)
INSERT INTO orders (local_id, mesa_id, status, payment_method, source, subtotal, tax, discount, total, created_at)
SELECT '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid, id, 'ready', 'card', 'dine-in', 16000, 0, 0, 16000, NOW() - INTERVAL '15 minutes'
FROM mesa2;

-- Agregar Items a Mesa 2
WITH order2 AS (
   SELECT o.id FROM orders o JOIN mesas m ON o.mesa_id = m.id WHERE m.local_id = '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid AND m.name = 'Mesa 2' AND o.status = 'ready' LIMIT 1
), p2 AS (
   SELECT p.id as pid FROM products p JOIN categories c ON p.category_id=c.id WHERE p.name='Ensalada Fresca' AND c.local_id='838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid LIMIT 1
)
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
SELECT (SELECT id FROM order2), (SELECT pid FROM p2), 2, 8000, 16000
WHERE (SELECT id FROM order2) IS NOT NULL AND (SELECT pid FROM p2) IS NOT NULL;

