"""HU-48: filtro por estado en listado de inventario."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from src.schemas import InventoryStockStatus
from src.services.inventory_stock_service import (
    get_inventory_stock_list_for_local,
    parse_status_query_params,
)


def test_parse_status_none():
    assert parse_status_query_params(None) is None
    assert parse_status_query_params([]) is None


def test_parse_status_single_and_repeat():
    assert parse_status_query_params(["CRITICO"]) == frozenset({"CRITICO"})
    assert parse_status_query_params(["critico"]) == frozenset({"CRITICO"})
    assert parse_status_query_params(["BAJO", "OPTIMO"]) == frozenset({"BAJO", "OPTIMO"})


def test_parse_status_comma_separated():
    assert parse_status_query_params(["CRITICO,BAJO"]) == frozenset({"CRITICO", "BAJO"})
    assert parse_status_query_params([" OPTIMO , BAJO "]) == frozenset({"OPTIMO", "BAJO"})


def test_parse_status_ignores_invalid():
    assert parse_status_query_params(["FOO", "CRITICO"]) == frozenset({"CRITICO"})
    assert parse_status_query_params(["nada"]) is None


@pytest.fixture
def local_id():
    return uuid4()


@pytest.fixture
def cat_a():
    return uuid4()


def _make_db_for_status_filter(local_id, cat_a):
    """Dos productos: uno CRITICO (stock 0), uno OPTIMO (stock alto vs max)."""
    inv_id1, inv_id2 = str(uuid4()), str(uuid4())
    pid1, pid2 = str(uuid4()), str(uuid4())
    desc_opt = "Stock máximo: 100. Proveedor: X."
    inv = [
        {"id": inv_id1, "product_id": pid1, "stock": 0, "min_stock": 0},
        {"id": inv_id2, "product_id": pid2, "stock": 80, "min_stock": 0},
    ]
    products = [
        {"id": pid1, "category_id": str(cat_a), "name": "A", "description": desc_opt, "price": 10},
        {"id": pid2, "category_id": str(cat_a), "name": "B", "description": desc_opt, "price": 10},
    ]
    categories = [{"id": str(cat_a), "name": "Cat"}]

    db = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "inventory":
            t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=inv)
        elif name == "products":
            t.select.return_value.in_.return_value.execute.return_value = MagicMock(data=products)
        elif name == "categories":
            t.select.return_value.in_.return_value.execute.return_value = MagicMock(data=categories)
        return t

    db.table.side_effect = table
    return db


def test_list_filters_only_critico(local_id, cat_a):
    db = _make_db_for_status_filter(local_id, cat_a)
    rows = get_inventory_stock_list_for_local(db, local_id, status_filter=frozenset({"CRITICO"}))
    assert len(rows) == 1
    assert rows[0]["stock_status"] == InventoryStockStatus.CRITICO


def test_list_filters_critico_and_optimo_union(local_id, cat_a):
    db = _make_db_for_status_filter(local_id, cat_a)
    rows = get_inventory_stock_list_for_local(db, local_id, status_filter=frozenset({"CRITICO", "OPTIMO"}))
    assert len(rows) == 2


def test_list_combine_status_and_search(local_id, cat_a):
    db = _make_db_for_status_filter(local_id, cat_a)
    rows = get_inventory_stock_list_for_local(
        db,
        local_id,
        status_filter=frozenset({"OPTIMO"}),
        search="B",
    )
    assert len(rows) == 1
    assert rows[0]["product_name"] == "B"
