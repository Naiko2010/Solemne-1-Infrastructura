"""
Tests for /api/mesas endpoints + _derive_mesa_state logic.
Covers: route ordering, RBAC, CRUD, state computation, delete guard.
"""

import pytest
import sys
from pathlib import Path
from uuid import uuid4
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.main import app
from src.deps import get_current_user, get_db
from src.api.routes.mesas import _derive_mesa_state

# ── Shared test data ───────────────────────────────────────────────────────────

MESA_ID  = str(uuid4())
LOCAL_ID = str(uuid4())
ORDER_ID = str(uuid4())
ITEM_ID  = str(uuid4())
PROD_ID  = str(uuid4())

_MESA = {
    "id": MESA_ID,
    "local_id": LOCAL_ID,
    "name": "Mesa 1",
    "numero": 1,
    "capacidad": 4,
    "zona": "Salón",
    "state": "libre",
    "is_delivery": False,
    "is_active": True,
    "created_at": "2026-05-05T00:00:00",
}

_ORDER_PENDING = {
    "id": ORDER_ID,
    "mesa_id": MESA_ID,
    "local_id": LOCAL_ID,
    "status": "PENDING",
    "payment_method": "CASH",
    "source": "dine-in",
    "subtotal": 1000,
    "total": 1000,
    "created_at": "2026-05-05T00:00:00",
}

_ITEM = {
    "id": ITEM_ID,
    "order_id": ORDER_ID,
    "product_id": PROD_ID,
    "quantity": 2,
    "unit_price": 500,
    "total_price": 1000,
}

_PRODUCT = {"id": PROD_ID, "name": "Empanada", "description": ""}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _user(role="ADMIN"):
    return {
        "user_id": "u1", "id": "u1", "email": "a@b.com",
        "role": role, "is_active": True, "business_id": str(uuid4()),
    }


def _simple_db(mesa_data=None):
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
        mesa_data if mesa_data is not None else [_MESA]
    )
    db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [_MESA]
    db.table.return_value.insert.return_value.execute.return_value.data = [_MESA]
    db.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock()
    return db


def _with_state_db(orders=None):
    """DB mock for GET /mesas?with_state=true — mesas + orders tables."""
    db = MagicMock()
    mesas_m = MagicMock()
    mesas_m.select.return_value.eq.return_value.execute.return_value.data = [_MESA]
    orders_m = MagicMock()
    orders_m.select.return_value.eq.return_value.execute.return_value.data = (
        orders if orders is not None else []
    )

    def _table(name):
        if name == "mesas":  return mesas_m
        if name == "orders": return orders_m
        return MagicMock()

    db.table.side_effect = _table
    return db


def _detail_db(mesa_data=None, orders=None, items=None, products=None):
    """DB mock for GET /mesas/{id}/detail — multiple table calls."""
    db = MagicMock()
    mesas_m = MagicMock()
    mesas_m.select.return_value.eq.return_value.execute.return_value.data = (
        mesa_data if mesa_data is not None else [_MESA]
    )
    orders_m = MagicMock()
    orders_m.select.return_value.eq.return_value.execute.return_value.data = (
        orders if orders is not None else []
    )
    items_m = MagicMock()
    items_m.select.return_value.eq.return_value.execute.return_value.data = (
        items if items is not None else []
    )
    products_m = MagicMock()
    products_m.select.return_value.in_.return_value.execute.return_value.data = (
        products if products is not None else []
    )

    def _table(name):
        if name == "mesas":       return mesas_m
        if name == "orders":      return orders_m
        if name == "order_items": return items_m
        if name == "products":    return products_m
        return MagicMock()

    db.table.side_effect = _table
    return db


def _delete_db(active_orders=None):
    """DB mock for DELETE /mesas/{id} — orders check + delete."""
    db = MagicMock()
    orders_m = MagicMock()
    orders_m.select.return_value.eq.return_value.execute.return_value.data = (
        active_orders if active_orders is not None else []
    )
    mesas_m = MagicMock()
    mesas_m.delete.return_value.eq.return_value.execute.return_value = MagicMock()

    def _table(name):
        if name == "orders": return orders_m
        if name == "mesas":  return mesas_m
        return MagicMock()

    db.table.side_effect = _table
    return db


