import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from postgrest.exceptions import APIError as _PostgRESTAPIError

from ...deps import effective_db_for_admin_scope, get_current_user, get_db
from ...services.supabase_client import get_supabase_client, is_service_role_configured
from ...schemas import (
    SupplierCreate,
    SupplierDetailResponse,
    SupplierKpisResponse,
    SupplierPatchBody,
    SupplierResponse,
)
from ...services.supplier_kpis_service import get_chile_now, get_supplier_kpis_for_business
from ...services.supplier_service import (
    SupplierNotFoundError,
    get_supplier_detail_for_business,
    create_supplier,
    get_business_id_for_local,
    list_suppliers_with_purchase_metrics_for_business,
    patch_supplier_for_business,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# 42703 = PostgreSQL undefined_column; PGRST204 = PostgREST schema-cache column miss
_SCHEMA_MISSING_CODES = frozenset({"42703", "PGRST204"})


def _is_suppliers_extended_schema_missing(exc: Exception) -> bool:
    return isinstance(exc, _PostgRESTAPIError) and str(exc.code) in _SCHEMA_MISSING_CODES


@router.get(
    "/suppliers/kpis",
    response_model=SupplierKpisResponse,
    summary="KPIs de proveedores y compras (insumos aprobados) por mes calendario",
)
async def get_supplier_kpis(
    business_id: UUID | None = Query(None, description="UUID del negocio (alternativa a local_id)"),
    local_id: UUID | None = Query(None, description="UUID del local; se usa su business_id"),
    year: int | None = Query(None, ge=2000, le=2100, description="Año (por defecto mes actual hora de Chile)"),
    month: int | None = Query(None, ge=1, le=12, description="Mes 1-12 (por defecto mes actual hora de Chile)"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    db = effective_db_for_admin_scope(current_user, db)
    if (local_id is None and business_id is None) or (local_id is not None and business_id is not None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Indique exactamente uno: local_id o business_id",
        )

    resolved_business: str | None = None
    if local_id is not None:
        try:
            resolved_business = get_business_id_for_local(db, str(local_id))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local no encontrado")
        except Exception as e:
            logger.exception("KPIs proveedores: fallo al resolver business_id del local")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"No se pudo consultar el local en la base de datos: {str(e)}",
            )
        if current_user.get("role") == "ADMIN":
            uid_business = current_user.get("business_id")
            if not uid_business or str(uid_business) != str(resolved_business):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Local no permitido")
    else:
        resolved_business = str(business_id)
        if current_user.get("role") == "ADMIN":
            uid_business = current_user.get("business_id")
            if not uid_business or str(uid_business) != resolved_business:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="business_id no permitido")

    now = get_chile_now()
    y = year if year is not None else now.year
    m = month if month is not None else now.month

    try:
        return get_supplier_kpis_for_business(db, resolved_business, y, m)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al calcular KPIs: {str(e)}",
        )


@router.get("/suppliers", response_model=list[SupplierResponse], summary="Listar proveedores del negocio")
async def list_suppliers(
    business_id: UUID = Query(..., description="UUID del negocio"),
    search: str | None = Query(
        None,
        description="Filtro por nombre del proveedor (coincidencia parcial, sin distinguir mayúsculas)",
    ),
    category: str | None = Query(
        None,
        description="Filtro por categoría del proveedor (coincidencia parcial; combinable con search)",
    ),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    db = effective_db_for_admin_scope(current_user, db)
    uid_business = current_user.get("business_id")
    if current_user.get("role") == "ADMIN":
        if not uid_business or str(uid_business) != str(business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="business_id no permitido")
    try:
        return list_suppliers_with_purchase_metrics_for_business(
            db,
            str(business_id),
            active_only=False,
            search=search,
            category=category,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al listar proveedores: {str(e)}",
        )


@router.post(
    "/suppliers",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear proveedor para un negocio",
)
async def post_supplier(
    body: SupplierCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    db = effective_db_for_admin_scope(current_user, db)

    target_business = body.business_id
    if target_business is None:
        target_business = current_user.get("business_id")
    if not target_business:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere business_id o usuario con negocio asociado",
        )
    if current_user.get("role") == "ADMIN":
        uid_business = current_user.get("business_id")
        if not uid_business or str(uid_business) != str(target_business):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="business_id no permitido")

    try:
        row = create_supplier(db, str(target_business), body)
        return row
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error creating supplier for business %s", target_business)
        if _is_suppliers_extended_schema_missing(e):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Registro extendido de proveedores no inicializado en BD. Ejecuta migrations/hu86_suppliers_registration.sql en Supabase.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al crear proveedor",
        )


