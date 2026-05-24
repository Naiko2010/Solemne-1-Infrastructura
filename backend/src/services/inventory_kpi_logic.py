"""
Lógica pura de bandas de stock para KPIs (sin dependencias de FastAPI/DB).

Por producto se ingresa **una cantidad de referencia X** (en BD: campo `min_stock`).
Los umbrales se derivan solo de X: **¼ X** y **½ X** (y el “tope” de referencia es X).

Usada por `api.routes.inventory_kpi` y el front (`aggregateInventoryKpis`).
"""

from dataclasses import dataclass
from typing import Any, Literal

InventoryBand = Literal["critical", "low", "medium", "ok"]


@dataclass(frozen=True)
class AggregatedInventoryKpis:
    """Resultado del cálculo agregado (mismos números que expone el endpoint)."""

    total_products: int
    critical_stock_count: int
    low_stock_count: int
    medium_stock_count: int
    total_inventory_value: float


def aggregate_inventory_kpi_metrics(
    rows: list[dict[str, Any]],
    prices_by_product_id: dict[str, float],
) -> AggregatedInventoryKpis:
    """
    Agrega conteos por banda y valor total Σ(stock × precio unitario).

    Cada fila de ``rows`` debe incluir al menos: ``product_id``, ``stock``, ``min_stock`` (X),
    como devuelve Supabase en ``inventories``.
    """
    critical = 0
    low = 0
    medium = 0
    total_value = 0.0

    for r in rows:
        stock = int(r.get("stock") or 0)
        x_reference = int(r.get("min_stock") or 0)
        pid = str(r.get("product_id")) if r.get("product_id") else None
        unit_price = prices_by_product_id.get(pid, 0.0) if pid else 0.0
        total_value += stock * unit_price

        band = classify_inventory_band(stock, x_reference)
        if band == "critical":
            critical += 1
        elif band == "low":
            low += 1
        elif band == "medium":
            medium += 1

    return AggregatedInventoryKpis(
        total_products=len(rows),
        critical_stock_count=critical,
        low_stock_count=low,
        medium_stock_count=medium,
        total_inventory_value=round(total_value, 2),
    )


def classify_inventory_band(stock: int, x_reference: int) -> InventoryBand:
    """
    Clasificación por fila (excluyente). `x_reference` = cantidad de referencia X del producto.

    Sin X válido (``x_reference <= 0``): solo **crítico** si ``stock <= 0``, si no **ok**.

    Con ``X > 0`` (umbrales en cantidades enteras comparadas en float):

    - **critical**: ``stock <= 0`` ó ``stock <= X/4``
    - **low**: ``X/4 < stock < X/2``
    - **medium**: ``X/2 <= stock < X``
    - **ok**: ``stock >= X`` (incluye sobre-stock)
    """
    if x_reference <= 0:
        return "critical" if stock <= 0 else "ok"

    if stock <= 0:
        return "critical"

    t_quarter = x_reference / 4.0
    t_half = x_reference / 2.0

    if stock <= t_quarter:
        return "critical"
    if stock < t_half:
        return "low"
    if stock < x_reference:
        return "medium"
    return "ok"
