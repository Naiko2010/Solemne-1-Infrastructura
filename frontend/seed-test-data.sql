-- ============================================================================
-- SCRIPT PARA GENERAR DATOS DE PRUEBA EN SUPABASE
-- ============================================================================
-- Este script genera datos realistas para probar las métricas del frontend
--
-- INSTRUCCIONES:
-- 1. Abre Supabase Studio: https://supabase.com/dashboard
-- 2. Ve a SQL Editor
-- 3. Crea una nueva query
-- 4. Copia este contenido y PERSONALIZA los valores marcados con [TODO]
-- 5. Ejecuta la query
--
-- ============================================================================

-- ✅ UUID PERSONALIZADO
-- Local: 838d770e-e781-4bf2-8b4a-20a622a5cc7f
DO $$
DECLARE
  v_local_id UUID := '838d770e-e781-4bf2-8b4a-20a622a5cc7f'::uuid;
  v_today DATE := CURRENT_DATE;
  v_month_start DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
BEGIN

-- ============================================================================
-- 1. GENERAR ÓRDENES/VENTAS (orders table)
-- ============================================================================
INSERT INTO orders (
  local_id,
  total_amount,
  payment_method,
  status,
  source,
  created_at,
  items
) VALUES
  (v_local_id, 15500, 'cash', 'completed', 'pos', NOW() - INTERVAL '5 hours',
   '[{"id": "item-1", "name": "Café Espresso", "quantity": 2, "unit_price": 5000}, {"id": "item-2", "name": "Té de Menta", "quantity": 1, "unit_price": 5500}]'::jsonb),
  (v_local_id, 32000, 'debit', 'completed', 'pos', NOW() - INTERVAL '4 hours',
   '[{"id": "item-3", "name": "Almuerzo Ejecutivo", "quantity": 1, "unit_price": 32000}]'::jsonb),
  (v_local_id, 24800, 'credit', 'completed', 'pos', NOW() - INTERVAL '3.5 hours',
   '[{"id": "item-4", "name": "Menú Mixto", "quantity": 1, "unit_price": 24800}]'::jsonb),
  (v_local_id, 8900, 'cash', 'completed', 'delivery', NOW() - INTERVAL '3 hours',
   '[{"id": "item-5", "name": "Bebida Premium", "quantity": 1, "unit_price": 8900}]'::jsonb),
  (v_local_id, 45000, 'transfer', 'completed', 'pos', NOW() - INTERVAL '2.5 hours',
   '[{"id": "item-6", "name": "Catering 10 personas", "quantity": 1, "unit_price": 45000}]'::jsonb),
  (v_local_id, 12300, 'cash', 'completed', 'pos', NOW() - INTERVAL '2 hours',
   '[{"id": "item-7", "name": "Postre Especial", "quantity": 1, "unit_price": 12300}]'::jsonb),
  (v_local_id, 28500, 'debit', 'completed', 'online', NOW() - INTERVAL '1 hour',
   '[{"id": "item-8", "name": "Plato Principal x2", "quantity": 2, "unit_price": 14250}]'::jsonb),
  (v_local_id, 19900, 'cash', 'completed', 'pos', NOW() - INTERVAL '30 minutes',
   '[{"id": "item-9", "name": "Desayuno Completo", "quantity": 1, "unit_price": 19900}]'::jsonb);

-- ============================================================================
-- 2. GENERAR GASTOS (expenses table)
-- ============================================================================
INSERT INTO expenses (
  local_id,
  amount,
  status,
  description,
  expense_date,
  created_at,
  category
) VALUES
  (v_local_id, 50000, 'approved', 'Compra de insumos - Café Premium', v_today, NOW() - INTERVAL '2 days', 'supplies'),
  (v_local_id, 35000, 'approved', 'Servicio de limpieza', v_today, NOW() - INTERVAL '1 day', 'services'),
  (v_local_id, 15000, 'pending', 'Reparación de equipo', v_today, NOW(), 'maintenance'),
  (v_local_id, 28000, 'approved', 'Nómina chef - 50%', v_today, NOW() - INTERVAL '3 days', 'payroll'),
  (v_local_id, 22500, 'pending', 'Servicio de delivery terceros', v_today, NOW() - INTERVAL '6 hours', 'services');

-- ============================================================================
-- 3. GENERAR TRANSFERENCIAS (transfers table)
-- ============================================================================
INSERT INTO transfers (
  local_id,
  amount,
  status,
  description,
  receipt_url,
  created_at,
  transfer_date
) VALUES
  (v_local_id, 120000, 'completed', 'Transferencia dueño -> local', 'https://example.com/receipt-001', v_today - INTERVAL '7 days', v_today - INTERVAL '7 days'),
  (v_local_id, 150000, 'completed', 'Transferencia dueño -> local', 'https://example.com/receipt-002', v_today - INTERVAL '3 days', v_today - INTERVAL '3 days'),
  (v_local_id, 85000, 'pending', 'Transferencia solicitada', 'https://example.com/receipt-pending', NOW(), v_today);

-- ============================================================================
-- 4. GENERAR CAJAS (petty_cash / cajas table)
-- ============================================================================
INSERT INTO cajas (
  local_id,
  name,
  is_active,
  balance,
  created_at,
  updated_at
) VALUES
  (v_local_id, 'Caja Principal', true, 250000, NOW() - INTERVAL '30 days', NOW()),
  (v_local_id, 'Caja Secundaria', true, 85000, NOW() - INTERVAL '15 days', NOW()),
  (v_local_id, 'Caja Mostrador', false, 0, NOW() - INTERVAL '20 days', NOW() - INTERVAL '5 days');

-- ============================================================================
-- 5. MENSAJES DE CONFIRMACIÓN
-- ============================================================================
RAISE NOTICE 'Datos de prueba generados exitosamente para local: %', v_local_id;
RAISE NOTICE 'Se crearon:';
RAISE NOTICE '  - 8 órdenes de ventas (total: CLP 186,400)';
RAISE NOTICE '  - 5 registros de gastos (total: CLP 150,500)';
RAISE NOTICE '  - 3 transferencias (total: CLP 355,000)';
RAISE NOTICE '  - 3 cajas registradas';
RAISE NOTICE '';
RAISE NOTICE 'El frontend debería reflejar estos datos en:';
RAISE NOTICE '  - Dashboard: Ventas diarias, flujo de caja, meta mensual';
RAISE NOTICE '  - Sección Ventas: Listado de órdenes por método de pago';
RAISE NOTICE '  - Rendiciones: Gastos aprobados + transferencias';
RAISE NOTICE '  - Flujo de Caja: Estado de cajas por local';

END $$;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
--
-- 1. Reemplaza 'f47ac10b-58cc-4372-a567-0e02b2c3d479' con el UUID real del local
--    Puedes obtenerlo de la tabla 'locals' en Supabase Studio
--
-- 2. Si tu estructura de tablas es diferente, ajusta:
--    - Nombres de tablas
--    - Nombres de columnas
--    - Tipos de datos
--
-- 3. Los montos están en CLP (Peso Chileno) según tu proyecto
--
-- 4. Las fechas se generan relativamente a TODAY para que siempre sean datos recientes
--
-- 5. Después de ejecutar:
--    - Ve al frontend
--    - Selecciona el local
--    - Accede a Administrativo -> Dashboard
--    - Verifica que veas los datos en las secciones
--
-- ============================================================================