class _Ctx:
    def __init__(self, role, db):
        self._role = role
        self._db = db

    def __enter__(self):
        app.dependency_overrides[get_current_user] = lambda: _user(self._role)
        app.dependency_overrides[get_db] = lambda: self._db
        return TestClient(app, raise_server_exceptions=False)

    def __exit__(self, *_):
        app.dependency_overrides.clear()


def _override(role="ADMIN", db=None):
    return _Ctx(role, db or _simple_db())


# ── Unit: _derive_mesa_state ───────────────────────────────────────────────────

class TestDeriveMesaState:
    def test_no_orders_returns_libre(self):
        assert _derive_mesa_state(MESA_ID, []) == "libre"

    def test_pending_order_returns_ocupada(self):
        orders = [{"mesa_id": MESA_ID, "status": "PENDING"}]
        assert _derive_mesa_state(MESA_ID, orders) == "ocupada"

    def test_preparing_order_returns_ocupada(self):
        orders = [{"mesa_id": MESA_ID, "status": "PREPARING"}]
        assert _derive_mesa_state(MESA_ID, orders) == "ocupada"

    def test_ready_order_returns_en_cobro(self):
        orders = [{"mesa_id": MESA_ID, "status": "READY"}]
        assert _derive_mesa_state(MESA_ID, orders) == "en_cobro"

    def test_en_cobro_takes_priority_over_ocupada(self):
        orders = [
            {"mesa_id": MESA_ID, "status": "PENDING"},
            {"mesa_id": MESA_ID, "status": "READY"},
        ]
        assert _derive_mesa_state(MESA_ID, orders) == "en_cobro"

    def test_other_mesa_orders_ignored(self):
        other_id = str(uuid4())
        orders = [{"mesa_id": other_id, "status": "READY"}]
        assert _derive_mesa_state(MESA_ID, orders) == "libre"

    def test_terminal_status_not_counted(self):
        # terminal orders are pre-filtered by the route before calling _derive_mesa_state
        # so empty input → libre
        assert _derive_mesa_state(MESA_ID, []) == "libre"


# ── Route ordering ─────────────────────────────────────────────────────────────

class TestRouteOrdering:
    def test_detail_not_captured_by_get_mesa(self):
        """GET /mesas/{id}/detail must reach detail handler, not get_mesa."""
        db = _detail_db()
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/mesas/{MESA_ID}/detail")
        assert r.status_code == 200
        body = r.json()
        # detail handler returns these keys; get_mesa does not
        assert "active_orders" in body
        assert "total_products" in body
        assert "total_value" in body


# ── GET /mesas ─────────────────────────────────────────────────────────────────

