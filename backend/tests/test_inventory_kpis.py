"""KPIs de inventario (SCRUM-366 / 370 / 451): conteos por nivel y valor total."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services.inventory_stock_service import aggregate_inventory_kpis_from_items


def test_aggregate_empty():
    r = aggregate_inventory_kpis_from_items([])
    assert r == {
        "total_products": 0,
        "optimal_stock_count": 0,
        "low_stock_count": 0,
        "critical_stock_count": 0,
        "total_value": 0,
    }


def test_aggregate_counts_and_total_value():
    """Crítico / bajo / óptimo según ratio stock/máx; total_value suma filas."""
    items = [
        {
            "stock_current": 0,
            "stock_max": 100,
            "unit_cost_clp": 10,
            "total_value": 0,
        },
        {
            "stock_current": 30,
            "stock_max": 100,
            "unit_cost_clp": 5,
            "total_value": 150,
        },
        {
            "stock_current": 80,
            "stock_max": 100,
            "unit_cost_clp": 2,
            "total_value": 160,
        },
    ]
    r = aggregate_inventory_kpis_from_items(items)
    assert r["total_products"] == 3
    assert r["critical_stock_count"] == 1
    assert r["low_stock_count"] == 1
    assert r["optimal_stock_count"] == 1
    assert r["total_value"] == 0 + 150 + 160


def test_aggregate_uses_computed_total_when_missing():
    """Si total_value viene vacío, se usa stock × costo; ratio >50% del máximo → óptimo."""
    items = [
        {"stock_current": 60, "stock_max": 100, "unit_cost_clp": 3, "total_value": None},
    ]
    r = aggregate_inventory_kpis_from_items(items)
    assert r["total_value"] == 180
    assert r["optimal_stock_count"] == 1
