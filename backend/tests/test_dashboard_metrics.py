from datetime import datetime, timedelta, timezone
from time import perf_counter
import sys
import types
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

# Add project root to path for direct test execution.
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.main import app
from src.deps import get_current_user, get_db
from src.api.routes import dashboard


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeTableQuery:
    def __init__(self, rows):
        self._rows = rows
        self._filters = []

    def select(self, *_columns):
        return self

    def eq(self, column, value):
        self._filters.append((column, value))
        return self

    def execute(self):
        data = self._rows
        for column, value in self._filters:
            data = [row for row in data if str(row.get(column)) == str(value)]
        return FakeResponse(data)


class FakeDB:
    def __init__(self, seed):
        self.seed = seed

    def table(self, table_name):
        return FakeTableQuery(self.seed.get(table_name, []))


@pytest.fixture
def ids():
    return {
        "business_id": uuid4(),
        "local_1": uuid4(),
        "local_2": uuid4(),
        "local_other": uuid4(),
        "product_a": uuid4(),
        "product_b": uuid4(),
    }


@pytest.fixture
def seeded_db(ids):
    now = datetime.now(timezone.utc)
    today_iso = now.isoformat()
    month_day_iso = (now - timedelta(days=3)).isoformat()
    prev_month_iso = (now - timedelta(days=40)).isoformat()

    order_1 = uuid4()
    order_2 = uuid4()
    order_cancelled = uuid4()
    order_other_local = uuid4()

    seed = {
        "locals": [
            {"id": str(ids["local_1"]), "business_id": str(ids["business_id"])},
            {"id": str(ids["local_2"]), "business_id": str(ids["business_id"])},
            {"id": str(ids["local_other"]), "business_id": str(uuid4())},
        ],
        "orders": [
            {
                "id": str(order_1),
                "local_id": str(ids["local_1"]),
                "status": "delivered",
                "total": 100.0,
                "created_at": today_iso,
            },
            {
                "id": str(order_2),
                "local_id": str(ids["local_2"]),
                "status": "ready",
                "total": 50.0,
                "created_at": month_day_iso,
            },
            {
                "id": str(order_cancelled),
                "local_id": str(ids["local_1"]),
                "status": "cancelled",
                "total": 999.0,
                "created_at": today_iso,
            },
            {
                "id": str(order_other_local),
                "local_id": str(ids["local_other"]),
                "status": "delivered",
                "total": 500.0,
                "created_at": today_iso,
            },
            {
                "id": str(uuid4()),
                "local_id": str(ids["local_1"]),
                "status": "delivered",
                "total": 80.0,
                "created_at": prev_month_iso,
            },
        ],
        "order_items": [
            {
                "id": str(uuid4()),
                "order_id": str(order_1),
                "product_id": str(ids["product_a"]),
                "quantity": 2,
                "total_price": 100.0,
            },
            {
                "id": str(uuid4()),
                "order_id": str(order_2),
                "product_id": str(ids["product_b"]),
                "quantity": 1,
                "total_price": 50.0,
            },
        ],
        "products": [
            {"id": str(ids["product_a"]), "name": "Ceviche"},
            {"id": str(ids["product_b"]), "name": "Pasta"},
        ],
        "expenses": [
            {
                "id": str(uuid4()),
                "local_id": str(ids["local_1"]),
                "status": "approved",
                "amount": 20.0,
                "expense_date": today_iso,
            },
            {
                "id": str(uuid4()),
                "local_id": str(ids["local_1"]),
                "status": "pending",
                "amount": 10.0,
                "expense_date": today_iso,
            },
        ],
        "transfers": [
            {
                "id": str(uuid4()),
                "local_id": str(ids["local_2"]),
                "status": "completed",
                "amount": 5.0,
                "created_at": today_iso,
            }
        ],
        "cajas": [
            {"id": str(uuid4()), "local_id": str(ids["local_1"]), "is_active": True},
            {"id": str(uuid4()), "local_id": str(ids["local_2"]), "is_active": False},
        ],
        "goals": [
            {
                "id": str(uuid4()),
                "local_id": str(ids["local_1"]),
                "period_month": now.month,
                "period_year": now.year,
                "target_amount": 200.0,
            }
        ],
        "alerts": [
            {"id": str(uuid4()), "local_id": str(ids["local_1"]), "is_read": False},
            {"id": str(uuid4()), "local_id": str(ids["local_2"]), "is_read": True},
        ],
        "users": [
            {
                "id": "admin-user-id",
                "email": "admin@test.com",
                "role": "ADMIN",
                "is_active": True,
            }
        ],
    }
    return FakeDB(seed)


@pytest.fixture
def client_admin(seeded_db):
    app.dependency_overrides[get_current_user] = lambda: {"role": "ADMIN", "user_id": "admin-user-id"}
    app.dependency_overrides[get_db] = lambda: seeded_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def client_empleado(seeded_db):
    app.dependency_overrides[get_current_user] = lambda: {"role": "EMPLEADO", "user_id": "emp-user-id"}
    app.dependency_overrides[get_db] = lambda: seeded_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def test_consolidated_metrics_forbidden_for_non_admin(client_empleado, ids):
    response = client_empleado.get(
        "/api/dashboard/consolidated",
        params={"business_id": str(ids["business_id"])},
    )
    assert response.status_code == 403


