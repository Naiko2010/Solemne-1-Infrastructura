# Informe Tecnico Completo de Refactorizacion

Fecha de corte: 2026-05-06

## 1. Objetivo

Documentar de forma exhaustiva la evolucion tecnica y la refactorizacion del sistema comparando:

1. Estado historico desde el primer commit.
2. Diferencias contra main original de GitHub.
3. Analisis del contenido de chat disponible en esta sesion.

Incluye backend y frontend, con detalle de cambios, borrados, archivos afectados, riesgos y trazabilidad.

---

## 2. Fuentes y metodologia

Se utilizaron evidencias directas de Git y del workspace local:

1. Historial de commits con git log.
2. Deltas por ventana con git diff name-status y shortstat.
3. Inspeccion de diffs funcionales en rutas y hooks criticos.
4. Logs de chat disponibles en el directorio de debug de la sesion activa.

Ventanas de comparacion usadas:

1. root..HEAD (desde inicio del repo hasta hoy).
2. origin/main...HEAD (refactor reciente respecto a main remoto).

---

## 3. Repositorios analizados

## 3.1 Backend

- Repositorio: Delivery-Custom-App-INGSW2
- Rama actual observada: fix/ci-repair-inventory-kpi
- Main remoto de referencia: origin/main (a6bf50a)
- Divergencia observada vs origin/main: 5 commits ahead, 2 behind

## 3.2 Frontend

- Repositorio: Delivery-Custom-App-INGSW2-FRONTEND
- Rama actual observada: develop
- Main remoto de referencia: origin/main (9d786a7)
- Divergencia observada vs origin/main: 2 commits ahead, 6 behind

---

## 4. Resumen ejecutivo tecnico

1. El backend presenta una refactorizacion reciente significativa centrada en seguridad, CORS, RBAC, resolucion de conflicto de rutas de inventario KPI y estandarizacion de errores HTTP.
2. El frontend presenta una refactorizacion reciente acotada en commits, pero importante para despliegue multiambiente al eliminar hardcode de localhost.
3. La refactorizacion reciente tambien incluye reorganizacion documental extensa y consolidacion de flujos funcionales en backend y frontend.
4. Desde el inicio, ambos repos crecieron principalmente por adicion masiva de funcionalidad.

---

## 5. Cronologia tecnica (desde inicio)

## 5.1 Backend: hitos por commits

Secuencia destacada observada:

1. Inicializacion y base del proyecto.
2. Levantamiento de entorno y dockerizacion dev/prod.
3. Consolidacion de backend FastAPI con tests.
4. Integracion de auth y modulos de productos, dashboard, POS, mesas y carrito.
5. Incorporacion de inventario, recetas, proveedores, compras y ordenes semanales.
6. Hardening reciente:
   - fix(inventory,schemas,cors): RBAC + alias route + mutable default fix + headers.
   - fix(inventory): resolucion de conflicto de ruta + RBAC inventory_kpi.
   - fix(cors,cleanup): OPTIONS y limpieza de headers invalidos.
   - fix(recipes): conversion de excepciones no controladas a HTTPException.
   - fix(deps): service_role tambien para ADMIN cuando esta configurado.

## 5.2 Frontend: hitos por commits

Secuencia destacada observada:

1. Inicializacion con dashboard superadmin y gestion de locales.
2. Integraciones incrementales de productos, carrito, dashboard local y modulo administrativo.
3. Implementacion de POS, inventario, proveedores, compras semanales y recetas.
4. Refactor reciente:
   - fix(pos): reemplazo de localhost hardcodeado por VITE_API_URL.

---

## 6. Metricas globales por ventana

## 6.1 Backend

### 6.1.1 Desde inicio (root..HEAD)

- 109 archivos cambiados
- 18435 inserciones
- Conteo por tipo:
  - A: 108
  - D: 1

### 6.1.2 Refactor reciente (origin/main...HEAD)

- 45 archivos cambiados
- 3488 inserciones
- 7546 eliminaciones
- Conteo por tipo:
  - A: 12
  - D: 24
  - M: 9

## 6.2 Frontend

### 6.2.1 Desde inicio (root..HEAD)

- 219 archivos cambiados
- 44600 inserciones
- 636 eliminaciones
- Conteo por tipo:
  - A: 214
  - M: 5

### 6.2.2 Refactor reciente (origin/main...HEAD)

- 2 archivos cambiados
- 8 inserciones
- 4 eliminaciones
- Conteo por tipo:
  - M: 2

---

## 7. Commits recientes de refactor (vs main)

## 7.1 Backend: origin/main..HEAD

1. ad973de fix(deps): use service_role for ADMIN when configured
2. cb646ad fix(recipes): convert all unhandled exceptions to HTTPException
3. a71dc08 fix(cors,cleanup): add OPTIONS to allow_methods, drop invalid expose * header
4. c03cba1 fix(inventory): resolve route conflict + add RBAC to inventory_kpi
5. fc7d306 fix(inventory,schemas,cors): RBAC + alias route, mutable default fix, expose X-Total-Count headers

## 7.2 Frontend: origin/main..HEAD

1. c4e26b8 fix(pos): replace hardcoded localhost:8000 with VITE_API_URL env var
2. 07ba823 merge previo en develop

---

## 8. Cambios funcionales confirmados en codigo (detalle tecnico)

## 8.1 Backend

### 8.1.1 Seguridad y acceso por rol

Archivo afectado: src/deps.py

Cambio funcional:

- Antes: cliente elevado (service_role) aplicado a SUPERADMIN.
- Ahora: aplica a SUPERADMIN y ADMIN cuando esta configurado.

Impacto:

- Menos bloqueos por RLS en rutas donde el control de acceso de negocio ya se aplica en capa Python.
- Riesgo: si no se validan correctamente business_id y role en handlers, el bypass de RLS aumenta superficie de impacto.

### 8.1.2 CORS y bootstrap de app

Archivo afectado: src/main.py

Cambios funcionales:

1. Parametrizacion de CORS con allow_methods explicitos.
2. Exposicion de header X-Total-Count.
3. Registro de routers centralizado mediante estructura iterativa.

Impacto:

- Configuracion mas predecible y mantenible.
- Menor comportamiento ambiguo que con wildcard total.

### 8.1.3 KPI de inventario y conflicto de rutas

Archivos afectados:

1. src/api/routes/inventory_kpi.py
2. src/api/routes/inventory_stock.py

Cambios funcionales:

1. Endpoints KPI consolidados y con validacion por negocio.
2. Eliminacion de duplicidad previa en inventory_stock.
3. Alias para aggregate KPI.

Impacto:

- Se reduce riesgo de colision de rutas y ambiguedad funcional.
- Se fortalece autorizacion de acceso por local y negocio.

### 8.1.4 Manejo de errores en recetas

Archivo afectado: src/api/routes/recipes.py

Cambio funcional:

- Se envuelven excepciones no controladas en HTTPException coherentes por endpoint.

Impacto:

- API mas estable y predecible para frontend.
- Menor fuga de stack traces o errores crudos.

### 8.1.5 Ajustes de schemas

Archivo afectado: src/schemas/__init__.py

Cambios funcionales observados en ventanas analizadas:

1. Inclusiones y ajustes relacionados a respuestas de KPIs agregados.
2. Se avanza en la remocion de estructuras legacy asociadas a inventory total value.

### 8.1.6 Ajuste en auth para sync metadata

Archivo afectado: src/api/routes/auth.py

Cambio funcional:

- Reemplazo de sync key hardcodeada por lectura desde settings.

Impacto:

- Mejora de seguridad y gobernanza de secretos.

### 8.1.7 Ajuste en orders para ChangeLocal

Archivo afectado: src/api/routes/orders.py

Cambios funcionales:

1. Nuevo GET de resumen de orden para flujo de cambio de local.
2. Nuevo PATCH para reasignar local de una orden.

Impacto:

- Habilita funcionalidad operacional de cambio de local en POS.

### 8.1.8 Ajuste en locals para alias disponible

Archivo afectado: src/api/routes/locals.py

Cambio funcional:

- Nuevo endpoint alias de locales por negocio disponibles.

Impacto:

- Soporta flujo frontend de seleccion/cambio de local.

### 8.1.9 Ajuste en suppliers y servicio

Archivos afectados:

1. src/api/routes/suppliers.py
2. src/services/supplier_service.py

Cambios funcionales:

1. Nueva excepcion tipada SupplierNotFoundError.
2. Mejor discriminacion de errores 404/400/500.
3. Manejo explicito de faltas de esquema extendido.

Impacto:

- Respuestas mas semanticas y trazables para consumo frontend.

### 8.1.10 Ajuste en configuracion de entorno

Archivo afectado: src/core/config.py

Cambios funcionales:

1. Validacion de CORS segun APP_ENV.
2. Restriccion de origenes de desarrollo fuera de development.
3. Reglas de https obligatorio en production.
4. Nuevo campo sync_metadata_key.

Impacto:

- Fortalecimiento de seguridad operativa por entorno.

### 8.1.11 Remocion en curso de endpoint legacy total inventory value

Archivos involucrados:

1. src/api/routes/inventory_total_value.py
2. src/valor_total_inventario/__init__.py
3. src/valor_total_inventario/service.py

Impacto:

- Simplificacion de arquitectura KPI si ya no se requiere endpoint dedicado.
- Riesgo de ruptura si existen consumidores externos no migrados.

## 8.2 Frontend

### 8.2.1 Refactor committeado de URL base API

Archivos afectados:

1. src/components/pos/AddProductModal.jsx
2. src/hooks/useOrderItems.js

Cambio:

- Eliminacion de localhost hardcodeado y uso de VITE_API_URL.

Impacto:

- Portabilidad entre entornos.
- Menos deuda tecnica por endpoints fijos.

### 8.2.2 Ajustes en ChangeLocal

Archivos afectados:

1. src/components/ChangeLocal.jsx
2. src/hooks/useAvailableLocals.js
3. src/hooks/useOrderSummary.js

Cambios:

1. business_id derivado de summary de forma consistente.
2. Migracion de fetch manual a apiRequest centralizado.

Impacto:

- Menos duplicacion de manejo de errores y auth.
- Flujo ChangeLocal mas robusto.

### 8.2.3 Ajustes en POS

Archivos afectados:

1. src/components/pos/AddProductModal.jsx
2. src/components/pos/MesaDetailModal.jsx

Cambio:

- Normalizacion payment_method: cash -> CASH.

Impacto:

- Alineacion con formato esperado por backend/dominio.

### 8.2.4 Limpieza de docs y modulo Cart

Archivos eliminados en el proceso (subset mas relevante):

