import pytest
import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services import purchases_service
from src.services.purchases_service import create_purchase_and_update_inventory


def _payload() -> dict:
    return {
        "local_id": "loc-1",
        "supplier_id": "sup-1",
        "product_id": "prod-1",
        "quantity": 5,
        "unit_cost_clp": 1200,
        "purchase_date": "2026-04-19",
    }


def test_create_purchase_updates_existing_inventory_stock(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr(purchases_service, "get_business_id_for_local", lambda *_: "biz-1")
    monkeypatch.setattr(purchases_service, "assert_supplier_belongs_to_business", lambda *_: {"id": "sup-1"})
    monkeypatch.setattr(
        purchases_service,
        "_fetch_product",
        lambda *_: {"id": "prod-1", "supplier_id": "sup-1", "name": "Arroz"},
    )
    monkeypatch.setattr(
        purchases_service,
        "_fetch_inventory_row",
        lambda *_: {"id": "inv-1", "stock": 10, "min_stock": 2},
    )
    db.table.return_value.insert.return_value.execute.return_value.data = [
        {
            "id": "pur-1",
            "business_id": "biz-1",
            "local_id": "loc-1",
            "supplier_id": "sup-1",
            "product_id": "prod-1",
            "quantity": 5,
            "unit_cost_clp": 1200,
            "total_clp": 6000,
            "purchase_date": "2026-04-19",
        }
    ]

    result = create_purchase_and_update_inventory(db, _payload())
    assert result["id"] == "pur-1"
    assert result["new_stock"] == 15


def test_create_purchase_creates_inventory_when_missing(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr(purchases_service, "get_business_id_for_local", lambda *_: "biz-1")
    monkeypatch.setattr(purchases_service, "assert_supplier_belongs_to_business", lambda *_: {"id": "sup-1"})
    monkeypatch.setattr(
        purchases_service,
        "_fetch_product",
        lambda *_: {"id": "prod-1", "supplier_id": "sup-1", "name": "Arroz"},
    )
    monkeypatch.setattr(purchases_service, "_fetch_inventory_row", lambda *_: None)
    db.table.return_value.insert.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "inv-2", "stock": 5}]),
        MagicMock(
            data=[
                {
                    "id": "pur-2",
                    "business_id": "biz-1",
                    "local_id": "loc-1",
                    "supplier_id": "sup-1",
                    "product_id": "prod-1",
                    "quantity": 5,
                    "unit_cost_clp": 1200,
                    "total_clp": 6000,
                    "purchase_date": "2026-04-19",
                }
            ]
        ),
    ]

    result = create_purchase_and_update_inventory(db, _payload())
    assert result["id"] == "pur-2"
    assert result["new_stock"] == 5


def test_create_purchase_rejects_supplier_product_mismatch(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr(purchases_service, "get_business_id_for_local", lambda *_: "biz-1")
    monkeypatch.setattr(purchases_service, "assert_supplier_belongs_to_business", lambda *_: {"id": "sup-1"})
    monkeypatch.setattr(
        purchases_service,
        "_fetch_product",
        lambda *_: {"id": "prod-1", "supplier_id": "sup-2", "name": "Arroz"},
    )

    with pytest.raises(ValueError, match="no pertenece al proveedor"):
        create_purchase_and_update_inventory(db, _payload())
