"""
Tests for /api/orders endpoints.
Covers: route ordering, RBAC, CRUD, summary/local sub-routes.
Uses TestClient + dependency_overrides (no real DB, no real JWT).
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

# ── Shared test data ───────────────────────────────────────────────────────────

ORDER_ID   = str(uuid4())
LOCAL_ID   = str(uuid4())
LOCAL2_ID  = str(uuid4())
ITEM_ID    = str(uuid4())
PRODUCT_ID = str(uuid4())
BIZ_ID     = str(uuid4())

_ORDER = {
    "id": ORDER_ID,
    "local_id": LOCAL_ID,
    "mesa_id": None,
    "client_id": None,
    "caja_id": None,
    "source": "dine-in",
    "payment_method": "CASH",
    "status": "PENDING",
    "subtotal": 1000,
    "total": 1000,
    "created_at": "2026-05-05T00:00:00",
}
_LOCAL = {
    "id": LOCAL_ID,
    "name": "Local Test",
    "address": "Calle 1",
    "phone": "123",
    "business_id": BIZ_ID,
}
_ITEM = {
    "id": ITEM_ID,
    "order_id": ORDER_ID,
    "product_id": PRODUCT_ID,
    "quantity": 2,
    "unit_price": 500,
    "total_price": 1000,
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _user(role="ADMIN"):
    return {
        "user_id": "u1",
        "id": "u1",
        "email": "a@b.com",
        "role": role,
        "is_active": True,
        "business_id": BIZ_ID,
    }


def _simple_db():
    """DB mock where every chain returns _ORDER data by default."""
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [_ORDER]
    db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [_ORDER]
    db.table.return_value.insert.return_value.execute.return_value.data = [_ORDER]
    return db


def _summary_db(order_data=None, local_data=None, items_data=None):
    """DB mock with per-table routing for the summary endpoint."""
    db = MagicMock()
    orders_m = MagicMock()
    orders_m.select.return_value.eq.return_value.execute.return_value.data = (
        order_data if order_data is not None else [_ORDER]
    )
    locals_m = MagicMock()
    locals_m.select.return_value.eq.return_value.execute.return_value.data = (
        local_data if local_data is not None else [_LOCAL]
    )
    items_m = MagicMock()
    items_m.select.return_value.eq.return_value.execute.return_value.data = (
        items_data if items_data is not None else [_ITEM]
    )

    def _table(name):
        if name == "orders":
            return orders_m
        if name == "locals":
            return locals_m
        if name == "order_items":
            return items_m
        return MagicMock()

    db.table.side_effect = _table
    return db


def _change_local_db(local_exists=True, order_found=True):
    """DB mock for PATCH /orders/{id}/local."""
    db = MagicMock()
    locals_m = MagicMock()
    locals_m.select.return_value.eq.return_value.execute.return_value.data = (
        [{"id": LOCAL2_ID}] if local_exists else []
    )
    orders_m = MagicMock()
    orders_m.update.return_value.eq.return_value.execute.return_value.data = (
        [_ORDER] if order_found else []
    )

    def _table(name):
        if name == "locals":
            return locals_m
        if name == "orders":
            return orders_m
        return MagicMock()

    db.table.side_effect = _table
    return db


def _override(role="ADMIN", db=None):
    """Context manager: sets dependency_overrides, clears on exit."""
    if db is None:
        db = _simple_db()

    class _Ctx:
        def __enter__(self):
            app.dependency_overrides[get_current_user] = lambda: _user(role)
            app.dependency_overrides[get_db] = lambda: db
            return TestClient(app, raise_server_exceptions=False)

        def __exit__(self, *_):
            app.dependency_overrides.clear()

    return _Ctx()


# ── Route ordering ─────────────────────────────────────────────────────────────

class TestRouteOrdering:
    """Verify specific sub-paths resolve before /{order_id} parameterized route."""

    def test_summary_not_captured_by_get_order(self):
        """GET /orders/{id}/summary must reach summary handler, not get_order."""
        db = _summary_db()
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/orders/{ORDER_ID}/summary")
        assert r.status_code == 200
        body = r.json()
        # summary returns local_info and items — get_order does not
        assert "local_info" in body
        assert "items" in body

    def test_local_patch_not_captured_by_update_order(self):
        """PATCH /orders/{id}/local must reach change_order_local, not update_order."""
        db = _change_local_db()
        with _override("ADMIN", db) as client:
            r = client.patch(
                f"/api/orders/{ORDER_ID}/local",
                json={"local_id": LOCAL2_ID},
            )
        # update_order expects OrderUpdate schema (status/payment_method fields),
        # not local_id — a 200 here proves change_order_local handled it
        assert r.status_code == 200


# ── GET /orders ────────────────────────────────────────────────────────────────

class TestListOrders:
    def test_requires_local_id_param(self):
        with _override() as client:
            r = client.get("/api/orders")
        assert r.status_code == 422  # missing required query param

    def test_returns_orders_for_local(self):
        with _override() as client:
            r = client.get(f"/api/orders?local_id={LOCAL_ID}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_status_filter_accepted(self):
        with _override() as client:
            r = client.get(f"/api/orders?local_id={LOCAL_ID}&status=PENDING")
        assert r.status_code == 200


# ── POST /orders ───────────────────────────────────────────────────────────────

class TestCreateOrder:
    _payload = {
        "local_id": LOCAL_ID,
        "source": "dine-in",
        "payment_method": "CASH",
        "items": [
            {"product_id": PRODUCT_ID, "quantity": 2, "unit_price": 500}
        ],
    }

    def test_admin_can_create(self):
        db = MagicMock()
        db.table.return_value.insert.return_value.execute.return_value.data = [_ORDER]
        with _override("ADMIN", db) as client:
            r = client.post("/api/orders", json=self._payload)
        assert r.status_code == 200

    def test_cajero_can_create(self):
        db = MagicMock()
        db.table.return_value.insert.return_value.execute.return_value.data = [_ORDER]
        with _override("CAJERO", db) as client:
            r = client.post("/api/orders", json=self._payload)
        assert r.status_code == 200

    def test_guest_forbidden(self):
        with _override("GUEST") as client:
            r = client.post("/api/orders", json=self._payload)
        assert r.status_code == 403


# ── GET /orders/{id}/summary ───────────────────────────────────────────────────

class TestOrderSummary:
    def test_returns_order_with_local_and_items(self):
        db = _summary_db()
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/orders/{ORDER_ID}/summary")
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == ORDER_ID
        assert body["business_id"] == BIZ_ID
        assert body["local_info"]["id"] == LOCAL_ID
        assert len(body["items"]) == 1

    def test_404_when_order_missing(self):
        db = _summary_db(order_data=[])
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/orders/{ORDER_ID}/summary")
        assert r.status_code == 404

    def test_business_id_none_when_local_missing(self):
        db = _summary_db(local_data=[])
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/orders/{ORDER_ID}/summary")
        assert r.status_code == 200
        assert r.json()["business_id"] is None

    def test_items_empty_list_on_no_items(self):
        db = _summary_db(items_data=[])
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/orders/{ORDER_ID}/summary")
        assert r.status_code == 200
        assert r.json()["items"] == []


# ── GET /orders/{id} ───────────────────────────────────────────────────────────

class TestGetOrder:
    def test_returns_order(self):
        with _override() as client:
            r = client.get(f"/api/orders/{ORDER_ID}")
        assert r.status_code == 200
        assert r.json()["id"] == ORDER_ID

    def test_404_when_not_found(self):
        db = _simple_db()
        db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/orders/{ORDER_ID}")
        assert r.status_code == 404


# ── PATCH /orders/{id}/local ───────────────────────────────────────────────────

class TestChangeOrderLocal:
    def test_admin_can_change_local(self):
        db = _change_local_db()
        with _override("ADMIN", db) as client:
            r = client.patch(f"/api/orders/{ORDER_ID}/local", json={"local_id": LOCAL2_ID})
        assert r.status_code == 200

    def test_cajero_can_change_local(self):
        db = _change_local_db()
        with _override("CAJERO", db) as client:
            r = client.patch(f"/api/orders/{ORDER_ID}/local", json={"local_id": LOCAL2_ID})
        assert r.status_code == 200

    def test_guest_forbidden(self):
        db = _change_local_db()
        with _override("GUEST", db) as client:
            r = client.patch(f"/api/orders/{ORDER_ID}/local", json={"local_id": LOCAL2_ID})
        assert r.status_code == 403

    def test_404_when_target_local_not_found(self):
        db = _change_local_db(local_exists=False)
        with _override("ADMIN", db) as client:
            r = client.patch(f"/api/orders/{ORDER_ID}/local", json={"local_id": LOCAL2_ID})
        assert r.status_code == 404

    def test_404_when_order_not_found(self):
        db = _change_local_db(order_found=False)
        with _override("ADMIN", db) as client:
            r = client.patch(f"/api/orders/{ORDER_ID}/local", json={"local_id": LOCAL2_ID})
        assert r.status_code == 404


# ── PATCH /orders/{id} ────────────────────────────────────────────────────────

class TestUpdateOrder:
    def test_admin_can_update_status(self):
        db = MagicMock()
        db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [_ORDER]
        db.table.return_value.insert.return_value.execute.return_value.data = [{}]
        with _override("ADMIN", db) as client:
            r = client.patch(f"/api/orders/{ORDER_ID}", json={"status": "PREPARING"})
        assert r.status_code == 200

    def test_guest_forbidden(self):
        with _override("GUEST") as client:
            r = client.patch(f"/api/orders/{ORDER_ID}", json={"status": "PREPARING"})
        assert r.status_code == 403

    def test_404_when_not_found(self):
        db = MagicMock()
        db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []
        with _override("ADMIN", db) as client:
            r = client.patch(f"/api/orders/{ORDER_ID}", json={"status": "PREPARING"})
        assert r.status_code == 404


# ── GET /orders/{id}/items ────────────────────────────────────────────────────

class TestGetOrderItems:
    def test_returns_items_list(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [_ITEM]
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/orders/{ORDER_ID}/items")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ── POST /orders/{id}/items ───────────────────────────────────────────────────

class TestCreateOrderItem:
    _payload = {"product_id": PRODUCT_ID, "quantity": 1, "unit_price": 500.0}

    def test_admin_can_add_item(self):
        db = MagicMock()
        db.table.return_value.insert.return_value.execute.return_value.data = [_ITEM]
        with _override("ADMIN", db) as client:
            r = client.post(f"/api/orders/{ORDER_ID}/items", json=self._payload)
        assert r.status_code == 200

    def test_guest_forbidden(self):
        with _override("GUEST") as client:
            r = client.post(f"/api/orders/{ORDER_ID}/items", json=self._payload)
        assert r.status_code == 403


# ── DELETE /orders/{id}/items/{item_id} ───────────────────────────────────────

class TestDeleteOrderItem:
    def test_admin_can_delete_item(self):
        db = MagicMock()
        db.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()
        with _override("ADMIN", db) as client:
            r = client.delete(f"/api/orders/{ORDER_ID}/items/{ITEM_ID}")
        assert r.status_code == 204

    def test_guest_forbidden(self):
        with _override("GUEST") as client:
            r = client.delete(f"/api/orders/{ORDER_ID}/items/{ITEM_ID}")
        assert r.status_code == 403


# ── PATCH /orders/{id}/items/{item_id} ────────────────────────────────────────

class TestUpdateOrderItem:
    def test_admin_can_update_item(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [_ITEM]
        db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [_ITEM]
        with _override("ADMIN", db) as client:
            r = client.patch(
                f"/api/orders/{ORDER_ID}/items/{ITEM_ID}",
                json={"quantity": 3},
            )
        assert r.status_code == 200

    def test_guest_forbidden(self):
        with _override("GUEST") as client:
            r = client.patch(
                f"/api/orders/{ORDER_ID}/items/{ITEM_ID}",
                json={"quantity": 3},
            )
        assert r.status_code == 403

    def test_404_when_item_not_found(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        with _override("ADMIN", db) as client:
            r = client.patch(
                f"/api/orders/{ORDER_ID}/items/{ITEM_ID}",
                json={"quantity": 3},
            )
        assert r.status_code == 404
