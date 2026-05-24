"""Validación backend del formulario Nuevo producto (inventario)."""

import pytest
from uuid import uuid4, UUID
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from pydantic import ValidationError

from src.schemas import NewProductInventoryForm
from src.main import app
from src.deps import get_current_user, get_db
from src.services.inventory_new_product_service import persist_new_product_for_local
from src.schemas import NewProductInventoryForm


def _valid_payload():
    return {
        "product_name": "Arroz 1kg",
        "category_name": "Abarrotes",
        "unit": "kg",
        "stock_max": 100,
        "stock_current": 50,
        "unit_cost_clp": 2500,
        "supplier_name": "Distribuidora Central",
    }


def test_form_accepts_valid_data():
    m = NewProductInventoryForm(**_valid_payload())
    assert m.product_name == "Arroz 1kg"
    assert m.unit_cost_clp == 2500


def test_form_rejects_stock_current_above_max():
    p = _valid_payload()
    p["stock_current"] = 200
    p["stock_max"] = 100
    with pytest.raises(ValidationError) as exc:
        NewProductInventoryForm(**p)
    assert "stock" in str(exc.value).lower() or "máximo" in str(exc.value).lower()


def test_form_rejects_invalid_unit():
    p = _valid_payload()
    p["unit"] = "lb"
    with pytest.raises(ValidationError):
        NewProductInventoryForm(**p)


def test_form_rejects_non_positive_clp():
    p = _valid_payload()
    p["unit_cost_clp"] = 0
    with pytest.raises(ValidationError):
        NewProductInventoryForm(**p)


def test_form_rejects_negative_stock():
    p = _valid_payload()
    p["stock_current"] = -1
    with pytest.raises(ValidationError):
        NewProductInventoryForm(**p)


def test_validate_endpoint_200():
    local_id = str(uuid4())
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
        MagicMock(data=[{"id": local_id}])
    )

    app.dependency_overrides[get_current_user] = lambda: {"role": "ADMIN", "user_id": "u1"}
    app.dependency_overrides[get_db] = lambda: mock_db

    with TestClient(app) as client:
        r = client.post(
            f"/api/inventory/locals/{local_id}/validate-new-product",
            json=_valid_payload(),
        )
    app.dependency_overrides.clear()

    assert r.status_code == 200
    data = r.json()
    assert data["product_name"] == "Arroz 1kg"
    assert data["unit_cost_clp"] == 2500
    assert data["local_id"] == local_id


def test_validate_endpoint_accepts_camelcase_json():
    """Mismo payload que envía el modal React (claves camelCase)."""
    local_id = str(uuid4())
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
        MagicMock(data=[{"id": local_id}])
    )

    app.dependency_overrides[get_current_user] = lambda: {"role": "ADMIN", "user_id": "u1"}
    app.dependency_overrides[get_db] = lambda: mock_db

    camel = {
        "productName": "Arroz 1kg",
        "category": "Abarrotes",
        "unit": "kg",
        "maxStock": 100,
        "currentStock": 50,
        "unitCost": 2500,
        "supplier": "Distribuidora Central",
    }

    with TestClient(app) as client:
        r = client.post(
            f"/api/inventory/locals/{local_id}/validate-new-product",
            json=camel,
        )
    app.dependency_overrides.clear()

    assert r.status_code == 200
    assert r.json()["product_name"] == "Arroz 1kg"


class _FakeResult:
    def __init__(self, data):
        self.data = data


class FakeSupabaseDB:
    """Simula categoría nueva, producto e inventario para probar persistencia."""

    def __init__(self):
        self._cat_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        self._prod_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        self._inv_id = "cccccccc-cccc-cccc-cccc-cccccccccccc"
        self.categories = []

    def table(self, name):
        return _FakeTable(self, name)


class _FakeTable:
    def __init__(self, db: FakeSupabaseDB, name: str):
        self.db = db
        self.name = name
        self._insert_payload = None

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def insert(self, payload):
        self._insert_payload = payload
        return self

    def delete(self):
        return self

    def execute(self):
        if self.name == "categories" and self._insert_payload is None:
            return _FakeResult(self.db.categories)
        if self.name == "categories" and self._insert_payload is not None:
            cid = self.db._cat_id
            self.db.categories.append({"id": cid, "name": self._insert_payload["name"]})
            return _FakeResult([{"id": cid}])
        if self.name == "products":
            return _FakeResult([{"id": self.db._prod_id}])
        if self.name == "inventory":
            return _FakeResult([{"id": self.db._inv_id}])
        return _FakeResult([])


def test_persist_new_product_service_happy_path():
    db = FakeSupabaseDB()
    body = NewProductInventoryForm(**_valid_payload())
    out = persist_new_product_for_local(db, uuid4(), body)
    assert str(out.category_id) == db._cat_id
    assert str(out.product_id) == db._prod_id
    assert str(out.inventory_id) == db._inv_id


def test_persist_endpoint_201_style_200():
    """POST /new-product con mock de DB que replica el flujo de tablas."""
    local_id = str(UUID("dddddddd-dddd-dddd-dddd-dddddddddddd"))

    class ChainDB(FakeSupabaseDB):
        def table(self, name):
            if name == "locals":
                return _LocalTable()
            return super().table(name)

    class _LocalTable:
        def select(self, *a, **k):
            return self

        def eq(self, *a, **k):
            return self

        def limit(self, *a, **k):
            return self

        def execute(self):
            return _FakeResult([{"id": local_id}])

    app.dependency_overrides[get_current_user] = lambda: {"role": "ADMIN", "user_id": "u1"}
    app.dependency_overrides[get_db] = lambda: ChainDB()

    with TestClient(app) as client:
        r = client.post(f"/api/inventory/locals/{local_id}/new-product", json=_valid_payload())
    app.dependency_overrides.clear()

    assert r.status_code == 200
    assert "product_id" in r.json()


def test_validate_endpoint_404_unknown_local():
    local_id = str(uuid4())
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
        MagicMock(data=[])
    )

    app.dependency_overrides[get_current_user] = lambda: {"role": "ADMIN", "user_id": "u1"}
    app.dependency_overrides[get_db] = lambda: mock_db

    with TestClient(app) as client:
        r = client.post(
            f"/api/inventory/locals/{local_id}/validate-new-product",
            json=_valid_payload(),
        )
    app.dependency_overrides.clear()

    assert r.status_code == 404
