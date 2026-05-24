import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...deps import effective_db_for_admin_scope, get_current_user, get_db
from ...schemas import (
    ReceptionPatchBody,
    WeeklyPurchaseOrderCreateBody,
    WeeklyPurchaseOrderItemsPutBody,
    WeeklyPurchaseOrderPatchBody,
)
from ...services.weekly_purchase_orders_service import (
    create_weekly_purchase_order,
    delete_weekly_purchase_order_draft,
    get_comparison_report,
    get_weekly_purchase_order_detail,
    get_weekly_purchase_orders_list,
    patch_line_reception,
    patch_weekly_purchase_order_status,
    replace_weekly_purchase_order_items,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _ensure_admin_business(db, current_user: dict, business_id: UUID):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    db = effective_db_for_admin_scope(current_user, db)
    if current_user.get("role") == "ADMIN":
        uid_business = current_user.get("business_id")
        if not uid_business or str(uid_business) != str(business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="business_id no permitido")
    return db


@router.get(
    "/weekly-purchase-orders/reports/comparison",
    summary="Reporte comparativo por semana y por proveedor",
)
async def weekly_purchase_comparison_report(
    business_id: UUID = Query(..., description="UUID del negocio"),
    week_from: str = Query(..., description="Lunes inicial YYYY-MM-DD"),
    week_to: str = Query(..., description="Lunes final YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    db = _ensure_admin_business(db, current_user, business_id)
    try:
        return get_comparison_report(db, str(business_id), week_from, week_to)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("Reporte compras semanales")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar reporte: {str(e)}",
        )


@router.get("/weekly-purchase-orders", summary="Listar órdenes de compra semanales")
async def list_weekly_purchase_orders(
    business_id: UUID = Query(..., description="UUID del negocio"),
    week_start: str | None = Query(None, description="Filtrar por lunes YYYY-MM-DD"),
    supplier_id: UUID | None = Query(None),
    status: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    db = _ensure_admin_business(db, current_user, business_id)
    try:
        return get_weekly_purchase_orders_list(
            db,
            str(business_id),
            week_start=week_start,
            supplier_id=str(supplier_id) if supplier_id else None,
            status=status,
        )
    except Exception as e:
        logger.exception("Listar compras semanales")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al listar órdenes: {str(e)}",
        )


@router.get("/weekly-purchase-orders/{order_id}", summary="Detalle de orden con líneas")
async def get_weekly_purchase_order(
    order_id: UUID,
    business_id: UUID = Query(..., description="UUID del negocio"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    db = _ensure_admin_business(db, current_user, business_id)
    try:
        row = get_weekly_purchase_order_detail(db, str(order_id), str(business_id))
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
        return row
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Detalle compra semanal")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al leer orden: {str(e)}",
        )


@router.post("/weekly-purchase-orders", summary="Crear orden (borrador)", status_code=status.HTTP_201_CREATED)
async def post_weekly_purchase_order(
    body: WeeklyPurchaseOrderCreateBody,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    db = _ensure_admin_business(db, current_user, body.business_id)
    try:
        return create_weekly_purchase_order(db, str(body.business_id), body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("Crear compra semanal")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear orden: {str(e)}",
        )


@router.patch("/weekly-purchase-orders/{order_id}", summary="Actualizar estado de la orden")
async def patch_weekly_purchase_order(
    order_id: UUID,
    body: WeeklyPurchaseOrderPatchBody,
    business_id: UUID = Query(..., description="UUID del negocio"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    db = _ensure_admin_business(db, current_user, business_id)
    try:
        return patch_weekly_purchase_order_status(db, str(order_id), str(business_id), body.status)
    except ValueError as e:
        msg = str(e)
        code = status.HTTP_404_NOT_FOUND if "no encontrada" in msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=msg)
    except Exception as e:
        logger.exception("PATCH compra semanal")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar orden: {str(e)}",
        )


@router.put("/weekly-purchase-orders/{order_id}/items", summary="Reemplazar líneas (solo borrador)")
async def put_weekly_purchase_order_items(
    order_id: UUID,
    body: WeeklyPurchaseOrderItemsPutBody,
    business_id: UUID = Query(..., description="UUID del negocio"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    db = _ensure_admin_business(db, current_user, business_id)
    try:
        items = [x.model_dump() for x in body.items]
        return replace_weekly_purchase_order_items(db, str(order_id), str(business_id), items)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("PUT items compra semanal")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar líneas: {str(e)}",
        )


@router.patch(
    "/weekly-purchase-orders/{order_id}/items/{item_id}/reception",
    summary="Registrar cantidad recibida en una línea",
)
async def patch_weekly_purchase_reception(
    order_id: UUID,
    item_id: UUID,
    body: ReceptionPatchBody,
    business_id: UUID = Query(..., description="UUID del negocio"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    db = _ensure_admin_business(db, current_user, business_id)
    try:
        return patch_line_reception(
            db,
            str(order_id),
            str(item_id),
            str(business_id),
            body.quantity_received,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("Recepción compra semanal")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al registrar recepción: {str(e)}",
        )


@router.delete("/weekly-purchase-orders/{order_id}", summary="Eliminar borrador")
async def delete_weekly_purchase_order(
    order_id: UUID,
    business_id: UUID = Query(..., description="UUID del negocio"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    db = _ensure_admin_business(db, current_user, business_id)
    try:
        delete_weekly_purchase_order_draft(db, str(order_id), str(business_id))
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("Eliminar compra semanal")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar: {str(e)}",
        )
