"""Clasificación KPI según cantidad de referencia X (campo min_stock) y umbrales X/4 y X/2."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services.inventory_kpi_logic import classify_inventory_band


@pytest.mark.parametrize(
    "stock,x_ref,expected",
    [
        # Sin X: solo crítico si sin stock
        (0, 0, "critical"),
        (10, 0, "ok"),
        # X=100
        (0, 100, "critical"),
        (10, 100, "critical"),
        (26, 100, "low"),
        (30, 100, "low"),
        (49, 100, "low"),
        (50, 100, "medium"),
        (75, 100, "medium"),
        (99, 100, "medium"),
        (100, 100, "ok"),
        (500, 100, "ok"),
        # X=10: t1=2.5, t2=5
        (2, 10, "critical"),
        (3, 10, "low"),
        (4, 10, "low"),
        (5, 10, "medium"),
        (9, 10, "medium"),
        (10, 10, "ok"),
            # X=4: t1=1, t2=2
            (1, 4, "critical"),
            (2, 4, "medium"),
            (3, 4, "medium"),
        (4, 4, "ok"),
    ],
)
def test_classify_inventory_band(stock: int, x_ref: int, expected: str):
    assert classify_inventory_band(stock, x_ref) == expected


def test_aggregate_counts_match_example_table():
    """Tabla demo front: 6 filas; X = segundo valor."""
    rows = [
        (200, 100),
        (80, 50),
        (25, 15),
        (6, 4),
        (8, 10),
        (0, 5),
    ]
    crit = low = med = 0
    for s, x in rows:
        b = classify_inventory_band(s, x)
        if b == "critical":
            crit += 1
        elif b == "low":
            low += 1
        elif b == "medium":
            med += 1
    assert crit == 1
    assert low == 0
    assert med == 1