@router.get(
    "/suppliers/{supplier_id}/purchase-history",
    summary="Historial de compras por producto para un proveedor (HU-84)",
)
async def get_supplier_purchase_history(
    supplier_id: UUID,
    business_id: UUID = Query(..., description="UUID del negocio"),
    week_from: str | None = Query(None, description="Lunes YYYY-MM-DD (inicio del rango, inclusivo)"),
    week_to: str | None = Query(None, description="Lunes YYYY-MM-DD (fin del rango, inclusivo)"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    db = effective_db_for_admin_scope(current_user, db)
    if current_user.get("role") == "ADMIN":
        uid_business = current_user.get("business_id")
        if not uid_business or str(uid_business) != str(business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="business_id no permitido")

    try:
        q = (
            db.table("weekly_purchase_orders")
            .select("id")
            .eq("business_id", str(business_id))
            .eq("supplier_id", str(supplier_id))
        )
        if week_from:
            q = q.gte("week_start_date", str(week_from)[:10])
        if week_to:
            q = q.lte("week_start_date", str(week_to)[:10])
        orders_r = q.execute()
        order_ids = [o["id"] for o in (orders_r.data or []) if o.get("id")]

        if not order_ids:
            return {"products": []}

        items_r = (
            db.table("weekly_purchase_order_items")
            .select("product_id,product_name_snapshot,quantity_received,unit_price_clp")
            .in_("order_id", order_ids)
            .execute()
        )

        agg: dict[str, dict] = {}
        for it in items_r.data or []:
            pid = str(it.get("product_id") or "")
            if not pid:
                continue
            qty = float(it.get("quantity_received") or 0)
            price = int(it.get("unit_price_clp") or 0)
            if pid not in agg:
                agg[pid] = {
                    "product_id": pid,
                    "product_name": it.get("product_name_snapshot") or pid,
                    "total_quantity_received": 0.0,
                    "total_amount_received_clp": 0,
                }
            agg[pid]["total_quantity_received"] += qty
            agg[pid]["total_amount_received_clp"] += int(round(qty * price))

        return {"products": list(agg.values())}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener historial de compras: {str(e)}",
        )


@router.get(
    "/suppliers/{supplier_id}",
    response_model=SupplierDetailResponse,
    summary="Detalle de proveedor por negocio",
)
async def get_supplier_detail(
    supplier_id: UUID,
    business_id: UUID = Query(..., description="UUID del negocio"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    db = effective_db_for_admin_scope(current_user, db)
    if current_user.get("role") == "ADMIN":
        uid_business = current_user.get("business_id")
        if not uid_business or str(uid_business) != str(business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="business_id no permitido")
    try:
        return get_supplier_detail_for_business(db, str(supplier_id), str(business_id))
    except SupplierNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener detalle de proveedor: {str(e)}",
        )


@router.patch(
    "/suppliers/{supplier_id}",
    response_model=SupplierResponse,
    summary="Actualizar condiciones comerciales del proveedor",
)
async def patch_supplier(
    supplier_id: UUID,
    body: SupplierPatchBody,
    business_id: UUID = Query(..., description="UUID del negocio"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    db = effective_db_for_admin_scope(current_user, db)
    if current_user.get("role") == "ADMIN":
        uid_business = current_user.get("business_id")
        if not uid_business or str(uid_business) != str(business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="business_id no permitido")
    try:
        return patch_supplier_for_business(db, str(supplier_id), str(business_id), body.model_dump(exclude_unset=True))
    except SupplierNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar proveedor: {str(e)}",
        )


@router.delete(
    "/suppliers/{supplier_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar proveedor del negocio",
)
async def delete_supplier(
    supplier_id: UUID,
    business_id: UUID = Query(..., description="UUID del negocio"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    db = effective_db_for_admin_scope(current_user, db)
    if current_user.get("role") == "ADMIN":
        uid_business = current_user.get("business_id")
        if not uid_business or str(uid_business) != str(business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="business_id no permitido")

    del_db = get_supabase_client() if is_service_role_configured() else db
    _CHUNK = 100
    try:
        supplier_resp = del_db.table("suppliers").select("id,business_id").eq("id", str(supplier_id)).execute()
        if not supplier_resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado")
        if str(supplier_resp.data[0].get("business_id")) != str(business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Proveedor no pertenece al negocio")

        # Collect product IDs linked to this supplier
        products_resp = del_db.table("products").select("id").eq("supplier_id", str(supplier_id)).execute()
        product_ids = [str(p["id"]) for p in (products_resp.data or []) if p.get("id")]

        # Delete inventory rows for those products
        if product_ids:
            try:
                for i in range(0, len(product_ids), _CHUNK):
                    chunk = product_ids[i : i + _CHUNK]
                    del_db.table("inventory").delete().in_("product_id", chunk).execute()
            except Exception as e:
                logger.warning("delete_supplier: error eliminando inventory de productos: %s", e)

        # Delete the products themselves
        if product_ids:
            try:
                for i in range(0, len(product_ids), _CHUNK):
                    chunk = product_ids[i : i + _CHUNK]
                    del_db.table("products").delete().in_("id", chunk).execute()
            except Exception as e:
                logger.warning("delete_supplier: error eliminando productos: %s", e)

        del_db.table("suppliers").delete().eq("id", str(supplier_id)).eq("business_id", str(business_id)).execute()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al eliminar proveedor: {str(e)}")
