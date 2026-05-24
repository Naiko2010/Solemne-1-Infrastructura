import {
  buildSupplierDetailPath,
  buildSupplierKpisPath,
  buildSupplierPurchaseHistoryPath,
  buildSuppliersWithMetricsPath,
  deleteSupplier,
  getLocalById,
  getSupplierDetailForBusiness,
  getSupplierKpisByLocal,
  getSupplierPurchaseHistoryForBusiness,
  getSuppliersWithMetricsForBusiness,
  patchSupplier,
  postSupplier,
} from './inventoryApi'
import {
  deleteWeeklyPurchaseOrder,
  getWeeklyPurchaseComparisonReport,
  getWeeklyPurchaseOrder,
  getWeeklyPurchaseOrders,
  patchWeeklyPurchaseLineReception,
  patchWeeklyPurchaseOrder,
  postWeeklyPurchaseOrder,
  putWeeklyPurchaseOrderItems,
} from './weeklyPurchasesApi'

/**
 * API pública del módulo Proveedores.
 * Centraliza HU-34, HU-68, HU-69, HU-84, HU-85, HU-86, HU-87 y HU-89.
 */
export {
  buildSupplierDetailPath,
  buildSupplierKpisPath,
  buildSupplierPurchaseHistoryPath,
  buildSuppliersWithMetricsPath,
  deleteSupplier,
  deleteWeeklyPurchaseOrder,
  getLocalById,
  getSupplierDetailForBusiness,
  getSupplierKpisByLocal,
  getSupplierPurchaseHistoryForBusiness,
  getSuppliersWithMetricsForBusiness,
  getWeeklyPurchaseComparisonReport,
  getWeeklyPurchaseOrder,
  getWeeklyPurchaseOrders,
  patchSupplier,
  patchWeeklyPurchaseLineReception,
  patchWeeklyPurchaseOrder,
  postSupplier,
  postWeeklyPurchaseOrder,
  putWeeklyPurchaseOrderItems,
}
