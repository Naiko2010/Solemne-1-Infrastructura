"""
Tests de agregación de KPIs de inventario (subtarea: validar Σ líneas y conteos por banda).

Cubre:
- agregación monetaria multi-fila vs suma manual de líneas;
- coherencia de conteos (crítico / bajo / medio) con el total de filas;
- redondeo y filas sin precio;
- invariantes tras `aggregate_inventory_kpi_metrics`.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.inventario_kpi.logic import (
    aggregate_inventory_kpi_metrics,
    sum_inventory_value_from_individual_lines,
)


def _manual_aggregate_value(rows: list[dict], prices: dict[str, float]) -> float:
    """Referencia explícita para el test: misma fórmula que la implementación."""
    s = 0.0
    for r in rows:
        pid = r.get("product_id")
        if pid is None:
            continue
        st = float(r.get("stock") or 0)
        pr = float(prices.get(str(pid), 0) or 0)
        s += st * pr
    return round(s, 2)


class TestAggregationMonetaryTotal:
    """Agregación del valor total = suma de contribuciones por línea (stock × precio)."""

    def test_multi_row_aggregation_matches_explicit_sum(self):
        rows = [
            {"product_id": "a", "stock": 4, "min_stock": 0},
            {"product_id": "b", "stock": 2, "min_stock": 0},
            {"product_id": "c", "stock": 1, "min_stock": 0},
        ]
        prices = {"a": 12.5, "b": 10.0, "c": 0.5}
        agg = aggregate_inventory_kpi_metrics(rows, prices)
        expected = _manual_aggregate_value(rows, prices)
        assert agg.total_inventory_value == expected
        assert agg.total_inventory_value == 4 * 12.5 + 2 * 10.0 + 1 * 0.5

    def test_aggregation_with_string_ids_and_numeric_prices(self):
        rows = [
            {"product_id": "550e8400-e29b-41d4-a716-446655440000", "stock": 3, "min_stock": 0},
        ]
        pid = "550e8400-e29b-41d4-a716-446655440000"
        prices = {pid: 7.33}
        agg = aggregate_inventory_kpi_metrics(rows, prices)
        assert agg.total_inventory_value == round(3 * 7.33, 2)

    def test_missing_product_price_counts_as_zero_contribution(self):
        rows = [
            {"product_id": "x", "stock": 100, "min_stock": 0},
        ]
        prices: dict[str, float] = {}
        agg = aggregate_inventory_kpi_metrics(rows, prices)
        assert agg.total_inventory_value == 0.0
        assert sum_inventory_value_from_individual_lines(rows, prices) == 0.0

    def test_empty_inventory_aggregation_is_zero(self):
        agg = aggregate_inventory_kpi_metrics([], {})
        assert agg.total_products == 0
        assert agg.total_inventory_value == 0.0
        assert agg.critical_stock_count == 0
        assert agg.low_stock_count == 0
        assert agg.medium_stock_count == 0


class TestAggregationBandCounts:
    """Los conteos agregados por banda son coherentes con el número de filas."""

    def test_band_counts_and_ok_rows(self):
        """critical + low + medium + (filas en banda ok) = total_products."""
        rows = [
            {"product_id": "p1", "stock": 0, "min_stock": 5},
            {"product_id": "p2", "stock": 100, "min_stock": 0},
        ]
        prices = {"p1": 1.0, "p2": 2.0}
        agg = aggregate_inventory_kpi_metrics(rows, prices)
        assert agg.total_products == 2
        ok_implicit = agg.total_products - (
            agg.critical_stock_count + agg.low_stock_count + agg.medium_stock_count
        )
        assert ok_implicit >= 0

    def test_all_critical_when_zero_stock(self):
        rows = [
            {"product_id": "a", "stock": 0, "min_stock": 10},
            {"product_id": "b", "stock": 0, "min_stock": 1},
        ]
        prices = {"a": 1.0, "b": 1.0}
        agg = aggregate_inventory_kpi_metrics(rows, prices)
        assert agg.critical_stock_count == 2
        assert agg.low_stock_count == 0
        assert agg.medium_stock_count == 0


class TestAggregationInvariants:
    """Invariantes después de cada agregación."""

    def test_sum_lines_equals_aggregate_total_inventory_value(self):
        rows = [
            {"product_id": "u", "stock": 11, "min_stock": 40},
            {"product_id": "v", "stock": 3, "min_stock": 2},
        ]
        prices = {"u": 2.0, "v": 15.0}
        agg = aggregate_inventory_kpi_metrics(rows, prices)
        line_sum = sum_inventory_value_from_individual_lines(rows, prices)
        assert agg.total_inventory_value == line_sum

    @pytest.mark.parametrize(
        "stocks,prices,expected_total",
        [
            ([(10, "p", 0)], {"p": 5.0}, 50.0),
            ([(2, "a", 0), (3, "b", 0)], {"a": 1.0, "b": 2.0}, 8.0),
        ],
    )
    def test_parametrized_aggregation_totals(self, stocks, prices, expected_total):
        rows = [
            {"product_id": pid, "stock": stock, "min_stock": ms}
            for stock, pid, ms in stocks
        ]
        agg = aggregate_inventory_kpi_metrics(rows, prices)
        assert agg.total_inventory_value == expected_total
