"""
Lógica pura de KPIs de inventario (sin base de datos ni FastAPI).

X = referencia por fila (campo min_stock en `inventory`).
"""

from dataclasses import dataclass
from typing import Literal

InventoryBand = Literal["critical", "low", "medium", "ok"]


def classify_inventory_band(stock: float, x_reference: float) -> InventoryBand:
    """
    Clasifica una fila de inventario en banda de alerta.

    Umbrales con X > 0: t1 = X/4, t2 = X/2.
    Con X <= 0: solo crítico si stock <= 0; si no, ok para contadores de alerta.
    """
    s = float(stock)
    x = float(x_reference)

    if s <= 0:
        return "critical"

    if x > 0:
        t1 = x / 4.0
        t2 = x / 2.0
        if s <= t1:
            return "critical"
        if t1 < s < t2:
            return "low"
        if t2 <= s < x:
            return "medium"
        return "ok"

    return "ok"


@dataclass
class AggregatedInventoryKpis:
    total_products: int
    critical_stock_count: int
    low_stock_count: int
    medium_stock_count: int
    total_inventory_value: float


def aggregate_inventory_kpi_metrics(
    rows: list[dict],
    prices_by_product_id: dict[str, float],
) -> AggregatedInventoryKpis:
    """Agrega conteos por banda y valor total Σ stock × precio (redondeado a 2 decimales)."""
    critical = low = medium = 0
    total_value = 0.0

    for row in rows:
        stock = float(row.get("stock") or 0)
        x_ref = float(row.get("min_stock") or 0)
        band = classify_inventory_band(stock, x_ref)

        if band == "critical":
            critical += 1
        elif band == "low":
            low += 1
        elif band == "medium":
            medium += 1

        pid = row.get("product_id")
        if pid is not None:
            price = float(prices_by_product_id.get(str(pid), 0) or 0)
            total_value += stock * price

    return AggregatedInventoryKpis(
        total_products=len(rows),
        critical_stock_count=critical,
        low_stock_count=low,
        medium_stock_count=medium,
        total_inventory_value=round(total_value, 2),
    )
