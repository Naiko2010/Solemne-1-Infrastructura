"""Validación de proveedor contra el negocio del local."""
from unittest.mock import MagicMock

import pytest

from src.schemas import SupplierCreate
from src.services.supplier_service import (
    assert_supplier_belongs_to_business,
    create_supplier,
    get_business_id_for_local,
    list_suppliers_for_business,
    list_suppliers_with_purchase_metrics_for_business,
)


def test_get_business_id_for_local_ok():
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"business_id": "biz-1"}
    ]
    assert get_business_id_for_local(db, "loc-1") == "biz-1"


def test_get_business_id_for_local_missing():
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    with pytest.raises(ValueError, match="Local no encontrado"):
        get_business_id_for_local(db, "loc-x")


def test_assert_supplier_belongs_to_business_ok():
    db = MagicMock()
    chain = db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute
    chain.return_value.data = [
        {"id": "s1", "business_id": "biz-1", "name": "ACME", "is_active": True},
    ]
    row = assert_supplier_belongs_to_business(db, "s1", "biz-1")
    assert row["name"] == "ACME"


def test_assert_supplier_wrong_business():
    db = MagicMock()
    chain = db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute
    chain.return_value.data = [
        {"id": "s1", "business_id": "other", "name": "X", "is_active": True},
    ]
    with pytest.raises(ValueError, match="no pertenece"):
        assert_supplier_belongs_to_business(db, "s1", "biz-1")


def test_assert_supplier_inactive():
    db = MagicMock()
    chain = db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute
    chain.return_value.data = [
        {"id": "s1", "business_id": "biz-1", "name": "X", "is_active": False},
    ]
    with pytest.raises(ValueError, match="inactivo"):
        assert_supplier_belongs_to_business(db, "s1", "biz-1")


def test_list_suppliers_for_business_search_and_category_filters():
    """PostgREST: ilike en name y category; ambos opcionales y combinables."""
    db = MagicMock()
    chain = db.table.return_value.select.return_value.eq.return_value.eq.return_value
    chain.ilike.return_value.ilike.return_value.execute.return_value.data = [
        {"id": "s1", "business_id": "biz-1", "name": "ACME Foods", "category": "Insumos", "is_active": True},
    ]
    rows = list_suppliers_for_business(db, "biz-1", search="food", category="insu")
    assert len(rows) == 1
    assert rows[0]["name"] == "ACME Foods"
    assert chain.ilike.call_args_list[0][0] == ("name", "%food%")
    assert chain.ilike.return_value.ilike.call_args_list[0][0] == ("category", "%insu%")


def test_list_suppliers_with_purchase_metrics():
    db = MagicMock()

    suppliers_query = db.table.return_value.select.return_value.eq.return_value.eq.return_value
    suppliers_query.execute.return_value.data = [
        {"id": "s1", "business_id": "biz-1", "name": "ACME", "is_active": True, "created_at": None},
        {"id": "s2", "business_id": "biz-1", "name": "Beta", "is_active": True, "created_at": None},
    ]

    products_query = MagicMock()
    products_query.execute.return_value.data = [
        {"id": "p1", "supplier_id": "s1", "price": 1000},
        {"id": "p2", "supplier_id": "s1", "price": 500},
        {"id": "p3", "supplier_id": "s2", "price": 200},
    ]
    inventory_query = MagicMock()
    inventory_query.execute.return_value.data = [
        {"product_id": "p1", "stock": 2},
        {"product_id": "p2", "stock": 10},
        {"product_id": "p3", "stock": 5},
    ]

    db.table.return_value.select.return_value.in_.side_effect = [products_query, inventory_query]

    rows = list_suppliers_with_purchase_metrics_for_business(db, "biz-1")
    by_id = {row["id"]: row for row in rows}

    assert by_id["s1"]["purchased_products_count"] == 12
    assert by_id["s1"]["supplier_purchases_total_clp"] == 7000
    assert by_id["s2"]["purchased_products_count"] == 5
    assert by_id["s2"]["supplier_purchases_total_clp"] == 1000


def test_create_supplier_minimal_name_only():
    db = MagicMock()
    db.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "s1", "business_id": "biz-1", "name": "ACME", "is_active": True},
    ]
    payload = SupplierCreate(name="  ACME  ")
    row = create_supplier(db, "biz-1", payload)
    assert row["name"] == "ACME"
    insert_kw = db.table.return_value.insert.call_args[0][0]
    assert insert_kw == {"business_id": "biz-1", "name": "ACME", "is_active": True}


def test_create_supplier_extended_hu86():
    db = MagicMock()
    db.table.return_value.insert.return_value.execute.return_value.data = [
        {
            "id": "s1",
            "business_id": "biz-1",
            "name": "Full SpA",
            "is_active": True,
            "rut": "12.345.678-5",
        },
    ]
    payload = SupplierCreate(
        name="Full SpA",
        rut="123456785",
        address="Av. Siempre Viva 742",
        category="Insumos",
        contact_name="Ana",
        phone="+56 9 8765 4321",
        email="ana@example.com",
    )
    row = create_supplier(db, "biz-1", payload)
    assert row["name"] == "Full SpA"
    insert_kw = db.table.return_value.insert.call_args[0][0]
    assert insert_kw["rut"] == "12.345.678-5"
    assert insert_kw["email"] == "ana@example.com"
    assert insert_kw["phone"] == "56987654321"


def test_create_supplier_extended_missing_email():
    db = MagicMock()
    payload = SupplierCreate(
        name="X",
        rut="123456785",
        address="Calle 1",
        category="Cat",
        contact_name="C",
        phone="912345678",
        email=None,
    )
    with pytest.raises(ValueError, match="Email"):
        create_supplier(db, "biz-1", payload)
