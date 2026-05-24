from fastapi import APIRouter

from . import purchases, suppliers, weekly_purchase_orders

router = APIRouter()

# Módulo Proveedores: centraliza rutas de catálogo, compras semanales y compras directas.
router.include_router(suppliers.router)
router.include_router(weekly_purchase_orders.router)
router.include_router(purchases.router)
