"""Tests for inventory stock list filters (HU-47)."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from src.services.inventory_stock_service import get_inventory_stock_list_for_local


@pytest.fixture
def local_id():
    return uuid4()


@pytest.fixture
def cat_a():
    return uuid4()


@pytest.fixture
def cat_b():
    return uuid4()


def _make_db(inv_rows, products_rows, categories_rows):
    """Minimal Supabase-style chain mock."""
    db = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "inventory":
            t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=inv_rows)
        elif name == "products":
            t.select.return_value.in_.return_value.execute.return_value = MagicMock(data=products_rows)
        elif name == "categories":
            t.select.return_value.in_.return_value.execute.return_value = MagicMock(data=categories_rows)
        return t

    db.table.side_effect = table
    return db


def test_stock_list_filters_by_category(local_id, cat_a, cat_b):
    pid1, pid2 = str(uuid4()), str(uuid4())
    inv = [
        {"id": str(uuid4()), "product_id": pid1, "stock": 5, "min_stock": 1},
        {"id": str(uuid4()), "product_id": pid2, "stock": 3, "min_stock": 1},
    ]
    products = [
        {"id": pid1, "category_id": str(cat_a), "name": "Arroz", "description": "", "price": 100},
        {"id": pid2, "category_id": str(cat_b), "name": "Aceite", "description": "", "price": 200},
    ]
    categories = [{"id": str(cat_a), "name": "Granos"}, {"id": str(cat_b), "name": "Condimentos"}]
    db = _make_db(inv, products, categories)

    rows = get_inventory_stock_list_for_local(db, local_id, category_id=cat_a)
    assert len(rows) == 1
    assert rows[0]["product_name"] == "Arroz"


def test_stock_list_filters_by_search_partial(local_id, cat_a):
    pid1, pid2 = str(uuid4()), str(uuid4())
    inv = [
        {"id": str(uuid4()), "product_id": pid1, "stock": 5, "min_stock": 1},
        {"id": str(uuid4()), "product_id": pid2, "stock": 3, "min_stock": 1},
    ]
    products = [
        {"id": pid1, "category_id": str(cat_a), "name": "Arroz premium", "description": "", "price": 100},
        {"id": pid2, "category_id": str(cat_a), "name": "Aceite", "description": "", "price": 200},
    ]
    categories = [{"id": str(cat_a), "name": "Granos"}]
    db = _make_db(inv, products, categories)

    rows = get_inventory_stock_list_for_local(db, local_id, search="arroz")
    assert len(rows) == 1
    assert "arroz" in rows[0]["product_name"].lower()


def test_stock_list_combines_category_and_search(local_id, cat_a, cat_b):
    pid1, pid2 = str(uuid4()), str(uuid4())
    inv = [
        {"id": str(uuid4()), "product_id": pid1, "stock": 5, "min_stock": 1},
        {"id": str(uuid4()), "product_id": pid2, "stock": 3, "min_stock": 1},
    ]
    products = [
        {"id": pid1, "category_id": str(cat_a), "name": "Arroz largo", "description": "", "price": 100},
        {"id": pid2, "category_id": str(cat_b), "name": "Arroz integral", "description": "", "price": 150},
    ]
    categories = [
        {"id": str(cat_a), "name": "Granos"},
        {"id": str(cat_b), "name": "Otros"},
    ]
    db = _make_db(inv, products, categories)

    rows = get_inventory_stock_list_for_local(db, local_id, category_id=cat_b, search="arroz")
    assert len(rows) == 1
    assert rows[0]["product_name"] == "Arroz integral"
