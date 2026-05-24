import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from ...deps import effective_db_for_admin_scope, get_current_user, get_db
from ...inventario_kpi.service import build_inventory_kpi_aggregate
from ...schemas import InventoryKpiAggregateResponse
from ...services.supplier_service import get_business_id_for_local

log = logging.getLogger(__name__)
router = APIRouter()


def _ensure_local_access(db, current_user: dict, local_id: UUID) -> tuple[str, object]:
    """Resolve local's business_id and check user access (SUPERADMIN or matching ADMIN)."""
    db = effective_db_for_admin_scope(current_user, db)
    try:
        business_id = get_business_id_for_local(db, str(local_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local not found")

    if current_user.get("role") == "ADMIN":
        user_business_id = current_user.get("business_id")
        if not user_business_id or str(user_business_id) != str(business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Local not in your business")

    return str(business_id), db


@router.get("/inventory/kpis/aggregate/{local_id}", response_model=InventoryKpiAggregateResponse)
@router.get("/inventory/kpis/{local_id}", response_model=InventoryKpiAggregateResponse)
async def get_inventory_kpi_aggregate(
    local_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """KPIs de inventario por local con control de acceso por negocio."""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can access inventory KPIs")
    _ensure_local_access(db, current_user, local_id)
    try:
        payload = await build_inventory_kpi_aggregate(local_id)
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Error building inventory KPI aggregate for local %s", local_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al calcular KPIs: {e}")
    return payload