1. src/components/Cart.jsx
2. src/hooks/useCart.js
3. src/styles/Cart.css
4. Multiples md de soporte temporal y reportes legacy.

Impacto:

- Reduce ruido documental y codigo legacy.
- Riesgo: posible ruptura si aun hay imports o rutas activas no detectadas en esta revision.

---

## 9. Archivos afectados (listado exhaustivo por ventana)

Nota: se incluye lo extraido directamente de git. Esto refleja adicion, modificacion y eliminacion de archivos por cada ventana analizada.

## 9.1 Backend root..HEAD (desde inicio)

A .claude/settings.local.json
A .dockerignore
A .env.example
A .gitignore
A ATTRIBUTIONS.md
D Custom Delivery App - Resumen.pdf
A Dockerfile
A INDEX.md
A LICENSE
A README.md
A SECURITY.md
A create_test_data.py
A docker-compose.dev.yml
A docker-compose.yml
A docs/API.md
A docs/ARCHITECTURE.md
A docs/AUTH.md
A docs/CONTRIBUTING.md
A docs/DEPLOYMENT.md
A docs/FEATURES.md
A docs/README.md
A docs/ROADMAP.md
A docs/TESTING.md
A guidelines/Guidelines.md
A migrations/hu59_mesas_visualization.sql
A migrations/hu86_suppliers_registration.sql
A migrations/hu89_purchases.sql
A migrations/hu90_recipes.sql
A migrations/hu_xx_recipes_management.sql
A migrations/locals_rls_policies_authenticated.sql
A migrations/recipes_module.sql
A migrations/suppliers_catalog.sql
A migrations/weekly_purchase_orders.sql
A migrations/wpo_add_total_estimated_clp.sql
A node_modules/.vite/deps/_metadata.json
A node_modules/.vite/deps/package.json
A pytest.ini
A requirements.txt
A scripts/docker-dev-down.ps1
A scripts/docker-dev-up.ps1
A src/__init__.py
A src/api/__init__.py
A src/api/routes/__init__.py
A src/api/routes/auth.py
A src/api/routes/businesses.py
A src/api/routes/cajas.py
A src/api/routes/cart_items.py
A src/api/routes/categories.py
A src/api/routes/dashboard.py
A src/api/routes/expenses.py
A src/api/routes/inventory_kpi.py
A src/api/routes/inventory_new_product.py
A src/api/routes/inventory_stock.py
A src/api/routes/inventory_total_value.py
A src/api/routes/locals.py
A src/api/routes/mesas.py
A src/api/routes/orders.py
A src/api/routes/products.py
A src/api/routes/providers.py
A src/api/routes/purchases.py
A src/api/routes/recipes.py
A src/api/routes/suppliers.py
A src/api/routes/transfers.py
A src/api/routes/users.py
A src/api/routes/weekly_purchase_orders.py
A src/core/__init__.py
A src/core/config.py
A src/core/security.py
A src/deps.py
A src/inventario_kpi/__init__.py
A src/inventario_kpi/logic.py
A src/inventario_kpi/service.py
A src/main.py
A src/schemas/__init__.py
A src/services/__init__.py
A src/services/cart_items_service.py
A src/services/inventory_kpi_logic.py
A src/services/inventory_new_product_service.py
A src/services/inventory_stock_service.py
A src/services/purchases_service.py
A src/services/recipes_service.py
A src/services/supabase_client.py
A src/services/supplier_kpis_service.py
A src/services/supplier_service.py
A src/services/supplier_validation.py
A src/services/weekly_purchase_orders_service.py
A src/valor_total_inventario/__init__.py
A src/valor_total_inventario/service.py
A tests/reports/dashboard-metrics-report.html
A tests/reports/unit-tests-report.html
A tests/test_dashboard_metrics.py
A tests/test_endpoints.py
A tests/test_inventario_kpi_aggregation.py
A tests/test_inventario_kpi_consistency.py
A tests/test_inventario_kpi_logic.py
A tests/test_inventory_kpi_aggregate.py
A tests/test_inventory_kpi_classification.py
A tests/test_inventory_kpis.py
A tests/test_inventory_stock_filters.py
A tests/test_inventory_stock_hu48.py
A tests/test_inventory_stock_service.py
A tests/test_inventory_stock_status.py
A tests/test_new_product_validation.py
A tests/test_purchases_service.py
A tests/test_supabase_connection.py
A tests/test_supplier_kpis_service.py
A tests/test_supplier_service.py
A tests/test_supplier_validation.py
A tests/test_valor_total_inventario.py

## 9.2 Backend origin/main...HEAD (refactor reciente)

A .claude/settings.local.json
D API_SPEC.md
M ATTRIBUTIONS.md
D AUTH_FLOW.md
D BACKEND_STATUS.md
D CAMBIOS_REALIZADOS.md
D CHECKLIST_IMPLEMENTACION_FRONTEND.md
D Custom Delivery App - Resumen.pdf
D DOCKER.md
D FRONTEND_IMPLEMENTATION_EXAMPLES.md
D HU57_ESTRUCTURA_ARCHIVOS.md
D HU57_FINAL_REPORT.md
D HU57_GUIA_ACTIVACION.md
D HU57_GUIA_COMPLETA.md
D HU57_GUIA_USUARIO.md
D HU57_IMPLEMENTATION.md
D HU57_QUICK_START.md
D HU57_RESUMEN.md
A INDEX.md
D INDICE_ENTREGA.md
D INFORME_KPI_INVENTARIO.md
A LICENSE
D LOCAL_ADMIN_DASHBOARD_API.md
D QUICK_TEST_GUIDE.md
M README.md
D README_INICIO_RAPIDO.md
D RECIPES_MODULE_BACKEND.md
D RESUMEN_CAMBIOS_CODIGO.md
A docs/API.md
A docs/ARCHITECTURE.md
A docs/AUTH.md
A docs/CONTRIBUTING.md
A docs/DEPLOYMENT.md
A docs/FEATURES.md
A docs/README.md
A docs/ROADMAP.md
A docs/TESTING.md
M src/api/routes/inventory_kpi.py
M src/api/routes/inventory_stock.py
M src/api/routes/locals.py
M src/api/routes/recipes.py
M src/deps.py
M src/main.py
M src/schemas/__init__.py
D src/services/recipes_service_old.py

## 9.4 Frontend root..HEAD (desde inicio)

