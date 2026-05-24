"""Tests unitarios de lógica pura en `src/inventario_kpi/logic.py` (sin FastAPI ni BD)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.inventario_kpi.logic import aggregate_inventory_kpi_metrics, classify_inventory_band


@pytest.mark.parametrize(
    "stock,x_ref,expected",
    [
        (0, 100, "critical"),
        (10, 100, "critical"),
        (26, 100, "low"),
        (50, 100, "medium"),
        (100, 100, "ok"),
        (0, 0, "critical"),
        (5, 0, "ok"),
    ],
)
def test_classify_inventory_band(stock, x_ref, expected):
    assert classify_inventory_band(stock, x_ref) == expected


def test_aggregate_counts_and_value():
    rows = [
        {"product_id": "a", "stock": 10, "min_stock": 100},
        {"product_id": "b", "stock": 5, "min_stock": 20},
    ]
    prices = {"a": 100.0, "b": 50.0}
    r = aggregate_inventory_kpi_metrics(rows, prices)
    assert r.total_products == 2
    assert r.total_inventory_value == 10 * 100.0 + 5 * 50.0
