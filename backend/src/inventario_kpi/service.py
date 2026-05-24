"""
Servicio de KPIs de inventario: lectura Supabase + composición de respuesta API.

Una sola lectura de `inventory` + `products` y `aggregate_inventory_kpi_metrics` aporta
`total_value` (HU-49) y `total_inventory_value` (Σ stock × precio), más los conteos por banda.
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status

from ..services.supabase_client import get_supabase_client
from .logic import aggregate_inventory_kpi_metrics


async def build_inventory_kpi_aggregate(local_id: UUID) -> dict:
    """
    Construye el cuerpo de GET /api/inventory/kpis/{local_id}.

    Raises:
        HTTPException 404 si el local no existe.
        HTTPException 500 si falla lectura de inventarios/productos.
    """
    db = get_supabase_client()
    local_id_str = str(local_id)
    now = datetime.now(timezone.utc)

    local_response = db.table("locals").select("id").eq("id", local_id_str).limit(1).execute()
    if not local_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local not found")

    try:
        inv = (
            db.table("inventory")
            .select("product_id, stock, min_stock")
            .eq("local_id", local_id_str)
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al leer inventarios: {str(e)}",
        )

    rows = inv.data or []

    if not rows:
        return {
            "local_id": local_id,
            "total_value": 0.0,
            "total_products": 0,
            "critical_stock_count": 0,
            "low_stock_count": 0,
            "medium_stock_count": 0,
            "total_inventory_value": 0.0,
            "generated_at": now,
            "metrics": [],
        }

    product_ids = list({str(r.get("product_id")) for r in rows if r.get("product_id")})
    prices: dict[str, float] = {}
    if product_ids:
        try:
            pr = db.table("products").select("id, price").in_("id", product_ids).execute()
            for p in pr.data or []:
                pid = str(p.get("id"))
                prices[pid] = float(p.get("price") or 0)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al leer productos: {str(e)}",
            )

    agg = aggregate_inventory_kpi_metrics(rows, prices)
    total_val = float(agg.total_inventory_value)

    return {
        "local_id": local_id,
        "total_value": total_val,
        "total_products": agg.total_products,
        "critical_stock_count": agg.critical_stock_count,
        "low_stock_count": agg.low_stock_count,
        "medium_stock_count": agg.medium_stock_count,
        "total_inventory_value": agg.total_inventory_value,
        "generated_at": now,
        "metrics": [],
    }