A .agents/skills/supabase-postgres-best-practices/SKILL.md
A .agents/skills/supabase-postgres-best-practices/references/_contributing.md
A .agents/skills/supabase-postgres-best-practices/references/_sections.md
A .agents/skills/supabase-postgres-best-practices/references/_template.md
A .agents/skills/supabase-postgres-best-practices/references/advanced-full-text-search.md
A .agents/skills/supabase-postgres-best-practices/references/advanced-jsonb-indexing.md
A .agents/skills/supabase-postgres-best-practices/references/conn-idle-timeout.md
A .agents/skills/supabase-postgres-best-practices/references/conn-limits.md
A .agents/skills/supabase-postgres-best-practices/references/conn-pooling.md
A .agents/skills/supabase-postgres-best-practices/references/conn-prepared-statements.md
A .agents/skills/supabase-postgres-best-practices/references/data-batch-inserts.md
A .agents/skills/supabase-postgres-best-practices/references/data-n-plus-one.md
A .agents/skills/supabase-postgres-best-practices/references/data-pagination.md
A .agents/skills/supabase-postgres-best-practices/references/data-upsert.md
A .agents/skills/supabase-postgres-best-practices/references/lock-advisory.md
A .agents/skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md
A .agents/skills/supabase-postgres-best-practices/references/lock-short-transactions.md
A .agents/skills/supabase-postgres-best-practices/references/lock-skip-locked.md
A .agents/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md
A .agents/skills/supabase-postgres-best-practices/references/monitor-pg-stat-statements.md
A .agents/skills/supabase-postgres-best-practices/references/monitor-vacuum-analyze.md
A .agents/skills/supabase-postgres-best-practices/references/query-composite-indexes.md
A .agents/skills/supabase-postgres-best-practices/references/query-covering-indexes.md
A .agents/skills/supabase-postgres-best-practices/references/query-index-types.md
A .agents/skills/supabase-postgres-best-practices/references/query-missing-indexes.md
A .agents/skills/supabase-postgres-best-practices/references/query-partial-indexes.md
A .agents/skills/supabase-postgres-best-practices/references/schema-constraints.md
A .agents/skills/supabase-postgres-best-practices/references/schema-data-types.md
A .agents/skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md
A .agents/skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md
A .agents/skills/supabase-postgres-best-practices/references/schema-partitioning.md
A .agents/skills/supabase-postgres-best-practices/references/schema-primary-keys.md
A .agents/skills/supabase-postgres-best-practices/references/security-privileges.md
A .agents/skills/supabase-postgres-best-practices/references/security-rls-basics.md
A .agents/skills/supabase-postgres-best-practices/references/security-rls-performance.md
A .agents/skills/supabase/SKILL.md
A .agents/skills/supabase/assets/feedback-issue-template.md
A .agents/skills/supabase/references/skill-feedback.md
A .claude/settings.local.json
A .claude/skills/supabase
A .claude/skills/supabase-postgres-best-practices
A .dockerignore
A .env
A .env.example
A .gitignore
A BACK_TO_LOCALES_SUMMARY.md
A CHECKLIST_HU19_FINAL.md
A DEMO_VISUAL.md
A DESIGN_DETAILS.md
A DOCS_INDEX.md
A Dockerfile.dev
A FINAL_SUMMARY.md
A HEADER_UPDATE.md
A HU19_FRONTEND_CHECKLIST.md
A HU19_FRONTEND_INTEGRATION.md
A HU19_RESUMEN_EJECUCION.md
A HU59_IMPLEMENTATION.md
A HU60_IMPLEMENTATION.md
A LOCALES_BUTTON_UPDATE.md
A MESAS_TEST_DATA_GUIDE.md
A NUEVO_DISENO.md
A PRESENTATION.md
A QUICK_START.md
A README.md
A SEED_DATA_GUIDE.md
A SUMMARY.md
A TESTING_CHECKLIST.md
A TEST_REPORT.md
A VALIDATION_COMPLETE.md
A docker-entrypoint-dev.sh
A eslint.config.js
A icons/logo-sibaritico.png
A index.html
A package-lock.json
A package.json
A public/favicon.svg
A public/icons.svg
A public/sibaritco-logo.svg
A seed-mesas-test.sql
A seed-test-data.sql
A skills-lock.json
A skills/supabase
A skills/supabase-postgres-best-practices
M src/App.css
M src/App.jsx
M src/components/AdminDashboard.jsx
A src/components/AdministrativeModule.jsx
A src/components/Cart.jsx
A src/components/ChangeLocal.jsx
A src/components/ChangeLocal.test.jsx
A src/components/ClientDashboard.jsx
A src/components/CreateLocalModal.jsx
A src/components/InventoryKpiDashboard.jsx
A src/components/LoadingPage.css
A src/components/LoadingPage.jsx
A src/components/LoadingSpinner.css
A src/components/LoadingSpinner.jsx
A src/components/LocalsGrid.jsx
A src/components/LoginPage.jsx
A src/components/ModulesGrid.jsx
A src/components/OrderSummary.jsx
A src/components/OrderSummary.test.jsx
A src/components/WorkerLocalSelector.jsx
A src/components/charts/ExpenseBreakdown.jsx
A src/components/charts/IncomeChart.jsx
A src/components/inventory/BackToInventoryHubButton.css
A src/components/inventory/BackToInventoryHubButton.jsx
A src/components/inventory/CategoryFilterSelect.jsx
A src/components/inventory/CategoryFilterSelect.test.jsx
A src/components/inventory/CategoryTypeahead.jsx
A src/components/inventory/CategoryTypeahead.test.jsx
A src/components/inventory/InventoryHub.jsx
A src/components/inventory/InventoryModuleHub.jsx
A src/components/inventory/InventoryShell.jsx
A src/components/inventory/ModernDateField.jsx
A src/components/inventory/NuevoProductoModal.jsx
A src/components/inventory/ProductsTable.jsx
A src/components/inventory/ProductsTable.test.jsx
A src/components/inventory/RegisterSupplierModal.jsx
A src/components/inventory/RegisterSupplierModal.test.jsx
A src/components/inventory/StatusFilterCheckboxes.jsx
A src/components/inventory/StatusFilterCheckboxes.test.jsx
A src/components/inventory/StockControlDashboard.jsx
A src/components/inventory/StockControlDashboard.test.jsx
A src/components/inventory/StockStatusBadge.jsx
A src/components/inventory/StockStatusBadge.test.jsx
A src/components/inventory/SupplierDetailModal.jsx
A src/components/inventory/SuppliersKpisDashboard.jsx
A src/components/inventory/SuppliersKpisDashboard.test.jsx
A src/components/inventory/recipes/CreateRecipeModal.jsx
A src/components/inventory/recipes/RecipeDetail.jsx
A src/components/inventory/recipes/RecipesList.jsx
A src/components/inventory/recipes/RecipesPage.jsx
A src/components/inventory/recipes/recipes.css
A src/components/inventory/stockAlertUtils.js
A src/components/inventory/stockAlertUtils.test.js
A src/components/inventory/weeklyPurchases/WeeklyPurchaseDetailPage.jsx
A src/components/inventory/weeklyPurchases/WeeklyPurchasesPage.jsx
A src/components/pos/AddProductModal.jsx
A src/components/pos/CreateMesaModal.jsx
A src/components/pos/DeleteMesaModal.jsx
A src/components/pos/EditMesaModal.jsx
A src/components/pos/MenuModal.jsx
A src/components/pos/MesaDetail.jsx
A src/components/pos/MesaDetailModal.jsx
A src/components/pos/MesasFilters.jsx
A src/components/pos/MesasKPICards.jsx
A src/components/pos/MesasVisualization.jsx
A src/components/pos/POSModule.jsx
A src/components/pos/ProductDetailModal.jsx
A src/components/pos/ProductList.jsx
A src/components/pos/ReportesModal.jsx
A src/hooks/useAvailableLocals.js
A src/hooks/useAvailableLocals.test.js
A src/hooks/useCart.js
A src/hooks/useLocals.js
A src/hooks/useMenuPOS.js
A src/hooks/useMesaDetail.js
A src/hooks/useMesas.js
A src/hooks/useMesasConEstado.js
A src/hooks/useMesasKPIs.js
A src/hooks/useOrderItems.js
A src/hooks/useOrderManagement.js
A src/hooks/useOrderSummary.js
A src/hooks/useOrderSummary.test.js
A src/hooks/useRecipes.js
A src/hooks/useReportesPOS.js
M src/index.css
A src/integration.test.js
A src/lib/administrativeApi.js
A src/lib/apiClient.js
A src/lib/categoryCatalogCache.js
A src/lib/formatCLP.js
A src/lib/inventoryApi.js
A src/lib/inventoryApi.test.js
A src/lib/providersApi.js
A src/lib/weeklyPurchasesApi.js
A src/styles/AddProductModal.css
M src/styles/AdminDashboard.css
A src/styles/AdministrativeModule.css
A src/styles/Cart.css
A src/styles/ChangeLocal.css
A src/styles/ClientDashboard.css
A src/styles/CreateLocalModal.css
A src/styles/DeleteMesaModal.css
A src/styles/EditMesaModal.css
A src/styles/InventoryKpiDashboard.css
A src/styles/LocalDashboard.css
A src/styles/LocalsGrid.css
A src/styles/MenuModal.css
A src/styles/MesaDetail.css
A src/styles/MesaDetailModal.css
A src/styles/MesasFilters.css
A src/styles/MesasVisualization.css
A src/styles/ModulesGrid.css
A src/styles/OrderSummary.css
A src/styles/POSModule.css
A src/styles/ProductDetailModal.css
A src/styles/ProductList.css
A src/styles/ReportesModal.css
A src/styles/WorkerLocalSelector.css
A src/styles/charts.css
A src/styles/inventory/InventoryModuleHub.css
A src/styles/inventory/InventoryShell.css
A src/styles/inventory/ModernDateField.css
A src/styles/inventory/NuevoProductoModal.css
A src/styles/inventory/StockControlDashboard.css
A src/styles/inventory/WeeklyPurchases.css
A src/utils/chartDataHelpers.js
A src/utils/chileRut.js
A src/utils/chileRut.test.js
A src/utils/inventoryAccess.js
A src/utils/jwt.js
A test_results.html
A test_viewer.py
A update-product.js
A vite.config.js
A vitest.config.js
A vitest.setup.js

## 9.5 Frontend origin/main...HEAD (refactor reciente)

M src/components/pos/AddProductModal.jsx
M src/hooks/useOrderItems.js

---

## 10. Analisis de chat disponible

## 10.1 Lo que si pudo analizarse

1. Esta sesion actual completa (solicitudes y refinamientos del informe).
2. Evidencia tecnica generada en esta sesion (comandos y resultados de git/diff).

## 10.2 Lo que no esta disponible en logs locales consultados

1. No se encontro transcripcion completa de conversaciones historicas previas en los archivos de debug accesibles.
2. En main.jsonl solo se observo evento de session_start para esta sesion.

## 10.3 Conclusiones del analisis de chat (sesion actual)

1. Requisito principal confirmado: informe tecnico total, sin enfoque academico, con detalle de codigo modificado, borrado y evolucion desde inicio.
2. Se priorizo trazabilidad por evidencia de git en tres ventanas para evitar omisiones.
3. Se agrego explicitamente la limitacion de acceso a historicos de chat no presentes en logs.

---

## 11. Riesgos tecnicos y regresiones potenciales

1. Eliminacion en curso de inventory_total_value puede afectar consumidores no migrados.
2. Uso de service_role para ADMIN exige disciplina fuerte en validaciones de negocio por codigo.
3. Limpieza local masiva en frontend puede romper rutas/imports si se consolida sin smoke test.
4. Cambios CORS por ambiente pueden bloquear orígenes no declarados en despliegue real.

---

## 12. Recomendaciones tecnicas de cierre

1. Congelar alcance y separar commits por bloque funcional:
   - bloque backend funcional
   - bloque frontend funcional
   - bloque limpieza documental
2. Ejecutar verificacion antes de merge:
   - backend: tests de orders, locals, recipes, suppliers, inventory
   - frontend: build, pruebas de navegacion y flujo ChangeLocal
3. Definir plan de deprecacion para inventory_total_value:
   - ventana de compatibilidad
   - release note
   - verificacion de consumidores
4. Documentar en changelog tecnico por release para trazabilidad operativa.

---

## 13. Estado final

El sistema refleja una evolucion extensa desde su inicio con crecimiento funcional alto y una refactorizacion reciente backend significativa. El frontend reciente en commits tiene un cambio puntual estrategico y consolidacion de mejoras funcionales. Este informe consolida la foto tecnica completa disponible con evidencia directa del repositorio y de la sesion actual.

---

## 14. Evolucion del esquema de base de datos (detallado)

Esta seccion responde especificamente a la evolucion de estructura (tablas, columnas, indices, RLS) y su impacto en funcionamiento.

### 14.1 Fase base: catalogos y multi-tenant

Migraciones clave:

1. migrations/suppliers_catalog.sql
2. migrations/locals_rls_policies_authenticated.sql

Evolucion:

1. Se introduce catalogo formal de proveedores por negocio (tabla public.suppliers).
2. Se agrega FK supplier_id en products para trazabilidad producto-proveedor.
3. Se activan politicas RLS para suppliers y locals basadas en business_id del JWT.

Problemas historicos asociados (evidencia por commits):

1. Inconsistencias de acceso por rol/JWT en proveedores y dashboard (fix auth y hardening de API).
2. Necesidad de estabilizar politicas entre anon+JWT y service_role en backend.

Estado funcional actual:

1. Bueno: base de aislamiento por negocio existe y tiene politicas explicitas.
2. Riesgo: cuando backend usa service_role, la seguridad depende mas de validaciones Python que de RLS nativo.

### 14.2 Fase mesas/POS

Migracion clave:

1. migrations/hu59_mesas_visualization.sql

Evolucion:

1. Se agregan columnas mesas.numero y mesas.state para visualizacion grafica.
2. Se agrega indice por state e indice compuesto (local_id, state).
3. Se agrega created_at para trazabilidad temporal.

Problemas historicos asociados:

1. Sin columnas de visualizacion, la UI POS de mesas no podia representar estado de forma eficiente.
2. Sin indices, consultas por estado/local escalaban peor.

Estado funcional actual:

1. Bueno: modelo soporta filtros por estado y vista operacional de mesas.
2. Riesgo: si estados no se normalizan en backend/frontend, puede haber drift semantico.

### 14.3 Fase inventario y KPIs

Migraciones/ajustes y commits relacionados:

1. Ajustes en schemas de respuesta (InventoryKpiAggregateResponse, InventoryTotalValueResponse).
2. Commits fc7d306 y c03cba1 (RBAC, alias route, conflicto de rutas KPI).

Evolucion:

