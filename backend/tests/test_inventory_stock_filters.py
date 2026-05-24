"""Filtros de listado de inventario (search / category / status)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services.inventory_stock_service import apply_inventory_stock_list_filters


def _row(name: str, cat: str, st: str) -> dict:
    return {
        "product_name": name,
        "category_id": cat,
        "stock_status": st,
    }


def test_filter_search_partial_case_insensitive():
    items = [_row("Arroz premium", "c1", "OPTIMO"), _row("Fideos", "c1", "BAJO")]
    r = apply_inventory_stock_list_filters(items, search="arroz")
    assert len(r) == 1 and r[0]["product_name"] == "Arroz premium"


def test_filter_category():
    items = [_row("A", "cat-1", "OPTIMO"), _row("B", "cat-2", "OPTIMO")]
    r = apply_inventory_stock_list_filters(items, category_id="cat-2")
    assert len(r) == 1 and r[0]["product_name"] == "B"


def test_filter_status_multi():
    items = [
        _row("A", "c", "CRITICO"),
        _row("B", "c", "BAJO"),
        _row("C", "c", "OPTIMO"),
    ]
    r = apply_inventory_stock_list_filters(items, status_filters=["CRITICO", "BAJO"])
    assert {x["product_name"] for x in r} == {"A", "B"}


def test_filter_combined():
    items = [
        _row("Arroz", "c1", "OPTIMO"),
        _row("Arvejas", "c1", "CRITICO"),
        _row("Arroz integral", "c2", "OPTIMO"),
    ]
    r = apply_inventory_stock_list_filters(
        items,
        search="arroz",
        category_id="c1",
        status_filters=["OPTIMO"],
    )
    assert len(r) == 1 and r[0]["product_name"] == "Arroz"


def test_filter_no_ops_returns_copy():
    items = [_row("X", "c", "OPTIMO")]
    r = apply_inventory_stock_list_filters(items)
    assert r == items
    assert r is not items