def test_consolidated_metrics_aggregate_values(client_admin, ids):
    response = client_admin.get(
        "/api/dashboard/consolidated",
        params={"business_id": str(ids["business_id"])},
    )

    assert response.status_code == 200
    body = response.json()

    assert body["local_count"] == 2
    assert body["daily_sales"] == 100.0
    assert body["monthly_sales"] == 150.0
    assert body["monthly_cash_flow"] == 125.0

    assert body["petty_cash"]["active_cajas"] == 1
    assert body["petty_cash"]["total_cajas"] == 2
    assert body["petty_cash"]["pending_expenses_amount"] == 10.0
    assert body["petty_cash"]["status"] == "healthy"

    assert body["monthly_goal"]["target_amount"] == 200.0
    assert body["monthly_goal"]["achieved_amount"] == 150.0
    assert body["monthly_goal"]["progress_percentage"] == 75.0
    assert body["monthly_goal"]["remaining_amount"] == 50.0

    assert body["active_alerts"] == 1

    assert len(body["top_products"]) == 2
    assert body["top_products"][0]["product_name"] == "Ceviche"
    assert body["top_products"][0]["revenue"] == 100.0


def test_consolidated_metrics_cancelled_orders_are_excluded(client_admin, ids):
    response = client_admin.get(
        "/api/dashboard/consolidated",
        params={"business_id": str(ids["business_id"])},
    )

    assert response.status_code == 200
    body = response.json()

    # Cancelled order had total 999.0 and should not affect daily/monthly sales.
    assert body["daily_sales"] != 1099.0
    assert body["monthly_sales"] != 1149.0


def test_export_pdf_returns_pdf_content(client_admin, ids, monkeypatch):
    class FakeCanvas:
        def __init__(self, buffer, pagesize=None):
            self.buffer = buffer

        def drawString(self, *_args, **_kwargs):
            return None

        def showPage(self):
            return None

        def save(self):
            self.buffer.write(b"%PDF-FAKE")

    reportlab_module = types.ModuleType("reportlab")
    reportlab_lib_module = types.ModuleType("reportlab.lib")
    reportlab_pagesizes_module = types.ModuleType("reportlab.lib.pagesizes")
    setattr(reportlab_pagesizes_module, "A4", (595, 842))
    reportlab_pdfgen_module = types.ModuleType("reportlab.pdfgen")
    reportlab_canvas_module = types.ModuleType("reportlab.pdfgen.canvas")
    setattr(reportlab_canvas_module, "Canvas", FakeCanvas)

    monkeypatch.setitem(sys.modules, "reportlab", reportlab_module)
    monkeypatch.setitem(sys.modules, "reportlab.lib", reportlab_lib_module)
    monkeypatch.setitem(sys.modules, "reportlab.lib.pagesizes", reportlab_pagesizes_module)
    monkeypatch.setitem(sys.modules, "reportlab.pdfgen", reportlab_pdfgen_module)
    monkeypatch.setitem(sys.modules, "reportlab.pdfgen.canvas", reportlab_canvas_module)

    response = client_admin.get(
        "/api/dashboard/consolidated/export/pdf",
        params={"business_id": str(ids["business_id"])},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert "content-disposition" in response.headers


def test_consolidated_stream_sends_metrics_payload(seeded_db, ids, monkeypatch):
    monkeypatch.setattr(dashboard, "decode_token", lambda _token: {"sub": "admin-user-id"})
    monkeypatch.setattr(dashboard, "get_user_id_from_token", lambda payload: payload.get("sub"))
    monkeypatch.setattr(dashboard, "get_supabase_client", lambda: seeded_db)

    with TestClient(app) as client:
        with client.websocket_connect(
            f"/api/dashboard/consolidated/stream?business_id={ids['business_id']}&token=fake-token&refresh_seconds=2"
        ) as websocket:
            payload = websocket.receive_json()
            assert payload["business_id"] == str(ids["business_id"])
            assert payload["monthly_sales"] == 150.0


def test_consolidated_metrics_response_time_under_two_seconds(client_admin, ids):
    start = perf_counter()
    response = client_admin.get(
        "/api/dashboard/consolidated",
        params={"business_id": str(ids["business_id"])}
    )
    elapsed_seconds = perf_counter() - start

    assert response.status_code == 200
    assert elapsed_seconds < 2.0


def test_consolidated_metrics_response_time_stable_under_two_seconds(client_admin, ids):
    samples = []
    for _ in range(10):
        start = perf_counter()
        response = client_admin.get(
            "/api/dashboard/consolidated",
            params={"business_id": str(ids["business_id"])}
        )
        samples.append(perf_counter() - start)
        assert response.status_code == 200

    max_latency = max(samples)
    assert max_latency < 2.0