1. Se consolida KPI agregado y se corrige conflicto entre rutas de inventario.
2. Se quita duplicidad funcional en rutas inventory_stock vs inventory_kpi.
3. Se exponen headers utiles para paginacion/total (X-Total-Count).

Problemas historicos asociados:

1. Roto antes: colision/duplicidad de endpoint de KPI, comportamiento ambiguo.
2. Roto antes: defaults mutables y problemas de serializacion de schema en algunos payloads.

Estado funcional actual:

1. Bueno: endpoints de KPI mas coherentes y con RBAC explicito.
2. Riesgo abierto: deprecacion en curso de inventory_total_value puede romper consumidores antiguos si no se migra.

### 14.4 Fase recetas

Migraciones clave:

1. migrations/recipes_module.sql
2. migrations/hu90_recipes.sql

Evolucion:

1. Modelo inicial de recetas con ingredientes, categorias y consumo historico.
2. Evolucion posterior a esquema mas orientado a negocio/local + versionado (recipe_versions).
3. Inclusiones de constraints, indices y comentarios para costos/margen.

Problemas historicos asociados (evidencia de commits):

1. Roto antes: handlers duplicados con bases SQLAlchemy antiguas mezcladas.
2. Roto antes: funciones duplicadas (list_recipes) con dependencias inexistentes.
3. Roto antes: excepciones no controladas devolviendo errores poco estables.

Estado funcional actual:

1. Bueno: rutas mas limpias, menos duplicidad, excepciones estandarizadas en HTTPException.
2. Riesgo: coexistencia historica de dos enfoques de esquema de recetas requiere disciplina para evitar regresiones de compatibilidad.

### 14.5 Fase proveedores extendidos

Migracion clave:

1. migrations/hu86_suppliers_registration.sql

Evolucion:

1. Se agregan campos rut, address, category, contact_name, phone, email.
2. Se agrega indice unico por negocio para RUT no vacio.

Problemas historicos asociados:

1. Roto antes: falta de campos extendidos causaba errores de columnas faltantes (schema cache / undefined_column).
2. Roto antes: validaciones de formato y mensajes de error no uniformes.

Estado funcional actual:

1. Bueno: alta de proveedor mas completa y con mejor calidad de dato.
2. Riesgo: si no se aplica la migracion hu86 en todos los ambientes, persisten 42703/PGRST204 en runtime.

### 14.6 Fase compras y ordenes semanales

Migraciones clave:

1. migrations/weekly_purchase_orders.sql
2. migrations/wpo_add_total_estimated_clp.sql
3. migrations/hu89_purchases.sql

Evolucion:

1. Se crea modelo de orden semanal con estados de ciclo de vida.
2. Se crean lineas de orden con cantidades pedidas/recibidas.
3. Se incorpora total_estimated_clp para reportes comparativos.
4. Se agrega tabla purchases para registro de compras efectivas con constraints.
5. Se aplican politicas RLS por negocio para tablas de compras y ordenes.

Problemas historicos asociados:

1. Roto antes: consultas/reportes esperando total_estimated_clp fallaban si la columna no existia.
2. Roto antes: falta de estructura unificada para historico de compras por proveedor.

Estado funcional actual:

1. Bueno: existe continuidad entre planificacion semanal y compras reales.
2. Riesgo: ambientes parcialmente migrados quedan en estado inconsistente para reportes.

---

## 15. Matriz de funcionamiento: que estuvo roto, que quedo bien, que sigue pendiente

### 15.1 Backend

1. Auth/JWT y acceso por rol
  - Estuvo roto/parcial: accesos inconsistentes segun JWT y rol en algunos flujos historicos.
  - Correccion aplicada: fixes en auth, uso de metadata, hardening por rol, service_role para ADMIN en escenario definido.
  - Estado: parcialmente estabilizado.
  - Pendiente: validar exhaustivamente que todos los handlers sensibles hagan check de business_id cuando usan cliente elevado.

2. Inventario KPI
  - Estuvo roto/parcial: conflicto/solapamiento de rutas KPI y respuestas no uniformes.
  - Correccion aplicada: consolidacion de rutas, RBAC explicito, schema agregado.
  - Estado: bueno en arquitectura de endpoint.
  - Pendiente: completar deprecacion del endpoint legacy inventory_total_value con ventana de compatibilidad.

3. CORS
  - Estuvo roto/parcial: configuraciones demasiado abiertas o inconsistentes para ciertos metodos/headers.
  - Correccion aplicada: allow_methods explicitos, limpieza de expose headers invalidos, validaciones por ambiente.
  - Estado: mejorado.
  - Pendiente: asegurar CORS_ORIGINS productivos correctos en despliegue real.

4. Recetas
  - Estuvo roto/parcial: duplicacion de handlers y excepciones no controladas.
  - Correccion aplicada: remocion de duplicados y estandarizacion de errores.
  - Estado: mejorado y mas predecible.
  - Pendiente: smoke test de modulo completo en ambiente con todas migraciones aplicadas.

5. Proveedores
  - Estuvo roto/parcial: errores de columnas faltantes en esquema extendido y respuestas de error poco semanticas.
  - Correccion aplicada: migracion hu86, validaciones, tipado de errores not found, manejo explicito de schema missing.
  - Estado: funcional en ambientes migrados.
  - Pendiente: control de version de esquema entre ambientes para evitar drift.

6. Compras/ordenes semanales
  - Estuvo roto/parcial: reportes con columna faltante total_estimated_clp en instalaciones incompletas.
  - Correccion aplicada: migracion de columna y pipeline de compras mas completo.
  - Estado: funcional si migraciones estan al dia.
  - Pendiente: verificacion de migraciones en todos los entornos (dev/staging/prod).

### 15.2 Frontend

1. URL de API en POS
  - Estuvo roto/parcial: localhost hardcodeado impedia despliegue limpio por entorno.
  - Correccion aplicada: uso de VITE_API_URL.
  - Estado: bueno.
  - Pendiente: revisar que no queden hardcodes en otros modulos legacy.

2. Flujo ChangeLocal
  - Estuvo roto/parcial: calculo de business_id basado en placeholder en vez de dato de resumen.
  - Correccion aplicada: se toma business_id desde summary + hooks con apiRequest centralizado.
  - Estado: definido y funcional en el flujo objetivo.
  - Pendiente: pruebas de integracion end-to-end con backend actualizado.

3. Metodo de pago en payload POS
  - Estuvo roto/parcial: uso de cash en minuscula podia no coincidir con expectativa de backend.
  - Correccion aplicada: normalizacion a CASH.
  - Estado: estabilizado en el flujo de POS.
  - Pendiente: confirmar contrato de enum exacto en backend y tests de regresion.

4. Modulo Cart y limpieza masiva
  - Estuvo bueno historicamente: soportaba flujo de carrito previo.
  - Cambio actual: eliminado junto con documentacion temporal.
  - Estado: riesgo de regresion si existen imports/rutas residuales.
  - Pendiente: validacion de build y navegacion completa antes de merge.

### 15.3 Estado de estabilidad por dominio (semaforo tecnico)

1. Auth y RBAC: Amarillo (mejorado, requiere verificacion de negocio en handlers con service_role).
2. Inventario KPI: Amarillo-Verde (conflictos principales resueltos; deprecacion legacy abierta).
3. Recetas: Amarillo-Verde (errores controlados; validar e2e con migraciones completas).
4. Proveedores: Amarillo (dependiente de migraciones hu86 aplicadas en todos los entornos).
5. Compras semanales: Amarillo (modelo completo, sensible a drift de esquema).
6. POS frontend: Amarillo-Verde (URL env corregida; requiere validacion e2e completa).

---

## 16. Brechas que faltaban en la version anterior del informe y que ahora quedan cubiertas

1. Evolucion de esquema por modulo y por migracion (tablas, columnas, RLS, indices).
2. Relacion directa entre cambios de esquema y sintomas funcionales historicos.
3. Matriz explicita de estado roto/bueno/pendiente por dominio backend y frontend.
4. Semaforo de estabilidad tecnica para priorizar cierre.

---

## 17. Evolucion funcional en lenguaje simple (que cambio en el uso real)

Esta seccion resume el proyecto como si se mirara desde operacion diaria (no solo desde codigo).

### 17.1 Etapa inicial

1. Se logro levantar una API funcional con autenticacion y modulos base.
2. El sistema permitia operar, pero habia zonas con deuda tecnica normal de crecimiento rapido.

### 17.2 Etapa de crecimiento

1. Se agregaron POS, mesas, inventario, dashboard, proveedores, recetas y compras.
2. El alcance funcional subio mucho, y con ello aparecieron problemas tipicos:
  - rutas que empezaron a solaparse
  - validaciones de acceso no homogoneas
  - casos donde faltaba esquema en BD y el error era poco claro

### 17.3 Etapa de correccion y endurecimiento

1. Se ordenaron rutas de KPI inventario y acceso por rol.
2. Se hicieron errores mas claros (HTTPException controlada).
3. Se reforzo la configuracion de CORS para ambientes reales.
4. Se corrigio frontend para no depender de localhost fijo.

### 17.4 Estado actual

1. El nucleo funcional esta mejor y mas consistente.
2. Existen frentes de cierre funcional que deben validarse:
  - flujo ChangeLocal
  - limpieza fuerte de archivos legacy/documentales
  - deprecacion de endpoint inventory_total_value

---

## 18. Evidencias concretas de cambios de codigo (antes y despues)

Esta seccion registra evidencia puntual de cambios que explican funcionamiento.

### 18.1 Backend: control de acceso inventario KPI

Evidencia:

1. src/api/routes/inventory_kpi.py
  - Antes: endpoint KPI sin validacion completa por negocio en la ruta consolidada.
  - Despues: _ensure_local_access + validacion explicita de rol ADMIN/SUPERADMIN + errores 403/404/500 controlados.

Resultado funcional:

1. Menos riesgo de que un admin consulte local de otro negocio.
2. Respuestas de error mas claras para frontend.

### 18.2 Backend: conflicto de rutas KPI

Evidencia:

1. src/api/routes/inventory_stock.py
  - Antes: existia endpoint KPI dentro de inventory_stock, duplicando responsabilidad.
  - Despues: se elimina ese bloque para centralizar KPI en inventory_kpi.

Resultado funcional:

1. Menos ambiguedad de endpoint.
2. Menor probabilidad de comportamiento diferente segun ruta consumida.

### 18.3 Backend: recetas con errores no controlados

Evidencia:

1. src/api/routes/recipes.py
  - Antes: varias ramas hacian raise generico.
  - Despues: se encapsula en HTTPException (400/404/500/503 segun caso).

Resultado funcional:

