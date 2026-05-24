from datetime import date
import sys
from pathlib import Path
from uuid import uuid4

# Add project root to path for direct test execution.
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services.supplier_kpis_service import (
    _expense_in_calendar_month,
    _normalize_expense_category,
    _normalize_expense_status,
    _parse_expense_day,
    _safe_int_clp,
)


def test_parse_expense_day_iso_date():
    assert _parse_expense_day("2026-03-05") == date(2026, 3, 5)


def test_expense_in_calendar_month_uses_expense_date():
    row = {"expense_date": "2026-04-10", "created_at": "2026-01-01"}
    assert _expense_in_calendar_month(row, 2026, 4) is True
    assert _expense_in_calendar_month(row, 2026, 5) is False


def test_expense_in_month_fallback_created_at():
    row = {"expense_date": None, "created_at": "2026-02-28T12:00:00Z"}
    assert _expense_in_calendar_month(row, 2026, 2) is True


def test_expense_in_month_respects_chile_timezone_boundary():
    row = {"expense_date": None, "created_at": "2026-04-01T02:30:00Z"}
    # In Chile this timestamp is still March 31st, so it should count for March.
    assert _expense_in_calendar_month(row, 2026, 3) is True
    assert _expense_in_calendar_month(row, 2026, 4) is False


def test_normalize_category_supplies():
    assert _normalize_expense_category("INSUMOS") == "supplies"
    assert _normalize_expense_category("supplies") == "supplies"


def test_normalize_status_approved():
    assert _normalize_expense_status("validated") == "approved"
    assert _normalize_expense_status("approved") == "approved"


def test_safe_int_clp_accepts_decimal_strings():
    assert _safe_int_clp("1234.56") == 1235
    assert _safe_int_clp(99.9) == 100
    assert _safe_int_clp(None) == 0
    assert _safe_int_clp("not-a-number") == 0


class _FakeResponse:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self, rows):
        self._rows = rows
        self._eq = []
        self._in = []

    def select(self, *_columns):
        return self

    def eq(self, column, value):
        self._eq.append((column, str(value)))
        return self

    def in_(self, column, values):
        self._in.append((column, {str(v) for v in values}))
        return self

    def execute(self):
        data = self._rows
        for column, value in self._eq:
            data = [row for row in data if str(row.get(column)) == value]
        for column, values in self._in:
            data = [row for row in data if str(row.get(column)) in values]
        return _FakeResponse(data)


class _FakeDB:
    def __init__(self, seed):
        self._seed = seed

    def table(self, table_name):
        return _FakeTable(self._seed.get(table_name, []))


def test_get_supplier_kpis_includes_monthly_purchases_only_for_month():
    from src.services.supplier_kpis_service import get_supplier_kpis_for_business

    business_id = str(uuid4())
    local_id = str(uuid4())
    seed = {
        "suppliers": [
            {"id": str(uuid4()), "business_id": business_id, "is_active": True},
            {"id": str(uuid4()), "business_id": business_id, "is_active": False},
        ],
        "locals": [{"id": local_id, "business_id": business_id}],
        "expenses": [
            {
                "local_id": local_id,
                "category": "INSUMOS",
                "status": "validated",
                "amount": 1000,
                "created_at": "2026-03-10T12:00:00Z",
            },
            {
                # UTC April 1st, but still March in Chile.
                "local_id": local_id,
                "category": "supplies",
                "status": "approved",
                "amount": 500,
                "created_at": "2026-04-01T02:30:00Z",
            },
            {
                "local_id": local_id,
                "category": "supplies",
                "status": "approved",
                "amount": 700,
                "created_at": "2026-04-10T12:00:00Z",
            },
            {
                "local_id": local_id,
                "category": "other",
                "status": "approved",
                "amount": 9999,
                "created_at": "2026-03-20T12:00:00Z",
            },
        ],
    }
    db = _FakeDB(seed)

    march = get_supplier_kpis_for_business(db, business_id, 2026, 3)
    april = get_supplier_kpis_for_business(db, business_id, 2026, 4)

    assert march["total_suppliers"] == 2
    assert march["active_suppliers"] == 1
    assert march["month_purchases_clp"] == 1500
    assert april["month_purchases_clp"] == 700
