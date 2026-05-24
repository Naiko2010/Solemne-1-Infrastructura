"""Consistencia: totales KPI = suma explícita por líneas de inventario."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.inventario_kpi.logic import (
    aggregate_inventory_kpi_metrics,
    sum_inventory_value_from_individual_lines,
    validate_inventory_kpi_aggregate,
)


def test_sum_individual_lines_matches_manual_total():
    rows = [
        {"product_id": "a", "stock": 2, "min_stock": 10},
        {"product_id": "b", "stock": 1, "min_stock": 0},
    ]
    prices = {"a": 10.0, "b": 5.0}
    assert sum_inventory_value_from_individual_lines(rows, prices) == 25.0


def test_aggregate_matches_sum_of_individual_lines():
    rows = [
        {"product_id": "p1", "stock": 3, "min_stock": 20},
        {"product_id": "p2", "stock": 1, "min_stock": 0},
    ]
    prices = {"p1": 2.5, "p2": 10.0}
    agg = aggregate_inventory_kpi_metrics(rows, prices)
    expected = sum_inventory_value_from_individual_lines(rows, prices)
    assert agg.total_inventory_value == expected
    assert agg.total_products == len(rows)
    assert validate_inventory_kpi_aggregate(rows, prices, agg) is True


def test_aggregate_consistency_empty_rows():
    agg = aggregate_inventory_kpi_metrics([], {})
    assert agg.total_inventory_value == 0.0
    assert agg.total_products == 0
    assert validate_inventory_kpi_aggregate([], {}, agg) is True


def test_rows_without_product_id_count_but_no_monetary_contribution():
    rows = [
        {"product_id": None, "stock": 5, "min_stock": 0},
        {"product_id": "x", "stock": 2, "min_stock": 0},
    ]
    prices = {"x": 3.0}
    agg = aggregate_inventory_kpi_metrics(rows, prices)
    assert agg.total_products == 2
    assert agg.total_inventory_value == 6.0
    assert validate_inventory_kpi_aggregate(rows, prices, agg) is True