1. Frontend recibe errores estables y manejables.
2. Menos caidas opacas en operaciones de recetas.

### 18.4 Backend: service_role para ADMIN

Evidencia:

1. src/deps.py
  - Antes: elevacion por service_role solo para SUPERADMIN.
  - Despues: SUPERADMIN y ADMIN usan cliente elevado cuando esta configurado.

Resultado funcional:

1. Reduce bloqueos por RLS en operaciones administrativas complejas.
2. Exige controles de negocio robustos en capa Python.

### 18.5 Backend: flujo ChangeLocal

Evidencia:

1. src/api/routes/orders.py
  - Nuevo GET /orders/{order_id}/summary
  - Nuevo PATCH /orders/{order_id}/local
2. src/api/routes/locals.py
  - Nuevo GET /locals/by-business/{business_id}/available

Resultado funcional:

1. Se habilita traslado de orden entre locales con datos de soporte para UI.

### 18.6 Backend: seguridad de sync metadata

Evidencia:

1. src/api/routes/auth.py
  - Antes: sync_key hardcodeada.
  - Despues: sync_key tomada desde settings.sync_metadata_key.

Resultado funcional:

1. Mejor control de secreto por entorno.

### 18.7 Backend: proveedores con errores semanticos

Evidencia:

1. src/api/routes/suppliers.py
  - Se agrega deteccion de errores de esquema 42703/PGRST204.
  - Se devuelve 503 con mensaje de migracion faltante.
2. src/services/supplier_service.py
  - Se agrega SupplierNotFoundError para separar 404 de otros errores.

Resultado funcional:

1. Cuando falta migracion, el error deja de ser ambiguo.
2. Mejor trazabilidad de incidentes en soporte.

### 18.8 Frontend committeado: fin de localhost hardcodeado

Evidencia:

1. src/components/pos/AddProductModal.jsx
2. src/hooks/useOrderItems.js
  - Antes: fetch directo a http://localhost:8000
  - Despues: uso de VITE_API_URL

Resultado funcional:

1. Despliegues en distintos ambientes sin tocar codigo.

### 18.9 Frontend: ChangeLocal y cliente API central

Evidencia:

1. src/components/ChangeLocal.jsx
  - Antes: businessId derivado por placeholder.
  - Despues: businessId real desde summary.business_id.
2. src/hooks/useAvailableLocals.js y src/hooks/useOrderSummary.js
  - Antes: fetch manual repetido.
  - Despues: apiRequest centralizado.

Resultado funcional:

1. Menos errores de red duplicados.
2. Menos codigo repetido y mas mantenible.

### 18.10 Frontend: normalizacion payment_method

Evidencia:

1. src/components/pos/AddProductModal.jsx
2. src/components/pos/MesaDetailModal.jsx
  - Antes: payment_method = cash
  - Despues: payment_method = CASH

Resultado funcional:

1. Menos riesgo de mismatch con enums/validadores backend.

---

## 19. Que estaba bueno y se mantuvo

No todo fue correccion; hubo piezas que ya estaban bien y se conservaron:

1. Estructura modular por dominios (auth, orders, inventory, suppliers, recipes).
2. Presencia de pruebas en backend y frontend (base de validacion existente).
3. Capacidad multi-local y multi-negocio ya presente, luego reforzada.
4. Arquitectura de inventario con KPIs y vistas de control que se expandio sin rehacerse desde cero.

---

## 20. Que sigue roto o abierto hoy (realista y accionable)

1. Deprecacion de inventory_total_value aun en curso.
  - Impacto: posible quiebre en consumidores legacy.
  - Accion: plan de migracion + monitoreo de uso.

2. Integracion de cambios por bloques funcionales.
  - Impacto: si no se valida por flujo, puede haber regresiones.
  - Accion: pruebas por bloque + smoke end-to-end.

3. Ambientes potencialmente desalineados en migraciones.
  - Impacto: errores de columnas faltantes o politicas RLS incompletas.
  - Accion: checklist de migraciones aplicado por ambiente.

4. Limpieza de modulo Cart en frontend aun no cerrada por pruebas de navegacion completas.
  - Impacto: posible import/ruta residual.
  - Accion: build + smoke de rutas + revision de dependencias.

---

## 21. Evidencia de mantenimiento de repositorio (higiene)

Se aplico tambien una mejora de higiene de versionado solicitada:

1. Se agrego .claude/ y .qodo/ a .gitignore del backend.
2. Se agrego .claude/ y .qodo/ a .gitignore del frontend.

Objetivo:

1. Evitar que carpetas de tooling local ensucien commits y revisiones.

---

## 22. Cierre final ampliado

Este informe ahora cubre:

1. Evolucion historica desde inicio.
2. Refactor reciente vs main.
3. Evolucion funcional y documental consolidada.
4. Evolucion de esquema por migracion y efecto funcional.
5. Matriz de que estuvo roto, que quedo bien y que sigue abierto.
6. Evidencia concreta de cambios de codigo (antes/despues) en backend y frontend.
7. Acciones de higiene de repositorio (.gitignore).

Con esto, la trazabilidad queda completa para entender no solo que cambio, sino por que cambio, que resolvio, y que falta cerrar para dejar el sistema estable.

---

## 23. Limpieza de documentacion markdown (detalle completo)

Esta seccion existe para responder de forma directa si se considero o no la limpieza de .md historicos y actuales.

### 23.1 Backend: limpieza de .md en refactor reciente (origin/main...HEAD)

Archivos markdown eliminados:

1. API_SPEC.md
2. AUTH_FLOW.md
3. BACKEND_STATUS.md
4. CAMBIOS_REALIZADOS.md
5. CHECKLIST_IMPLEMENTACION_FRONTEND.md
6. DOCKER.md
7. FRONTEND_IMPLEMENTATION_EXAMPLES.md
8. HU57_ESTRUCTURA_ARCHIVOS.md
9. HU57_FINAL_REPORT.md
10. HU57_GUIA_ACTIVACION.md
11. HU57_GUIA_COMPLETA.md
12. HU57_GUIA_USUARIO.md
13. HU57_IMPLEMENTATION.md
14. HU57_QUICK_START.md
15. HU57_RESUMEN.md
16. INDICE_ENTREGA.md
17. INFORME_KPI_INVENTARIO.md
18. LOCAL_ADMIN_DASHBOARD_API.md
19. QUICK_TEST_GUIDE.md
20. README_INICIO_RAPIDO.md
21. RECIPES_MODULE_BACKEND.md
22. RESUMEN_CAMBIOS_CODIGO.md

Markdown agregados/reorganizados en su lugar:

1. docs/API.md
2. docs/ARCHITECTURE.md
3. docs/AUTH.md
4. docs/CONTRIBUTING.md
5. docs/DEPLOYMENT.md
6. docs/FEATURES.md
7. docs/README.md
8. docs/ROADMAP.md
9. docs/TESTING.md
10. INDEX.md

Markdown modificados:

1. README.md
2. ATTRIBUTIONS.md

Lectura funcional de esta limpieza:

1. Se paso de documentacion dispersa por entregables a estructura documental por tema.
2. La informacion no necesariamente se perdio; gran parte se consolido en carpeta docs.

### 23.2 Conclusion especifica sobre limpieza .md

1. Si, la limpieza de .md fue real, extensa y esta ahora documentada explicitamente.
2. Ocurrio como parte de la reorganizacion documental del refactor.
3. Recomendacion concreta:
  - crear una politica de archivo para documentos de sprint/entrega
  - evitar borrado masivo definitivo sin un indice de trazabilidad

---

## 24. Cierre ejecutivo y certificacion

Esta seccion consolida trazabilidad, estado de validacion y condiciones de salida.

### 24.1 Matriz de trazabilidad (incidente a evidencia)

| Incidente / Necesidad | Evidencia (Commit) | Evidencia (Archivo) | Estado | Riesgo residual | Prioridad |
|---|---|---|---|---|---|
| Solapamiento/conflicto en KPIs de inventario | c03cba1, fc7d306 | src/api/routes/inventory_kpi.py, src/api/routes/inventory_stock.py | Corregido | Bajo-Medio | Alta |
| Errores no controlados en recetas | cb646ad | src/api/routes/recipes.py | Corregido | Medio (depende de migraciones) | Alta |
| CORS inconsistente entre ambientes | a71dc08 + ajustes posteriores | src/main.py, src/core/config.py | Corregido | Medio (configuracion deploy) | Alta |
| Bloqueos administrativos por RLS en flujos complejos | ad973de | src/deps.py | Corregido | Medio (controles Python obligatorios) | Alta |
| Falta de esquema extendido de proveedores | 0ae3ae6 + hardening posterior | migrations/hu86_suppliers_registration.sql, src/api/routes/suppliers.py | Corregido en arquitectura | Medio (aplicacion de migracion por ambiente) | Alta |
| URL backend hardcodeada en POS frontend | c4e26b8 | src/components/pos/AddProductModal.jsx, src/hooks/useOrderItems.js | Corregido | Bajo | Alta |
| Orden y trazabilidad documental dispersa | bloque de refactor documental | docs/API.md, docs/ARCHITECTURE.md, docs/AUTH.md, docs/DEPLOYMENT.md, docs/TESTING.md | Corregido | Bajo | Media |

### 24.2 Estado de validacion ejecutada

Estado de evidencia de validacion en esta auditoria:

1. Se ejecuto validacion de trazabilidad por Git (commits, diffs, name-status, shortstat).
2. Se ejecuto validacion de evidencia de codigo por diffs de archivos clave.
3. No se ejecuto suite de pruebas automatizadas completa como parte de este informe.

Implicancia:

1. El informe certifica evolucion y consistencia de cambios.
2. La certificacion funcional final requiere corrida de pruebas en entorno de integracion.

### 24.3 Supuestos y limites del analisis

1. El analisis se basa en el estado del repositorio y remotos disponibles en la fecha de corte.
2. El analisis de chat se limita a logs disponibles localmente; no incluye historiales externos no presentes en esos archivos.
3. La evaluacion de riesgos asume aplicacion correcta de migraciones en cada ambiente.

### 24.4 Checklist de salida recomendada

Checklist previo a cierre definitivo:

1. Migraciones
  - Verificar hu86_suppliers_registration.sql aplicada en todos los ambientes.
  - Verificar hu89_purchases.sql y weekly_purchase_orders.sql aplicadas y consistentes.
  - Verificar columnas/indices de mesas y recetas en ambiente objetivo.

2. Seguridad y acceso
  - Revisar endpoints admin para confirmar check de business_id en capa Python.
  - Validar CORS_ORIGINS por ambiente (sin origenes de desarrollo en produccion).

