"""
Tests for /api/expenses endpoints + normalization helpers.
Covers: RBAC, CRUD, category/status/date normalization, status filter.
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
from src.api.routes.expenses import (
    _normalize_expense_category,
    _normalize_expense_status,
    _normalize_datetime_like,
)

# ── Shared test data ───────────────────────────────────────────────────────────

EXPENSE_ID = str(uuid4())
LOCAL_ID   = str(uuid4())

_EXPENSE = {
    "id": EXPENSE_ID,
    "local_id": LOCAL_ID,
    "category": "supplies",
    "amount": 5000,
    "expense_date": "2026-05-05T00:00:00+00:00",
    "description": "Harina",
    "receipt_url": None,
    "status": "pending",
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _user(role="ADMIN"):
    return {
        "user_id": "u1", "id": "u1", "email": "a@b.com",
        "role": role, "is_active": True, "business_id": str(uuid4()),
    }


def _simple_db(data=None):
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
        data if data is not None else [_EXPENSE]
    )
    db.table.return_value.insert.return_value.execute.return_value.data = [_EXPENSE]
    db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [_EXPENSE]
    db.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock()
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


# ── Unit: _normalize_expense_category ─────────────────────────────────────────

class TestNormalizeCategory:
    def test_supplies_passthrough(self):
        assert _normalize_expense_category("supplies") == "supplies"

    def test_insumos_to_supplies(self):
        assert _normalize_expense_category("insumos") == "supplies"

    def test_servicios_to_utilities(self):
        assert _normalize_expense_category("servicios") == "utilities"

    def test_utilities_passthrough(self):
        assert _normalize_expense_category("utilities") == "utilities"

    def test_mantenimiento_to_maintenance(self):
        assert _normalize_expense_category("mantenimiento") == "maintenance"

    def test_personal_to_staff(self):
        assert _normalize_expense_category("personal") == "staff"

    def test_staff_passthrough(self):
        assert _normalize_expense_category("staff") == "staff"

    def test_otros_to_other(self):
        assert _normalize_expense_category("otros") == "other"

    def test_unknown_passthrough(self):
        assert _normalize_expense_category("random") == "random"

    def test_none_becomes_empty(self):
        assert _normalize_expense_category(None) == ""


# ── Unit: _normalize_expense_status ───────────────────────────────────────────

class TestNormalizeStatus:
    def test_pending_passthrough(self):
        assert _normalize_expense_status("pending") == "pending"

    def test_approved_passthrough(self):
        assert _normalize_expense_status("approved") == "approved"

    def test_rejected_passthrough(self):
        assert _normalize_expense_status("rejected") == "rejected"

    def test_validated_maps_to_approved(self):
        assert _normalize_expense_status("validated") == "approved"

    def test_none_becomes_empty(self):
        assert _normalize_expense_status(None) == ""


# ── Unit: _normalize_datetime_like ────────────────────────────────────────────

class TestNormalizeDatetime:
    def test_none_returns_none(self):
        assert _normalize_datetime_like(None) is None

    def test_date_string_gets_time_appended(self):
        result = _normalize_datetime_like("2026-05-05")
        assert result == "2026-05-05T00:00:00+00:00"

    def test_iso_datetime_passthrough(self):
        iso = "2026-05-05T12:30:00+00:00"
        assert _normalize_datetime_like(iso) == iso

    def test_empty_string_returns_none(self):
        assert _normalize_datetime_like("") is None

    def test_datetime_object_returns_isoformat(self):
        from datetime import datetime, timezone
        dt = datetime(2026, 5, 5, 12, 0, 0, tzinfo=timezone.utc)
        result = _normalize_datetime_like(dt)
        assert "2026-05-05" in result


# ── GET /expenses ──────────────────────────────────────────────────────────────

class TestListExpenses:
    def test_requires_local_id(self):
        with _override() as client:
            r = client.get("/api/expenses")
        assert r.status_code == 422

    def test_returns_expenses_list(self):
        with _override() as client:
            r = client.get(f"/api/expenses?local_id={LOCAL_ID}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_status_filter_pending(self):
        with _override() as client:
            r = client.get(f"/api/expenses?local_id={LOCAL_ID}&status=pending")
        assert r.status_code == 200
        body = r.json()
        # _EXPENSE has status=pending so it should appear
        assert len(body) == 1

    def test_status_filter_validated_maps_to_approved(self):
        # "validated" normalizes to "approved" — _EXPENSE is "pending" → filtered out
        with _override() as client:
            r = client.get(f"/api/expenses?local_id={LOCAL_ID}&status=validated")
        assert r.status_code == 200
        assert r.json() == []

    def test_status_filter_no_match_returns_empty(self):
        with _override() as client:
            r = client.get(f"/api/expenses?local_id={LOCAL_ID}&status=rejected")
        assert r.status_code == 200
        assert r.json() == []


# ── POST /expenses ─────────────────────────────────────────────────────────────

class TestCreateExpense:
    _payload = {
        "local_id": LOCAL_ID,
        "category": "supplies",
        "amount": 5000,
    }

    def test_admin_can_create(self):
        with _override("ADMIN") as client:
            r = client.post("/api/expenses", json=self._payload)
        assert r.status_code == 200

    def test_cajero_can_create(self):
        with _override("CAJERO") as client:
            r = client.post("/api/expenses", json=self._payload)
        assert r.status_code == 200

    def test_empleado_forbidden(self):
        with _override("EMPLEADO") as client:
            r = client.post("/api/expenses", json=self._payload)
        assert r.status_code == 403

    def test_guest_forbidden(self):
        with _override("GUEST") as client:
            r = client.post("/api/expenses", json=self._payload)
        assert r.status_code == 403

    def test_amount_zero_rejected(self):
        payload = {**self._payload, "amount": 0}
        with _override("ADMIN") as client:
            r = client.post("/api/expenses", json=payload)
        assert r.status_code == 422

    def test_invalid_category_rejected(self):
        payload = {**self._payload, "category": "invalidcat"}
        with _override("ADMIN") as client:
            r = client.post("/api/expenses", json=payload)
        assert r.status_code == 422


# ── GET /expenses/{id} ────────────────────────────────────────────────────────

class TestGetExpense:
    def test_returns_expense(self):
        with _override() as client:
            r = client.get(f"/api/expenses/{EXPENSE_ID}")
        assert r.status_code == 200
        assert r.json()["id"] == EXPENSE_ID

    def test_404_when_not_found(self):
        db = _simple_db(data=[])
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/expenses/{EXPENSE_ID}")
        assert r.status_code == 404


# ── PATCH /expenses/{id} ──────────────────────────────────────────────────────

class TestUpdateExpense:
    def test_admin_can_update(self):
        with _override("ADMIN") as client:
            r = client.patch(f"/api/expenses/{EXPENSE_ID}", json={"amount": 9000})
        assert r.status_code == 200

    def test_cajero_forbidden(self):
        with _override("CAJERO") as client:
            r = client.patch(f"/api/expenses/{EXPENSE_ID}", json={"amount": 9000})
        assert r.status_code == 403

    def test_empleado_forbidden(self):
        with _override("EMPLEADO") as client:
            r = client.patch(f"/api/expenses/{EXPENSE_ID}", json={"amount": 9000})
        assert r.status_code == 403

    def test_404_when_not_found(self):
        db = MagicMock()
        db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []
        with _override("ADMIN", db) as client:
            r = client.patch(f"/api/expenses/{EXPENSE_ID}", json={"amount": 9000})
        assert r.status_code == 404


# ── DELETE /expenses/{id} ─────────────────────────────────────────────────────

class TestDeleteExpense:
    def test_superadmin_can_delete(self):
        with _override("SUPERADMIN") as client:
            r = client.delete(f"/api/expenses/{EXPENSE_ID}")
        assert r.status_code == 204

    def test_admin_forbidden(self):
        with _override("ADMIN") as client:
            r = client.delete(f"/api/expenses/{EXPENSE_ID}")
        assert r.status_code == 403

    def test_cajero_forbidden(self):
        with _override("CAJERO") as client:
            r = client.delete(f"/api/expenses/{EXPENSE_ID}")
        assert r.status_code == 403
