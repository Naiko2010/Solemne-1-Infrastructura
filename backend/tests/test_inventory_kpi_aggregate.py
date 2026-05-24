"""Tests unitarios del cálculo agregado de KPIs (conteos + valor total)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services.inventory_kpi_logic import aggregate_inventory_kpi_metrics


def test_aggregate_empty_rows():
    r = aggregate_inventory_kpi_metrics([], {})
    assert r.total_products == 0
    assert r.critical_stock_count == 0
    assert r.low_stock_count == 0
    assert r.medium_stock_count == 0
    assert r.total_inventory_value == 0.0


def test_aggregate_total_inventory_value_only():
    """Valor total = suma stock × precio; bandas según X."""
    rows = [
        {"product_id": "a", "stock": 10, "min_stock": 100},
        {"product_id": "b", "stock": 5, "min_stock": 20},
    ]
    prices = {"a": 100.0, "b": 50.0}
    r = aggregate_inventory_kpi_metrics(rows, prices)
    assert r.total_products == 2
    assert r.total_inventory_value == 10 * 100.0 + 5 * 50.0
    assert r.total_inventory_value == 1250.0


def test_aggregate_missing_price_treats_as_zero_value_but_still_counts_bands():
    rows = [{"product_id": "p1", "stock": 0, "min_stock": 10}]
    r = aggregate_inventory_kpi_metrics(rows, {})
    assert r.critical_stock_count == 1
    assert r.total_inventory_value == 0.0


def test_aggregate_rounding_two_decimals():
    rows = [{"product_id": "x", "stock": 3, "min_stock": 100}]
    prices = {"x": 10.333}
    r = aggregate_inventory_kpi_metrics(rows, prices)
    assert r.total_inventory_value == round(3 * 10.333, 2)


def test_aggregate_known_scenario_matches_manual_counts():
    """
    Tres filas con precios; conteos verificados contra classify manual.
    p1: stock 0, X=10 -> critical, value 0
    p2: stock 30, X=100 -> low (25<30<50), value 30*2=60
    p3: stock 60, X=100 -> medium, value 60*1=60
    """
    rows = [
        {"product_id": "p1", "stock": 0, "min_stock": 10},
        {"product_id": "p2", "stock": 30, "min_stock": 100},
        {"product_id": "p3", "stock": 60, "min_stock": 100},
    ]
    prices = {"p1": 5.0, "p2": 2.0, "p3": 1.0}
    r = aggregate_inventory_kpi_metrics(rows, prices)
    assert r.total_products == 3
    assert r.critical_stock_count == 1
    assert r.low_stock_count == 1
    assert r.medium_stock_count == 1
    assert r.total_inventory_value == 0 + 60 + 60


def test_aggregate_product_id_none_still_classifies_stock():
    rows = [{"product_id": None, "stock": 0, "min_stock": 5}]
    r = aggregate_inventory_kpi_metrics(rows, {})
    assert r.critical_stock_count == 1
    assert r.total_inventory_value == 0.0