3. API y contratos
  - Confirmar contrato de payment_method en POS (CASH y equivalentes esperados).
  - Confirmar estrategia final para endpoint legacy inventory_total_value.

4. Frontend
  - Smoke test de flujos: POS, inventario, proveedores, recetas, compras semanales.
  - Verificar ausencia de hardcodes de host en llamadas API.

5. Documentacion
  - Confirmar indice documental final despues de limpieza de .md.
  - Registrar politica de archivado de documentos de sprint para evitar perdida de contexto.

### 24.5 Declaracion de cierre

Con la evidencia consolidada en este documento:

1. La refactorizacion principal esta trazada de extremo a extremo (historia, codigo, esquema, documentacion).
2. Los principales incidentes historicos tienen correlacion explicita con correcciones concretas.

---

# SESION DE AUDIT Y CORRECCIONES — 2026-05-06

Esta seccion documenta la sesion de audit completo ejecutada el 2026-05-06 sobre ambos repositorios. Cubre los 10 bugs del audit formal mas 7 bugs adicionales descubiertos durante validacion en Docker. Cada bug incluye el estado antes, el fix aplicado y el estado despues.

**Stack:** React 19 + Vite 8 (frontend) / FastAPI + Supabase (backend)
**Supabase project:** qtrenssaghoeelbascfo
**Business seed:** sibaritico SpA — fe8378ff
**Local de prueba:** testing — 838d770e-e781-4bf2-8b4a-20a622a5cc7f

---

## 25. Resumen ejecutivo de la sesion 2026-05-06

| Tipo | Encontrados | Resueltos | Pendientes |
|------|------------|-----------|------------|
| Bugs criticos | 3 | 3 | 0 |
| Bugs alto | 5 | 5 | 0 |
| Bugs medio | 6 | 5 | 1 (deuda tecnica) |
| Bugs bajo | 4 | 4 | 0 |
| Falsos positivos | 8 | — | — |
| Hardcoded values | 8 | 2 | 6 (documentados) |

---

## 26. Arquitectura: flujo de autenticacion

```
Login (inline en App.jsx)
    │
    ▼
Supabase Auth SDK → JWT
    │  Contiene: user_id, role, business_id
    ▼
getAuthContext() [lib/apiClient.js]
    │  Lee session actual del SDK
    │  Retorna: { token, businessId, userId, localId }
    ▼
apiRequest(path, opts)
    │  Inyecta Authorization: Bearer <token>
    │  Retry automatico en 401
    │  Parsea errores a mensaje legible
    ▼
FastAPI endpoint
    │  get_current_user(Depends) → valida JWT con Supabase
    │  Normaliza role → SUPERADMIN / ADMIN / CAJERO / EMPLEADO
    ▼
Supabase DB (PostgREST)
```

---

## 27. Frontend — Bugs y fixes (sesion 2026-05-06)

### 27.1 Modulo Cliente/Cart — ELIMINADO (13 archivos)

**Severidad:** CRITICO

**Antes:**
```
src/
├── hooks/
│   ├── useCart.js          ← 6 fetch() crudos, auth via localStorage (roto)
│   ├── useOrderSummary.js  ← 2 fetch() crudos, llamaba endpoint inexistente
│   └── useAvailableLocals.js ← path /by-business/{id}/available → 404
├── components/
│   ├── Cart.jsx            ← activo en rutas
│   ├── ClientDashboard.jsx ← sin rol activo
│   ├── OrderSummary.jsx    ← activo en ruta /order/:id/summary
│   └── ChangeLocal.jsx     ← fetch() crudo + localStorage.getItem('authToken')
└── App.jsx                 ← rutas /order/:orderId/summary y /order/:orderId/change-local
```

Problema: Modulo "Cliente" (rol nunca implementado). `useCart.js` leia token de `localStorage` → siempre `null` en produccion (Supabase usa sessionStorage interno del SDK).

**Despues:**
- 13+ archivos eliminados (ver tabla en §30)
- 2 rutas dead eliminadas de App.jsx
- 2 imports eliminados de App.jsx

---

### 27.2 Token async llamado sincronamente (useOrderItems.js)

**Severidad:** CRITICO

**Antes (`useOrderItems.js:14`):**
```js
// getAuthContext() retorna Promise — llamar .session sobre Promise = undefined
const token = getAuthContext()?.session?.access_token  // SIEMPRE undefined
// Resultado: 401 silencioso en CADA llamada al POS
fetch(`${API_URL}/orders/${orderId}/items`, {
  headers: { Authorization: `Bearer ${token}` }  // Bearer undefined
})
```

**Despues:**
```js
// apiRequest obtiene el token internamente de forma async
const items = await apiRequest(`/orders/${orderId}/items`)
// Sin token manual, sin API_URL hardcodeado, retry automatico en 401
```

---

### 27.3 fetch() crudo en AddProductModal

**Severidad:** CRITICO

**Antes:**
```js
import { getAuthContext } from '../../lib/apiClient'
const { token } = await getAuthContext()
const resp = await fetch(`${import.meta.env.VITE_API_URL}/orders/${orderId}/items`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify(body),
})
```

**Despues:**
```js
await apiRequest(`/orders/${orderId}/items`, { method: 'POST', body })
```

---

### 27.4 Auth en localStorage directo (ChangeLocal.jsx)

**Severidad:** ALTO

**Antes (`ChangeLocal.jsx:37`):**
```js
const token = localStorage.getItem('authToken')  // siempre null
```

Resuelto al eliminar el archivo junto al modulo cliente.

---

### 27.5 Sin ErrorBoundary

**Severidad:** ALTO

**Antes:** Sin ErrorBoundary → crash de cualquier componente tiraba toda la app React sin mensaje.

**Despues:** Nuevo `src/components/ErrorBoundary.jsx`:
- En dev: muestra stack trace completo
- En prod: muestra mensaje generico + boton recargar
- Wrapeados los 3 bloques de rutas en App.jsx (superadmin, worker, fallback)

---

### 27.6 Null crash en MesaDetail

**Severidad:** ALTO

**Antes (`MesaDetailModal.jsx:147`):**
```jsx
const { name, estado, capacidad } = mesa  // TypeError si mesa === null
// Ocurria al abrir modal antes de que el fetch completara
```

**Despues:**
```jsx
if (!mesa) return <div>Mesa no encontrada — <button onClick={onBack}>Volver al POS</button></div>
const { name, estado, capacidad } = mesa  // seguro
```

---

### 27.7 N+1 en carga de mesas

**Severidad:** ALTO

**Antes (`useMesasConEstado.js`):**
```js
// 1 request para listar mesas + N requests para estado de cada mesa
const mesas = await apiRequest(`/mesas?local_id=${localId}`)
const estados = await Promise.allSettled(
  mesas.map(m => apiRequest(`/mesas/${m.id}/state`))
)
// Total: 1 + N requests por render
```

**Despues:**
```js
// 1 sola request con ?with_state=true (endpoint ya existia en backend)
const mesas = await apiRequest(`/mesas?local_id=${localId}&with_state=true`)
// Total: 1 request. Para 10 mesas: 11 requests → 1 request.
```

---

### 27.8 Dead components

**Severidad:** MEDIO

| Componente | Accion |
|---|---|
| ClientDashboard.jsx | Eliminado — rol "Cliente" nunca activo |
| Cart.jsx | Eliminado — modulo cliente |
| InventoryKpiDashboard.jsx | Eliminado — KPIs duplicados en StockControlDashboard |
| LoginPage.jsx | Eliminado — login vive inline en App.jsx |
| ModulesGrid.jsx | Falso positivo — activo en AdminDashboard |
| LocalsGrid.jsx | Falso positivo — activo en AdminDashboard |

---

### 27.9 CreateRecipeModal — productos con nombre incorrecto

**Descubierto en:** validacion post-deploy

**Antes:**
```jsx
// InventoryStockListItemResponse usa product_id/product_name, NO id/name
<option key={prod.id} value={prod.id}>        // undefined
  {prod.name} (${...}/u)                       // undefined — mostraba "($1/u)"
</option>
```

**Despues:**
```jsx
<option key={prod.product_id} value={prod.product_id}>
  {prod.product_name} (${Number(prod.unit_cost_clp ?? 0).toFixed(0)}/u)
</option>
```

Tambien corregido en `addIngredient()`:
```js
// Antes:
const product = products.find((p) => String(p.id) === selectedProductId)
product_name: product.name

// Despues:
const product = products.find((p) => String(p.product_id) === selectedProductId)
product_name: product.product_name
```

---

### 27.10 RegisterSupplierModal — submit silencioso

**Descubierto en:** validacion post-deploy

**Antes:** `validate()` marcaba `fieldErrors` pero no seteaba `error` global → boton no respondia sin feedback visible.

**Despues:**
```js
const validate = () => {
  const next = {}
  // ... validaciones ...
  setFieldErrors(next)
  const errs = Object.keys(next)
  if (errs.length > 0) {
    setError(`Corrige los campos requeridos: ${errs.map((k) => next[k]).join(' • ')}`)
  }
  return errs.length === 0
}
```

Nota RUT: campo usa validacion de checksum chileno estricta. RUT de prueba valido: `12.672.783-0`.

---

### 27.11 WeeklyPurchaseDetailPage — inputs numericos aceptan e/E/+/-

**Antes:** Inputs `type="number"` aceptaban `e`, `E`, `+`, `-` (caracteres validos en notacion cientifica HTML5 pero invalidos para cantidades/precios).

**Despues:**
```jsx
onKeyDown={(ev) => ['e', 'E', '+', '-'].includes(ev.key) && ev.preventDefault()}
```
Aplicado a los 3 inputs numericos del formulario de detalle de orden de compra.

---

### 27.12 NewWeeklyOrderModal — flash error al abrir

**Antes:** Error de sesion anterior persistia al abrir el modal por segunda vez.

**Despues:**
```js
useEffect(() => {
  if (!open || !businessId) {
    setError('')  // limpia error al cerrar
    return
  }
  // ...fetch proveedores...
}, [open, businessId])
```

---

### 27.13 ModernDateField — rango de años incorrecto

**Antes:**
```js
for (let y = cur + 1; y >= 1970; y -= 1) out.push(y)  // 56+ años en dropdown
```

**Despues:**
```js
for (let y = cur + 1; y >= cur - 3; y -= 1) out.push(y)  // ventana: cur-3 a cur+1
```

---

### 27.14 ModulesGrid — stats hardcodeadas visibles

**Antes:** Bloque con 4 cards hardcodeadas ("4 Modulos", "95% Sistema Funcional", "v1", rol del usuario) visibles debajo del grid.