class TestListMesas:
    def test_requires_local_id(self):
        with _override() as client:
            r = client.get("/api/mesas")
        assert r.status_code == 422

    def test_returns_mesas_list(self):
        with _override() as client:
            r = client.get(f"/api/mesas?local_id={LOCAL_ID}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_with_state_true_adds_state_field(self):
        db = _with_state_db(orders=[])
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/mesas?local_id={LOCAL_ID}&with_state=true")
        assert r.status_code == 200
        body = r.json()
        assert len(body) == 1
        assert "state" in body[0]
        assert body[0]["state"] == "libre"

    def test_with_state_pending_order_marks_ocupada(self):
        db = _with_state_db(orders=[{
            "id": ORDER_ID, "mesa_id": MESA_ID, "status": "PENDING"
        }])
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/mesas?local_id={LOCAL_ID}&with_state=true")
        assert r.status_code == 200
        body = r.json()
        assert body[0]["state"] == "ocupada"

    def test_with_state_ready_order_marks_en_cobro(self):
        db = _with_state_db(orders=[{
            "id": ORDER_ID, "mesa_id": MESA_ID, "status": "READY"
        }])
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/mesas?local_id={LOCAL_ID}&with_state=true")
        assert r.status_code == 200
        body = r.json()
        assert body[0]["state"] == "en_cobro"


# ── POST /mesas ────────────────────────────────────────────────────────────────

class TestCreateMesa:
    _payload = {
        "local_id": LOCAL_ID,
        "name": "Mesa 2",
        "capacidad": 4,
        "zona": "Terraza",
    }

    def test_admin_can_create(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        db.table.return_value.insert.return_value.execute.return_value.data = [_MESA]
        with _override("ADMIN", db) as client:
            r = client.post("/api/mesas", json=self._payload)
        assert r.status_code == 200

    def test_cajero_forbidden(self):
        with _override("CAJERO") as client:
            r = client.post("/api/mesas", json=self._payload)
        assert r.status_code == 403

    def test_guest_forbidden(self):
        with _override("GUEST") as client:
            r = client.post("/api/mesas", json=self._payload)
        assert r.status_code == 403

    def test_duplicate_name_returns_409(self):
        db = MagicMock()
        # existing check finds a row → conflict
        db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": MESA_ID}]
        with _override("ADMIN", db) as client:
            r = client.post("/api/mesas", json=self._payload)
        assert r.status_code == 409


# ── GET /mesas/{id}/detail ────────────────────────────────────────────────────

class TestGetMesaDetail:
    def test_returns_detail_with_empty_orders(self):
        db = _detail_db()
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/mesas/{MESA_ID}/detail")
        assert r.status_code == 200
        body = r.json()
        assert body["total_products"] == 0
        assert body["total_value"] == 0
        assert body["active_orders"] == []

    def test_404_when_mesa_not_found(self):
        db = _detail_db(mesa_data=[])
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/mesas/{MESA_ID}/detail")
        assert r.status_code == 404

    def test_active_orders_included(self):
        db = _detail_db(orders=[_ORDER_PENDING], items=[_ITEM], products=[_PRODUCT])
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/mesas/{MESA_ID}/detail")
        assert r.status_code == 200
        body = r.json()
        assert len(body["active_orders"]) == 1
        assert body["total_products"] == 2  # _ITEM.quantity = 2

    def test_terminal_orders_excluded(self):
        completed_order = {**_ORDER_PENDING, "status": "COMPLETED"}
        db = _detail_db(orders=[completed_order])
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/mesas/{MESA_ID}/detail")
        assert r.status_code == 200
        assert r.json()["active_orders"] == []


# ── GET /mesas/{id} ───────────────────────────────────────────────────────────

class TestGetMesa:
    def test_returns_mesa(self):
        with _override() as client:
            r = client.get(f"/api/mesas/{MESA_ID}")
        assert r.status_code == 200
        assert r.json()["id"] == MESA_ID

    def test_404_when_not_found(self):
        db = _simple_db(mesa_data=[])
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/mesas/{MESA_ID}")
        assert r.status_code == 404


# ── PATCH /mesas/{id} ─────────────────────────────────────────────────────────

class TestUpdateMesa:
    def test_admin_can_update(self):
        with _override("ADMIN") as client:
            r = client.patch(f"/api/mesas/{MESA_ID}", json={"name": "Mesa Renovada"})
        assert r.status_code == 200

    def test_cajero_forbidden(self):
        with _override("CAJERO") as client:
            r = client.patch(f"/api/mesas/{MESA_ID}", json={"name": "X"})
        assert r.status_code == 403

    def test_404_when_not_found(self):
        db = MagicMock()
        db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []
        with _override("ADMIN", db) as client:
            r = client.patch(f"/api/mesas/{MESA_ID}", json={"name": "X"})
        assert r.status_code == 404


# ── DELETE /mesas/{id} ────────────────────────────────────────────────────────

class TestDeleteMesa:
    def test_superadmin_can_delete_when_no_active_orders(self):
        db = _delete_db(active_orders=[])
        with _override("SUPERADMIN", db) as client:
            r = client.delete(f"/api/mesas/{MESA_ID}")
        assert r.status_code == 204

    def test_admin_forbidden(self):
        db = _delete_db()
        with _override("ADMIN", db) as client:
            r = client.delete(f"/api/mesas/{MESA_ID}")
        assert r.status_code == 403

    def test_cajero_forbidden(self):
        with _override("CAJERO") as client:
            r = client.delete(f"/api/mesas/{MESA_ID}")
        assert r.status_code == 403

    def test_409_when_active_orders_exist(self):
        db = _delete_db(active_orders=[{"id": ORDER_ID, "status": "PENDING"}])
        with _override("SUPERADMIN", db) as client:
            r = client.delete(f"/api/mesas/{MESA_ID}")
        assert r.status_code == 409

    def test_completed_orders_dont_block_delete(self):
        # only terminal statuses → active_orders list empty after filter → delete allowed
        db = _delete_db(active_orders=[{"id": ORDER_ID, "status": "COMPLETED"}])
        with _override("SUPERADMIN", db) as client:
            r = client.delete(f"/api/mesas/{MESA_ID}")
        assert r.status_code == 204
