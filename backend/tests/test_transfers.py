"""
Tests for /api/transfers endpoints + _normalize_transfer_status helper.
Covers: RBAC, CRUD, status normalization, status filter.
Key diff from expenses: DELETE allows ADMIN (not just SUPERADMIN).
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
from src.api.routes.transfers import _normalize_transfer_status

# ── Shared test data ───────────────────────────────────────────────────────────

TRANSFER_ID = str(uuid4())
LOCAL_ID    = str(uuid4())

_TRANSFER = {
    "id": TRANSFER_ID,
    "local_id": LOCAL_ID,
    "amount": 10000,
    "receipt_url": None,
    "status": "pending",
    "created_at": "2026-05-06T00:00:00+00:00",
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
        data if data is not None else [_TRANSFER]
    )
    db.table.return_value.insert.return_value.execute.return_value.data = [_TRANSFER]
    db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [_TRANSFER]
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


# ── Unit: _normalize_transfer_status ──────────────────────────────────────────

class TestNormalizeTransferStatus:
    def test_pending_passthrough(self):
        assert _normalize_transfer_status("pending") == "pending"

    def test_completed_passthrough(self):
        assert _normalize_transfer_status("completed") == "completed"

    def test_failed_passthrough(self):
        assert _normalize_transfer_status("failed") == "failed"

    def test_validated_maps_to_completed(self):
        # key difference from expenses: validated→completed (not approved)
        assert _normalize_transfer_status("validated") == "completed"

    def test_none_becomes_empty(self):
        assert _normalize_transfer_status(None) == ""

    def test_unknown_passthrough(self):
        assert _normalize_transfer_status("random") == "random"


# ── GET /transfers ─────────────────────────────────────────────────────────────

class TestListTransfers:
    def test_requires_local_id(self):
        with _override() as client:
            r = client.get("/api/transfers")
        assert r.status_code == 422

    def test_returns_transfers_list(self):
        with _override() as client:
            r = client.get(f"/api/transfers?local_id={LOCAL_ID}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_status_filter_pending_matches(self):
        with _override() as client:
            r = client.get(f"/api/transfers?local_id={LOCAL_ID}&status=pending")
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_status_filter_completed_no_match(self):
        # _TRANSFER is "pending" → filtered out when asking for "completed"
        with _override() as client:
            r = client.get(f"/api/transfers?local_id={LOCAL_ID}&status=completed")
        assert r.status_code == 200
        assert r.json() == []

    def test_status_filter_validated_maps_to_completed(self):
        # "validated" normalizes to "completed" — _TRANSFER is "pending" → filtered out
        with _override() as client:
            r = client.get(f"/api/transfers?local_id={LOCAL_ID}&status=validated")
        assert r.status_code == 200
        assert r.json() == []


# ── POST /transfers ────────────────────────────────────────────────────────────

class TestCreateTransfer:
    _payload = {"local_id": LOCAL_ID, "amount": 10000}

    def test_admin_can_create(self):
        with _override("ADMIN") as client:
            r = client.post("/api/transfers", json=self._payload)
        assert r.status_code == 200

    def test_cajero_can_create(self):
        with _override("CAJERO") as client:
            r = client.post("/api/transfers", json=self._payload)
        assert r.status_code == 200

    def test_empleado_forbidden(self):
        with _override("EMPLEADO") as client:
            r = client.post("/api/transfers", json=self._payload)
        assert r.status_code == 403

    def test_guest_forbidden(self):
        with _override("GUEST") as client:
            r = client.post("/api/transfers", json=self._payload)
        assert r.status_code == 403

    def test_amount_zero_rejected(self):
        with _override("ADMIN") as client:
            r = client.post("/api/transfers", json={"local_id": LOCAL_ID, "amount": 0})
        assert r.status_code == 422

    def test_missing_amount_rejected(self):
        with _override("ADMIN") as client:
            r = client.post("/api/transfers", json={"local_id": LOCAL_ID})
        assert r.status_code == 422


# ── GET /transfers/{id} ───────────────────────────────────────────────────────

class TestGetTransfer:
    def test_returns_transfer(self):
        with _override() as client:
            r = client.get(f"/api/transfers/{TRANSFER_ID}")
        assert r.status_code == 200
        assert r.json()["id"] == TRANSFER_ID

    def test_404_when_not_found(self):
        db = _simple_db(data=[])
        with _override("ADMIN", db) as client:
            r = client.get(f"/api/transfers/{TRANSFER_ID}")
        assert r.status_code == 404


# ── PATCH /transfers/{id} ─────────────────────────────────────────────────────

class TestUpdateTransfer:
    def test_admin_can_update(self):
        with _override("ADMIN") as client:
            r = client.patch(f"/api/transfers/{TRANSFER_ID}", json={"status": "completed"})
        assert r.status_code == 200

    def test_cajero_forbidden(self):
        with _override("CAJERO") as client:
            r = client.patch(f"/api/transfers/{TRANSFER_ID}", json={"status": "completed"})
        assert r.status_code == 403

    def test_empleado_forbidden(self):
        with _override("EMPLEADO") as client:
            r = client.patch(f"/api/transfers/{TRANSFER_ID}", json={"status": "completed"})
        assert r.status_code == 403

    def test_404_when_not_found(self):
        db = MagicMock()
        db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []
        with _override("ADMIN", db) as client:
            r = client.patch(f"/api/transfers/{TRANSFER_ID}", json={"status": "completed"})
        assert r.status_code == 404


# ── DELETE /transfers/{id} ────────────────────────────────────────────────────

class TestDeleteTransfer:
    def test_superadmin_can_delete(self):
        with _override("SUPERADMIN") as client:
            r = client.delete(f"/api/transfers/{TRANSFER_ID}")
        assert r.status_code == 204

    def test_admin_can_delete(self):
        # transfers allows ADMIN to delete — expenses does not (expenses = SUPERADMIN only)
        with _override("ADMIN") as client:
            r = client.delete(f"/api/transfers/{TRANSFER_ID}")
        assert r.status_code == 204

    def test_cajero_forbidden(self):
        with _override("CAJERO") as client:
            r = client.delete(f"/api/transfers/{TRANSFER_ID}")
        assert r.status_code == 403

    def test_empleado_forbidden(self):
        with _override("EMPLEADO") as client:
            r = client.delete(f"/api/transfers/{TRANSFER_ID}")
        assert r.status_code == 403