**Despues:** Bloque `<div className="modules-stats">` eliminado. Prop `userRole` eliminada de la firma del componente.

---

### 27.15 Migracion inventoryApi.js + weeklyPurchasesApi.js — token manual

**Severidad:** ALTO (18 + 8 funciones con token manual)

**Antes (patron en 26 funciones):**
```js
export async function getInventoryProducts(localId, token) {
  const resp = await fetch(`${import.meta.env.VITE_API_URL}/inventory/locals/${localId}/stock`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  // ... manejo de errores manual ...
}
// Callers tenian que hacer: const { token } = await getAuthContext()
```

**Despues:**
```js
export async function getInventoryProducts(localId) {
  return apiRequest(`/inventory/locals/${localId}/stock`)
}
```

12 callers actualizados: StockControlDashboard, NuevoProductoModal, CategoryTypeahead, RegisterSupplierModal, InventoryHub, SuppliersKpisDashboard, SupplierDetailModal, CreateRecipeModal, WeeklyPurchasesPage, WeeklyPurchaseDetailPage.

---

## 28. Backend — Bugs y fixes (sesion 2026-05-06)

### 28.1 UserResponse.created_at requerido pero faltante en /auth/me

**Severidad:** CRITICO

**Antes (`src/schemas/__init__.py:80`):**
```python
class UserResponse(BaseModel):
    created_at: datetime  # requerido, pero JWT no incluye created_at
# Resultado: ValidationError 500 en CADA llamada a /auth/me
```

**Despues:**
```python
created_at: Optional[datetime] = None
```

---

### 28.2 GET /api/inventory/total-value — dead code eliminado

**Antes:**
```
src/api/routes/inventory_total_value.py  ← ~90 lineas
src/valor_total_inventario/ (directorio) ← servicio completo
src/schemas/__init__.py ← InventoryTotalValueResponse
src/main.py ← import + router registrado
```
Funcionalidad (Σ stock × precio) ya vivia dentro de `/inventory/kpis`. Duplicada.

**Despues:** Todo eliminado. 0 impacto en frontend.

---

### 28.3 Modulo cart_items eliminado

**Antes:**
```
src/api/routes/cart_items.py       ← 4 endpoints
src/services/cart_items_service.py ← consultaba "inventories" (no existe) en vez de "inventory"
src/schemas/__init__.py            ← CartItemCreate, CartItemResponse
src/main.py                       ← router registrado
```
El servicio nunca funciono en produccion. Eliminado junto al frontend correspondiente.

---

### 28.4 GET /businesses/{id} sin auth

**Severidad:** ALTO (seguridad)

**Antes:** Endpoint completamente publico, cualquiera podia consultar datos de cualquier negocio.

**Despues:** Requiere auth. SUPERADMIN: ve cualquier negocio. ADMIN: solo su propio business_id. CAJERO/EMPLEADO: 403.

---

### 28.5 GET /users/{id} sin scope

**Severidad:** ALTO (seguridad)

**Antes:** CAJERO/EMPLEADO podia ver datos de cualquier usuario.

**Despues:** Solo self o ADMIN+. CAJERO/EMPLEADO reciben 403 si intentan ver perfil de otro usuario.

---

### 28.6 GET /locals/by-business/{businessId}/available — endpoint faltante

**Severidad:** MEDIO

**Antes:** Backend solo tenia `GET /locals?business_id=` (query param). Frontend llamaba path param → 404 silencioso → dropdown de locales vacio.

**Despues:** Endpoint nuevo en `src/api/routes/locals.py` — alias interno a la misma query con el path que el frontend espera.

---

### 28.7 GET /orders/{id}/summary — endpoint faltante

**Severidad:** MEDIO

**Antes:** No existia. Frontend necesitaba orden + local_info + items en una sola llamada.

**Despues:** Endpoint nuevo en `src/api/routes/orders.py` (antes del `/{order_id}` parametrico para evitar captura de ruta). Retorna:
```json
{
  "id": "...",
  "business_id": "...",
  "local_id": "...",
  "local_info": { "id", "name", "address", "business_id" },
  "items": [ { "products": { "id", "name", "price" }, "quantity", ... } ]
}
```

---

### 28.8 PATCH /orders/{id}/local — endpoint faltante

**Severidad:** MEDIO

**Antes:** `PATCH /orders/{id}` solo aceptaba `status` y `payment_method`.

**Despues:** Endpoint nuevo (antes del PATCH generico):
```python
@router.patch("/orders/{order_id}/local")
# Body: { local_id: UUID }
# Valida que el local destino existe antes de actualizar
# Retorna orden actualizada
```

---

### 28.9 Secret hardcodeado en sync-metadata

**Severidad:** ALTO (seguridad)

**Antes (`src/api/routes/auth.py:35`):**
```python
if sync_key != "sync-metadata-key-change-this":  # visible en repo, nunca rotado
```

**Despues:**
```python
# src/core/config.py
sync_metadata_key: str = "sync-metadata-key-change-this"  # lee de SYNC_METADATA_KEY env var

# src/api/routes/auth.py
if sync_key != settings.sync_metadata_key:
```

**Accion pendiente en produccion:** Setear `SYNC_METADATA_KEY=<valor-seguro>` en .env.

---

### 28.10 MesaCreate con campo numero — PGRST204

**Antes (`src/schemas/__init__.py`):**
```python
class MesaCreate(BaseModel):
    local_id: UUID
    name: str
    capacidad: int
    zona: str
    numero: Optional[int] = None  # columna no existe en DB → PGRST204 al insertar
```

**Despues:**
```python
class MesaCreate(BaseModel):
    local_id: UUID
    name: str
    capacidad: int
    zona: str
    # numero eliminado
    state: Optional[str] = Field("libre")
    is_delivery: bool = False
    is_active: bool = True
# MesaResponse mantiene numero: Optional[int] = None — SELECT * no rompe si columna no existe
```

---

### 28.11 total_estimated_clp faltante en weekly_purchase_orders

**Error:** Al aprobar ordenes de compra semanales, PostgREST retornaba error de columna faltante.

**Migracion aplicada (`migrations/add_total_estimated_clp.sql`):**
```sql
ALTER TABLE public.weekly_purchase_orders
  ADD COLUMN IF NOT EXISTS total_estimated_clp integer NOT NULL DEFAULT 0;
```
Aplicada 2026-05-06 via `npx supabase db query --linked`.

---

## 29. Frontend — Hardcoded values (sesion 2026-05-06)

### HC-F1 — Roles duplicados sin source of truth ⚠️ PENDIENTE HU

```js
// src/App.jsx:20
const WORKER_ROLES = ['Empleado', 'Cajero']

// src/components/pos/POSModule.jsx:16
const WORKER_ROLES = ['Empleado', 'Cajero']  // duplicado exacto

// Dispersos sin fuente unica:
n === 'superadmin'
n === 'superadmin' || n === 'admin'
```

Fix propuesto para HU siguiente:
```js
// src/constants/roles.js (archivo nuevo)
export const WORKER_ROLES = ['Empleado', 'Cajero']
export const ADMIN_ROLES = ['admin', 'Admin']
export const SUPERADMIN_ROLE = 'superadmin'
```

### HC-F2 — Currency 'CLP' hardcodeada ✓ ACEPTABLE

Tres archivos: AdministrativeModule.jsx, IncomeChart.jsx, ExpenseBreakdown.jsx. Sistema opera exclusivamente en Chile. La inconsistencia activa (InventoryKpiDashboard.jsx usaba 'BOB') fue resuelta al eliminar ese componente.

### HC-F3 — Umbrales de stock critico/bajo ⏳ DIFERIDO HU pendiente

`src/components/inventory/stockAlertUtils.js:7-8`:
```js
const REF_CRIT_PCT = 0.25  // stock critico si stock_actual < 25% del maximo
const REF_LOW_PCT  = 0.5   // stock bajo si stock_actual < 50% del maximo
```
Requiere HU nueva: tabla business_settings en Supabase + endpoints GET/PATCH /settings con RBAC + panel frontend.

### HC-F4 — pageSize duplicado ✗ FALSO POSITIVO

`StockControlDashboard` pasa `pageSize={10}` como prop. El `pageSize = 10` en `ProductsTable` es el default del prop. Sin riesgo de desincronizacion.

### HC-F5 — Constantes de UI ✓ ACEPTABLE

Timeouts (2000ms, 2200ms, 600ms), debounces (300ms-350ms), POLL_INTERVAL_MS=30000 (ya overrideable con VITE_KPI_POLL_INTERVAL_MS), TTL_MS=5min, zIndex/layout internos. No requieren accion.

### HC-F6 — Colores en JS/JSX ✓ ACEPTABLE

Recharts no soporta CSS custom properties — hex en JS es requerido para charts. Inline styles en navegacion pueden moverse a CSS pero no bloquean nada.

---

## 30. Backend — Hardcoded values (sesion 2026-05-06)

### HC-B1 — CORS_ORIGINS ✓ VERIFICADO

Configuracion correcta en produccion. `docker-compose.dev.yml` solo tiene origenes localhost.

### HC-B2 — Valores de negocio ✗ FALSO POSITIVO

| Concepto | Veredicto |
|---|---|
| Stock thresholds 25%/50% | inventory_stock_service.py usa misma logica. Backend calcula stock_status por fila; frontend lo respeta primero |
| KPI aggregation | Proposito distinto — bandas para dashboard, no badge por fila |
| Currency | Backend envia ints CLP sin formatear, frontend hace todo el formatting |
| Roles | Backend normaliza a SUPERADMIN/ADMIN/CAJERO/EMPLEADO, frontend convierte via formatRoleLabel() |

Deuda de diseno documentada: stock_max no tiene columna propia en DB — se parsea del campo description del producto con regex. Si se edita la descripcion manualmente y se rompe el formato, stock_max queda null.

---

## 31. Archivos modificados, creados y eliminados (sesion 2026-05-06)

### Frontend — Archivos modificados

