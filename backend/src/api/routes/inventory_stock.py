from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from ...deps import effective_db_for_admin_scope, get_current_user, get_db
from ...services.supabase_client import get_supabase_client, is_service_role_configured
from ...schemas import (
    InventoryKpisResponse,
    InventoryProductUnitCostUpdate,
    InventoryProductsPageResponse,
    InventoryStockListItemResponse,
    InventoryUpdate,
    SupplierResponse,
)
from ...services.inventory_stock_service import (
    get_inventory_kpis_for_local,
    get_inventory_stock_list_for_local_filtered,
    slice_inventory_page,
    update_inventory_stock_for_local,
    update_product_unit_cost_for_local,
)
from ...services.supplier_service import get_business_id_for_local, list_suppliers_for_business

router = APIRouter()


def _ensure_admin_local_access(db, current_user: dict, local_id: UUID) -> tuple[str, object]:
    """
    Resuelve business_id del local y devuelve el cliente Supabase a usar (service role si SUPERADMIN).
    """
    db = effective_db_for_admin_scope(current_user, db)
    try:
        business_id = get_business_id_for_local(db, str(local_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local not found")
    if current_user.get("role") == "ADMIN":
        uid_business = current_user.get("business_id")
        if not uid_business or str(uid_business) != str(business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Local not in your business")
    return str(business_id), db


def _filtered_stock_rows(
    db,
    local_id: UUID,
    *,
    search: str | None,
    category: str | None,
    status_filters: list[str] | None,
):
    return get_inventory_stock_list_for_local_filtered(
        db,
        local_id,
        search=search,
        category_id=category,
        status_filters=status_filters,
    )


@router.get(
    "/inventory/locals/{local_id}/suppliers",
    response_model=list[SupplierResponse],
    summary="Listar proveedores activos del negocio del local",
)
async def list_suppliers_for_inventory_local(
    local_id: UUID,
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can access inventory suppliers")
    business_id, db = _ensure_admin_local_access(db, current_user, local_id)
    try:
        return list_suppliers_for_business(db, business_id, search=search, category=category)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get(
    "/inventory/kpis/{local_id}",
    response_model=InventoryKpisResponse,
    summary="KPIs de inventario para Control de stock",
)
async def get_inventory_kpis(
    local_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can access inventory KPIs")
    _, db = _ensure_admin_local_access(db, current_user, local_id)
    try:
        return get_inventory_kpis_for_local(db, local_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")


@router.get(
    "/inventory/locals/{local_id}/stock",
    response_model=list[InventoryStockListItemResponse],
    summary="Listar inventario (filtros + paginación opcional; cabecera X-Total-Count)",
)
async def list_inventory_stock(
    response: Response,
    local_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    search: str | None = Query(None, description="Texto parcial en nombre de producto (case-insensitive)"),
    category: str | None = Query(None, description="UUID de categoría"),
    status_filter: Annotated[list[str], Query(alias="status", description="Estado(s): CRITICO, BAJO, OPTIMO (repetir param)")] = [],
    limit: int | None = Query(None, ge=1, le=500, description="Si se envía, pagina el resultado"),
    offset: int = Query(0, ge=0, description="Solo aplica junto con limit"),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can access inventory stock list")
    _, db = _ensure_admin_local_access(db, current_user, local_id)
    try:
        status_filters = [s for s in status_filter if s and str(s).strip()] or None
        rows = _filtered_stock_rows(db, local_id, search=search, category=category, status_filters=status_filters)
        total = len(rows)
        response.headers["X-Total-Count"] = str(total)
        if limit is not None:
            rows, _ = slice_inventory_page(rows, limit=limit, offset=offset)
        return rows
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")


@router.get(
    "/inventory/locals/{local_id}/products",
    response_model=InventoryProductsPageResponse,
    summary="Listado paginado de productos del inventario (equivalente a /stock con total en cuerpo)",
)
async def list_inventory_products(
    local_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    search: str | None = Query(None),
    category: str | None = Query(None),
    status_filter: Annotated[list[str], Query(alias="status")] = [],
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can access inventory products")
    _, db = _ensure_admin_local_access(db, current_user, local_id)
    try:
        status_filters = [s for s in status_filter if s and str(s).strip()] or None
        rows = _filtered_stock_rows(db, local_id, search=search, category=category, status_filters=status_filters)
        page, total = slice_inventory_page(rows, limit=limit, offset=offset)
        return InventoryProductsPageResponse(items=page, total=total, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")


@router.patch(
    "/inventory/locals/{local_id}/stock/{inventory_id}",
    response_model=InventoryStockListItemResponse,
    summary="Actualizar stock o mínimo; respuesta con total_value recalculado",
)
async def patch_inventory_stock(
    local_id: UUID,
    inventory_id: UUID,
    body: InventoryUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can update inventory stock")

    _, db = _ensure_admin_local_access(db, current_user, local_id)

    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    try:
        line = update_inventory_stock_for_local(
            db,
            local_id,
            inventory_id,
            stock=data.get("stock"),
            min_stock=data.get("min_stock"),
            max_stock=data.get("max_stock"),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )

    if not line:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory row not found for this local")
    return line


@router.patch(
    "/inventory/locals/{local_id}/products/{product_id}/unit-cost",
    response_model=InventoryStockListItemResponse,
    summary="Actualizar costo unitario del producto (recalcula total_value = stock × costo)",
)
async def patch_inventory_product_unit_cost(
    local_id: UUID,
    product_id: UUID,
    body: InventoryProductUnitCostUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can update product cost")

    _, db = _ensure_admin_local_access(db, current_user, local_id)

    try:
        line = update_product_unit_cost_for_local(
            db,
            local_id,
            product_id,
            unit_cost_clp=body.unit_cost_clp,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )

    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto sin inventario en este local",
        )
    return line


@router.delete(
    "/inventory/locals/{local_id}/stock/{inventory_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar producto del inventario del local",
)
async def delete_inventory_item(
    local_id: UUID,
    inventory_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can delete inventory items")

    _, db = _ensure_admin_local_access(db, current_user, local_id)
    del_db = get_supabase_client() if is_service_role_configured() else db

    try:
        inv_resp = (
            del_db.table("inventory")
            .select("id,product_id")
            .eq("id", str(inventory_id))
            .eq("local_id", str(local_id))
            .execute()
        )
        if not inv_resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory row not found for this local")

        product_id = str(inv_resp.data[0].get("product_id") or "")

        del_db.table("inventory").delete().eq("id", str(inventory_id)).eq("local_id", str(local_id)).execute()

        if product_id:
            try:
                del_db.table("products").delete().eq("id", product_id).execute()
            except Exception:
                pass
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")