| Archivo | Cambio |
|---|---|
| src/hooks/useOrderItems.js | Reescrito: 3x fetch crudo → apiRequest, token manual eliminado |
| src/components/pos/AddProductModal.jsx | fetch crudo → apiRequest |
| src/components/pos/MesaDetailModal.jsx | Guard if (!mesa) + onKeyDown en inputs |
| src/components/pos/MesaDetail.jsx | Guard null crash |
| src/components/inventory/RegisterSupplierModal.jsx | Error summary global en validate() |
| src/components/inventory/ModernDateField.jsx | Rango de años: 1970 → cur-3 a cur+1 |
| src/components/inventory/recipes/CreateRecipeModal.jsx | Fetch inline + product_id/product_name fix |
| src/components/inventory/weeklyPurchases/WeeklyPurchaseDetailPage.jsx | onKeyDown en 3 inputs numericos |
| src/components/inventory/weeklyPurchases/WeeklyPurchasesPage.jsx | setError('') al cerrar modal |
| src/components/ModulesGrid.jsx | Bloque modules-stats hardcodeado eliminado, prop userRole eliminada |
| src/components/ErrorBoundary.jsx | NUEVO — ErrorBoundary con stack en dev, mensaje generico en prod |
| src/App.jsx | Import ErrorBoundary, 3 bloques de rutas wrapeados, 2 imports dead eliminados, 2 rutas dead eliminadas |
| src/lib/categoryCatalogCache.js | invalidateCategoryCache eliminada |
| src/lib/inventoryApi.js | Token manual eliminado de 18 funciones |
| src/lib/weeklyPurchasesApi.js | Token manual eliminado de 8 funciones |
| src/hooks/useMesasConEstado.js | N+1 → 1 request con ?with_state=true |

### Frontend — Archivos eliminados

```
src/hooks/useCart.js
src/hooks/useAvailableLocals.js
src/hooks/useOrderSummary.js
src/hooks/useOrderSummary.test.js
src/hooks/useAvailableLocals.test.js
src/components/Cart.jsx
src/styles/Cart.css
src/components/ClientDashboard.jsx
src/styles/ClientDashboard.css
src/components/OrderSummary.jsx
src/styles/OrderSummary.css
src/components/OrderSummary.test.jsx
src/components/ChangeLocal.jsx
src/styles/ChangeLocal.css
src/components/ChangeLocal.test.jsx
src/integration.test.js
src/components/LoginPage.jsx
src/components/inventory/InventoryKpiDashboard.jsx
src/styles/InventoryKpiDashboard.css
```

### Backend — Archivos modificados

| Archivo | Cambio |
|---|---|
| src/schemas/__init__.py | UserResponse.created_at → Optional; MesaCreate/MesaUpdate.numero eliminado; CartItemCreate/CartItemResponse eliminadas; InventoryTotalValueResponse eliminada |
| src/api/routes/auth.py | Secret hardcodeado → settings.sync_metadata_key |
| src/api/routes/businesses.py | GET /{id} requiere auth, scoped por rol |
| src/api/routes/users.py | GET /{id} scoped: solo self o ADMIN+ |
| src/api/routes/orders.py | Endpoints nuevos: /summary y /local (antes del parametrico /{id}) |
| src/api/routes/locals.py | Endpoint nuevo: /by-business/{id}/available |
| src/api/routes/suppliers.py | Endpoint nuevo: /{id}/purchase-history (antes de /{id}) |
| src/core/config.py | sync_metadata_key desde env var |
| src/main.py | Routers de inventory_total_value y cart_items eliminados |

### Backend — Archivos eliminados

```
src/api/routes/inventory_total_value.py
src/api/routes/cart_items.py
src/services/cart_items_service.py
src/valor_total_inventario/ (directorio completo)
```

### Backend — Archivos nuevos

```
migrations/add_total_estimated_clp.sql
tests/test_orders.py       (~250 lineas, 30 tests)
tests/test_mesas.py        (~200 lineas, 31 tests)
tests/test_expenses.py     (~200 lineas, 40 tests)
tests/test_transfers.py    (~180 lineas, 27 tests)
```

---

## 32. Tests — Cobertura actualizada (sesion 2026-05-06)

| Modulo | Archivo | Tests | Estado |
|---|---|---|---|
| Supplier validation | test_supplier_validation.py | ~20 | ✅ |
| Supplier service | test_supplier_service.py | ~40 | ✅ |
| Supplier KPIs | test_supplier_kpis_service.py | ~35 | ✅ |
| Purchases service | test_purchases_service.py | ~30 | ✅ |
| Inventory KPIs | test_inventory_kpi_*.py | 400+ | ✅ |
| Inventory stock | test_inventory_stock_*.py | 400+ | ✅ |
| Dashboard | test_dashboard_metrics.py | 339 | ✅ |
| Endpoints (smoke) | test_endpoints.py | 358 | ✅ |
| Supabase connection | test_supabase_connection.py | 303 | ✅ |
| New product | test_new_product_validation.py | 235 | ✅ |
| Orders | test_orders.py | 30 | ✅ NUEVO |
| Mesas | test_mesas.py | 31 | ✅ NUEVO |
| Expenses | test_expenses.py | 40 | ✅ NUEVO |
| Transfers | test_transfers.py | 27 | ✅ NUEVO |

`test_orders.py` cubre: route ordering (/summary y /local antes de /{id}), RBAC por operacion, 404s, campos local_info e items, business_id directo en summary.

Modulos sin tests (pendiente): recipes_service, weekly_purchase_orders_service, Dashboard WebSocket stream, Cart (deferido a HU de carrito).

---

## 33. Seed data — Como usar

### Scripts SQL disponibles

| Script | Que carga |
|---|---|
| seed-test-data.sql (frontend repo) | Ordenes, gastos, transferencias, cajas |
| seed-mesas-test.sql (frontend repo) | Mesas con estado para POS |

### Instrucciones

1. Obtener el UUID del local:
```sql
SELECT id, name FROM locals LIMIT 10;
```

2. Editar el script — reemplazar en seed-test-data.sql linea ~15:
```sql
v_local_id UUID := 'TU-UUID-AQUI'::uuid;
```

3. Ejecutar en Supabase SQL Editor (supabase.com/dashboard → SQL Editor → New Query → Run)

Resultado esperado:
```
Se crearon:
  - 8 ordenes de ventas (total: CLP 186,400)
  - 5 registros de gastos (total: CLP 150,500)
  - 3 transferencias (total: CLP 355,000)
  - 3 cajas registradas
```

### Datos actuales en Supabase (local "testing" — 838d770e)

| Tabla | Registros | Total |
|---|---|---|
| orders | 4 (3 CANCELLED, 1 PENDING) | CLP 62,800 |
| expenses | 5 (3 approved, 2 pending) | CLP 150,500 |
| inventory | 1 producto de prueba | — |

---

## 34. Analisis: datos seed vs hardcodeados en modulo administrativo

**Resultado:** Todo el modulo administrativo usa datos reales de Supabase. Nada hardcodeado.

| Seccion | Fuente | API call |
|---|---|---|
| Ventas | orders table | getOrdersByLocal(localId, token) |
| Rendiciones | expenses + rendiciones + transfers | getExpensesByLocal + getRendicionesDashboard + getTransfersByLocal |
| Flujo de caja | dashboard endpoint + cajas table | getLocalDashboard + getCajasByLocal |
| Alertas | dashboard endpoint | getLocalDashboard |
| Bonos | dashboard endpoint | getLocalDashboard |
| Reportes | consolidado por business | getConsolidatedDashboard |

Los graficos usan:
- generateIncomeTrendFromOrders(payload.orders) → desde ordenes reales de DB
- generateExpenseBreakdownFromData(payload.expenses) → desde gastos reales de DB
- enrichDashboardWithChartData(payload.dashboard) → desde endpoint de dashboard

Nota: en flujo-caja, el breakdown de expenses usa payload.expenses que solo se carga cuando se navega a rendiciones. Si se accede directo a flujo-caja sin pasar por rendiciones, ese grafico aparece vacio. No es hardcodeado — el dato no esta cargado aun. Mejora pendiente: cargar expenses tambien cuando activeSection === 'flujo-caja'.

---

## 35. Deuda tecnica pendiente — proximas HU

### HU pendiente: Carrito

El backend del carrito fue eliminado (modulo nunca funciono). Bugs documentados para cuando se implemente:

1. Backend retorna list[CartItemResponse] (array plano). Frontend debe usar `const serverItems = data || []`, NO `data.items || []`.
2. CartItemCreate no tiene campo business_id — no enviar en body.
3. Diseno offline-first intencional: localStorage como fuente inmediata + sync con servidor en background + isSynced flag — mantener este patron.

Endpoints a recrear:
```
POST /cart/items
GET  /cart/items
DELETE /cart/items/{item_id}
DELETE /cart
```

---

### HU pendiente: Panel de Gestion de Usuarios

Backend CRUD ya completo y listo para consumir:

| Operacion | Endpoint | Estado |
|---|---|---|
| Crear | POST /auth/admin/create-user | ✅ Activo |
| Listar | GET /users?business_id= | ✅ Listo |
| Ver | GET /users/{id} | ✅ Listo |
| Editar | PATCH /users/{id} | ✅ Listo (RBAC correcto) |
| Borrar | DELETE /users/{id} | ✅ Listo (solo SUPERADMIN) |

Solo falta el frontend: pantalla de gestion de trabajadores.

---

### HU pendiente: Configuracion de negocio (stock thresholds)

Requiere:
- Tabla business_settings en Supabase
- Endpoints GET/PATCH /settings con RBAC Admin+
- Panel frontend de configuracion
- Afecta: src/components/inventory/stockAlertUtils.js (umbrales REF_CRIT_PCT/REF_LOW_PCT)

---

### HU pendiente: Modulo Configuracion

Habilitado en ModulesGrid con disabled: true ("En desarrollo"). Incluye gestion de usuarios (ver arriba), configuracion general, parametros del sistema, auditoria.

---

### Deuda tecnica baja prioridad

| Item | Archivo | Descripcion |
|---|---|---|
| require_roles helper | src/api/routes/*.py | Eliminar repeticion `if role not in [...]` en ~60 route functions. Refactoring puro |
| PurchaseCreate.notes sin alias | src/schemas/__init__.py:370 | Unico campo sin alias camelCase. No impacta hoy (frontend no envia notes) |
| stock_max en description | DB/service | Parsear stock_max del campo description con regex es fragil. Requiere columna propia |
| HC-F1 roles duplicados | App.jsx, POSModule.jsx | Crear src/constants/roles.js |
| SYNC_METADATA_KEY en prod | .env produccion | Setear valor seguro — el default actual es el placeholder inseguro |
| Tests de recetas | tests/test_recipes*.py | recipes_service sin tests de calculo de costo/margen |
| Tests de compras semanales | tests/test_weekly_purchases*.py | weekly_purchase_orders_service sin tests |
| Flujo-caja: expenses vacias | AdministrativeModule.jsx | Cargar expenses tambien cuando activeSection === 'flujo-caja' |

---

*Seccion agregada: 2026-05-06 — Sesion de audit completo front + back*
*Stack: React 19 + Vite 8 (frontend) / FastAPI + Supabase (backend)*
*Alcance audit: 48 archivos Python + 20+ hooks/componentes React*