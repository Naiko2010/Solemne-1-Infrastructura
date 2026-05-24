from datetime import datetime, timezone
from io import BytesIO
from uuid import UUID
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse

from ...deps import get_current_user, get_db
from ...schemas import (
    ConsolidatedMetricsResponse,
    LocalAdminDashboardResponse,
    LocalResponse,
    MesasKPIResponse,
    MonthlyGoalMetric,
    PettyCashMetric,
    POSMenuResponse,
    POSReportesResponse,
    RendicionMovementMetric,
    RendicionesDashboardResponse,
    TopProductMetric,
)
from ...core.security import decode_token, get_user_id_from_token
from ...services.supabase_client import get_supabase_client


router = APIRouter()


def _to_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _month_start(value: datetime) -> datetime:
    return datetime(value.year, value.month, 1, tzinfo=timezone.utc)


def _normalize_utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _safe_table_query(
    db,
    table_name: str,
    columns: str = "*",
    eq_filters: dict[str, str] | None = None,
    in_filters: dict[str, list[str]] | None = None,
    gte_filters: dict[str, str] | None = None,
    lte_filters: dict[str, str] | None = None,
) -> list[dict]:
    try:
        query = db.table(table_name).select(columns)

        if eq_filters:
            for key, value in eq_filters.items():
                query = query.eq(key, value)

        if in_filters:
            for key, values in in_filters.items():
                normalized_values = [str(value) for value in values if value is not None]
                if normalized_values:
                    query = query.in_(key, normalized_values)

        if gte_filters:
            for key, value in gte_filters.items():
                query = query.gte(key, value)

        if lte_filters:
            for key, value in lte_filters.items():
                query = query.lte(key, value)

        response = query.execute()
        return response.data or []
    except Exception:
        # Some optional tables may not exist yet in early environments.
        return []


def _sum_order_total(orders: list[dict]) -> float:
    return float(sum(float(order.get("total") or 0) for order in orders))


def _sum_amount(items: list[dict]) -> float:
    return float(sum(float(item.get("amount") or 0) for item in items))


def _normalize_status(value: str | None) -> str:
    return str(value or "").strip().lower()


def _expense_status(value: str | None) -> str:
    normalized = _normalize_status(value)
    if normalized == "validated":
        return "approved"
    return normalized


def _transfer_status(value: str | None) -> str:
    normalized = _normalize_status(value)
    if normalized == "validated":
        return "completed"
    return normalized


def _compute_petty_cash(cajas: list[dict], pending_expenses: list[dict], monthly_sales: float) -> PettyCashMetric:
    active_cajas = sum(1 for caja in cajas if caja.get("is_active"))
    total_cajas = len(cajas)
    pending_amount = _sum_amount(pending_expenses)

    warning_threshold = monthly_sales * 0.15
    status_label = "healthy" if pending_amount <= warning_threshold else "warning"

    return PettyCashMetric(
        active_cajas=active_cajas,
        total_cajas=total_cajas,
        pending_expenses_amount=round(pending_amount, 2),
        status=status_label,
    )


def _compute_monthly_goal(goals: list[dict], monthly_sales: float, month: int, year: int) -> MonthlyGoalMetric:
    active_goals = [
        goal
        for goal in goals
        if int(goal.get("period_month") or 0) == month and int(goal.get("period_year") or 0) == year
    ]

    target_amount = float(sum(float(goal.get("target_amount") or 0) for goal in active_goals))
    progress_percentage = (monthly_sales / target_amount * 100.0) if target_amount > 0 else 0.0
    remaining_amount = max(target_amount - monthly_sales, 0.0)

    return MonthlyGoalMetric(
        target_amount=round(target_amount, 2),
        achieved_amount=round(monthly_sales, 2),
        progress_percentage=round(progress_percentage, 2),
        remaining_amount=round(remaining_amount, 2),
    )


def _compute_top_products(
    orders_this_month: list[dict],
    order_items: list[dict],
    products: list[dict],
) -> list[TopProductMetric]:
    order_ids = {order.get("id") for order in orders_this_month}
    monthly_items = [item for item in order_items if item.get("order_id") in order_ids]

    by_product: dict[str, dict] = {}
    for item in monthly_items:
        product_id = str(item.get("product_id"))
        if not product_id:
            continue

        if product_id not in by_product:
            by_product[product_id] = {"units": 0, "revenue": 0.0}

        by_product[product_id]["units"] += int(item.get("quantity") or 0)
        by_product[product_id]["revenue"] += float(item.get("total_price") or 0)

    product_name_map = {str(product.get("id")): product.get("name", "Producto") for product in products}

    ranked = sorted(
        by_product.items(),
        key=lambda row: row[1]["revenue"],
        reverse=True,
    )[:5]

    metrics: list[TopProductMetric] = []
    for product_id, values in ranked:
        try:
            product_uuid = UUID(product_id)
        except Exception:
            continue

        metrics.append(
            TopProductMetric(
                product_id=product_uuid,
                product_name=product_name_map.get(product_id, "Producto"),
                units_sold=int(values["units"]),
                revenue=round(float(values["revenue"]), 2),
            )
        )

    return metrics


async def _build_consolidated_metrics(db, business_id: UUID) -> ConsolidatedMetricsResponse:
    now = datetime.now(timezone.utc)
    month_start = _month_start(now)
    month_start_iso = month_start.isoformat()
    now_iso = now.isoformat()

    locals_data = await asyncio.to_thread(
        _safe_table_query,
        db,
        "locals",
        "id",
        {"business_id": str(business_id)},
    )
    local_ids = {str(local.get("id")) for local in locals_data if local.get("id")}

    if not local_ids:
        return ConsolidatedMetricsResponse(
            business_id=business_id,
            local_count=0,
            daily_sales=0.0,
            monthly_sales=0.0,
            monthly_cash_flow=0.0,
            petty_cash=PettyCashMetric(
                active_cajas=0,
                total_cajas=0,
                pending_expenses_amount=0.0,
                status="healthy",
            ),
            monthly_goal=MonthlyGoalMetric(
                target_amount=0.0,
                achieved_amount=0.0,
                progress_percentage=0.0,
                remaining_amount=0.0,
            ),
            active_alerts=0,
            top_products=[],
            generated_at=now,
        )

    orders_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "orders",
        "id,local_id,total,status,created_at",
        None,
        {"local_id": list(local_ids)},
        {"created_at": month_start_iso},
        {"created_at": now_iso},
    )
    products_future = asyncio.to_thread(_safe_table_query, db, "products", "id,name")
    expenses_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "expenses",
        "id,local_id,amount,status,expense_date",
        None,
        {"local_id": list(local_ids)},
    )
    transfers_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "transfers",
        "id,local_id,amount,status,created_at",
        None,
        {"local_id": list(local_ids)},
        {"created_at": month_start_iso},
        {"created_at": now_iso},
    )
    cajas_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "cajas",
        "id,local_id,is_active",
        None,
        {"local_id": list(local_ids)},
    )
    goals_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "goals",
        "id,local_id,period_month,period_year,target_amount",
        None,
        {"local_id": list(local_ids)},
    )
    alerts_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "administrative_alerts",
        "id,local_id,status",
        None,
        {"local_id": list(local_ids)},
    )

    (
        orders,
        products,
        expenses,
        transfers,
        cajas,
        goals,
        alerts,
    ) = await asyncio.gather(
        orders_future,
        products_future,
        expenses_future,
        transfers_future,
        cajas_future,
        goals_future,
        alerts_future,
    )

    valid_month_orders = []
    valid_day_orders = []
    for order in orders:
        order_date = _to_datetime(order.get("created_at"))
        if not order_date:
            continue

        if _normalize_status(order.get("status")) == "cancelled":
            continue

        valid_month_orders.append(order)

        if order_date.date() == now.date():
            valid_day_orders.append(order)

    daily_sales = _sum_order_total(valid_day_orders)
    monthly_sales = _sum_order_total(valid_month_orders)

    monthly_approved_expenses = []
    for expense in expenses:
        if _expense_status(expense.get("status")) != "approved":
            continue

        expense_date = _to_datetime(expense.get("expense_date")) or _to_datetime(expense.get("created_at"))
        if not expense_date:
            continue

        if expense_date.year == now.year and expense_date.month == now.month:
            monthly_approved_expenses.append(expense)

    monthly_completed_transfers = []
    for transfer in transfers:
        if _transfer_status(transfer.get("status")) != "completed":
            continue

        transfer_date = _to_datetime(transfer.get("created_at"))
        if not transfer_date:
            continue

        if transfer_date.year == now.year and transfer_date.month == now.month:
            monthly_completed_transfers.append(transfer)

    total_monthly_expenses = _sum_amount(monthly_approved_expenses)
    total_monthly_transfers = _sum_amount(monthly_completed_transfers)
    monthly_cash_flow = monthly_sales - total_monthly_expenses - total_monthly_transfers

    pending_expenses = [
        expense
        for expense in expenses
        if _expense_status(expense.get("status")) == "pending"
    ]

    month_order_ids = [str(order.get("id")) for order in valid_month_orders if order.get("id")]
    order_items = []
    if month_order_ids:
        order_items = await asyncio.to_thread(
            _safe_table_query,
            db,
            "order_items",
            "id,order_id,product_id,quantity,total_price",
            None,
            {"order_id": month_order_ids},
        )

    petty_cash = _compute_petty_cash(
        cajas=cajas,
        pending_expenses=pending_expenses,
        monthly_sales=monthly_sales,
    )

    monthly_goal = _compute_monthly_goal(
        goals=goals,
        monthly_sales=monthly_sales,
        month=now.month,
        year=now.year,
    )

    active_alerts = sum(1 for alert in alerts if alert.get("status") == "pending")

    top_products = _compute_top_products(
        orders_this_month=valid_month_orders,
        order_items=order_items,
        products=products,
    )

    return ConsolidatedMetricsResponse(
        business_id=business_id,
        local_count=len(local_ids),
        daily_sales=round(daily_sales, 2),
        monthly_sales=round(monthly_sales, 2),
        monthly_cash_flow=round(monthly_cash_flow, 2),
        petty_cash=petty_cash,
        monthly_goal=monthly_goal,
        active_alerts=active_alerts,
        top_products=top_products,
        generated_at=now,
    )


async def _build_local_admin_dashboard(db, local_id: UUID) -> LocalAdminDashboardResponse:
    """Build admin dashboard metrics for a specific local."""
    now = datetime.now(timezone.utc)
    month_start = _month_start(now)
    month_start_iso = month_start.isoformat()
    now_iso = now.isoformat()
    local_id_str = str(local_id)

    # Get local info
    local_response = db.table("locals").select("*").eq("id", local_id_str).execute()
    if not local_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Local not found",
        )
    local_data = local_response.data[0]
    local = LocalResponse(**local_data)

    # Fetch required data with local/date/status filters in query.
    orders_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "orders",
        "id,local_id,total,status,created_at",
        {"local_id": local_id_str},
        None,
        {"created_at": month_start_iso},
        {"created_at": now_iso},
    )
    products_future = asyncio.to_thread(_safe_table_query, db, "products", "id,name")
    expenses_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "expenses",
        "id,local_id,amount,status,expense_date",
        {"local_id": local_id_str},
    )
    transfers_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "transfers",
        "id,local_id,amount,status,created_at",
        {"local_id": local_id_str},
        None,
        {"created_at": month_start_iso},
        {"created_at": now_iso},
    )
    cajas_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "cajas",
        "id,local_id,is_active",
        {"local_id": local_id_str},
    )
    goals_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "goals",
        "id,local_id,period_month,period_year,target_amount",
        {"local_id": local_id_str},
    )
    alerts_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "administrative_alerts",
        "id,local_id,status",
        {"local_id": local_id_str},
    )

    (
        orders,
        products,
        expenses,
        transfers,
        cajas,
        goals,
        alerts,
    ) = await asyncio.gather(
        orders_future,
        products_future,
        expenses_future,
        transfers_future,
        cajas_future,
        goals_future,
        alerts_future,
    )

    # Calculate daily and monthly sales
    valid_month_orders = []
    valid_day_orders = []
    for order in orders:
        order_date = _to_datetime(order.get("created_at"))
        if not order_date:
            continue

        if _normalize_status(order.get("status")) == "cancelled":
            continue

        valid_month_orders.append(order)

        if order_date.date() == now.date():
            valid_day_orders.append(order)

    daily_sales = _sum_order_total(valid_day_orders)
    monthly_sales = _sum_order_total(valid_month_orders)

    # Calculate monthly expenses and transfers
    monthly_approved_expenses = []
    for expense in expenses:
        if _expense_status(expense.get("status")) != "approved":
            continue

        expense_date = _to_datetime(expense.get("expense_date")) or _to_datetime(expense.get("created_at"))
        if not expense_date:
            continue

        if expense_date.year == now.year and expense_date.month == now.month:
            monthly_approved_expenses.append(expense)

    monthly_completed_transfers = []
    for transfer in transfers:
        if _transfer_status(transfer.get("status")) != "completed":
            continue

        transfer_date = _to_datetime(transfer.get("created_at"))
        if not transfer_date:
            continue

        if transfer_date.year == now.year and transfer_date.month == now.month:
            monthly_completed_transfers.append(transfer)

    total_monthly_expenses = _sum_amount(monthly_approved_expenses)
    total_monthly_transfers = _sum_amount(monthly_completed_transfers)
    monthly_cash_flow = monthly_sales - total_monthly_expenses - total_monthly_transfers

    pending_expenses = [
        expense
        for expense in expenses
        if _expense_status(expense.get("status")) == "pending"
    ]

    month_order_ids = [str(order.get("id")) for order in valid_month_orders if order.get("id")]
    order_items = []
    if month_order_ids:
        order_items = await asyncio.to_thread(
            _safe_table_query,
            db,
            "order_items",
            "id,order_id,product_id,quantity,total_price",
            None,
            {"order_id": month_order_ids},
        )

    petty_cash = _compute_petty_cash(
        cajas=cajas,
        pending_expenses=pending_expenses,
        monthly_sales=monthly_sales,
    )

    monthly_goal = _compute_monthly_goal(
        goals=goals,
        monthly_sales=monthly_sales,
        month=now.month,
        year=now.year,
    )

    active_alerts = sum(1 for alert in alerts if alert.get("status") == "pending")

    top_products = _compute_top_products(
        orders_this_month=valid_month_orders,
        order_items=order_items,
        products=products,
    )

    cajas_count = len(cajas)
    active_cajas_count = sum(1 for caja in cajas if caja.get("is_active"))

    return LocalAdminDashboardResponse(
        local=local,
        daily_sales=round(daily_sales, 2),
        monthly_sales=round(monthly_sales, 2),
        monthly_cash_flow=round(monthly_cash_flow, 2),
        monthly_expenses=round(total_monthly_expenses, 2),
        monthly_transfers=round(total_monthly_transfers, 2),
        petty_cash=petty_cash,
        monthly_goal=monthly_goal,
        active_alerts=active_alerts,
        top_products=top_products,
        cajas_count=cajas_count,
        active_cajas_count=active_cajas_count,
        generated_at=now,
    )


def _safe_uuid(value: str | None) -> UUID | None:
    if not value:
        return None

    try:
        return UUID(str(value))
    except Exception:
        return None


async def _build_rendiciones_dashboard(
    db,
    local_id: UUID,
    start_date: datetime,
    end_date: datetime,
    movement_limit: int,
) -> RendicionesDashboardResponse:
    local_exists = await asyncio.to_thread(
        _safe_table_query,
        db,
        "locals",
        "id",
        {"id": str(local_id)},
    )
    if not local_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Local not found",
        )

    start_iso = start_date.isoformat()
    end_iso = end_date.isoformat()

    expenses_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "expenses",
        "id,local_id,amount,status,expense_date,description,receipt_url",
        {"local_id": str(local_id)},
        None,
    )
    transfers_future = asyncio.to_thread(
        _safe_table_query,
        db,
        "transfers",
        "id,local_id,amount,status,created_at,receipt_url",
        {"local_id": str(local_id)},
        None,
        {"created_at": start_iso},
        {"created_at": end_iso},
    )

    expenses, transfers = await asyncio.gather(expenses_future, transfers_future)

    approved_expenses_total = 0.0
    pending_expenses_total = 0.0
    completed_transfers_total = 0.0
    pending_transfers_total = 0.0
    movements: list[RendicionMovementMetric] = []

    for expense in expenses:
        occurred_at = _to_datetime(expense.get("expense_date")) or _to_datetime(expense.get("created_at"))
        if not occurred_at:
            continue

        occurred_at = _normalize_utc_datetime(occurred_at)
        if occurred_at < start_date or occurred_at > end_date:
            continue

        status_label = _expense_status(expense.get("status"))
        amount = float(expense.get("amount") or 0)

        if status_label == "approved":
            approved_expenses_total += amount
        elif status_label == "pending":
            pending_expenses_total += amount

        expense_id = _safe_uuid(expense.get("id"))
        if expense_id:
            movements.append(
                RendicionMovementMetric(
                    id=expense_id,
                    movement_type="expense",
                    amount=round(amount, 2),
                    status=status_label,
                    occurred_at=occurred_at,
                    description=expense.get("description"),
                    receipt_url=expense.get("receipt_url"),
                )
            )

    for transfer in transfers:
        occurred_at = _to_datetime(transfer.get("created_at"))
        if not occurred_at:
            continue

        occurred_at = _normalize_utc_datetime(occurred_at)
        if occurred_at < start_date or occurred_at > end_date:
            continue

        status_label = _transfer_status(transfer.get("status"))
        amount = float(transfer.get("amount") or 0)

        if status_label == "completed":
            completed_transfers_total += amount
        elif status_label == "pending":
            pending_transfers_total += amount

        transfer_id = _safe_uuid(transfer.get("id"))
        if transfer_id:
            movements.append(
                RendicionMovementMetric(
                    id=transfer_id,
                    movement_type="transfer",
                    amount=round(amount, 2),
                    status=status_label,
                    occurred_at=occurred_at,
                    receipt_url=transfer.get("receipt_url"),
                )
            )

    movements.sort(key=lambda movement: movement.occurred_at, reverse=True)
    movements = movements[:movement_limit]

    net_flow = completed_transfers_total - approved_expenses_total

    return RendicionesDashboardResponse(
        local_id=local_id,
        start_date=start_date,
        end_date=end_date,
        approved_expenses_total=round(approved_expenses_total, 2),
        pending_expenses_total=round(pending_expenses_total, 2),
        completed_transfers_total=round(completed_transfers_total, 2),
        pending_transfers_total=round(pending_transfers_total, 2),
        net_flow=round(net_flow, 2),
        movements=movements,
        generated_at=datetime.now(timezone.utc),
    )


def _extract_bearer_token(websocket: WebSocket) -> str | None:
    authorization = websocket.headers.get("authorization")
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1]

    query_token = websocket.query_params.get("token")
    if query_token:
        return query_token

    return None


def _authenticate_websocket_user(websocket: WebSocket) -> dict | None:
    token = _extract_bearer_token(websocket)
    if not token:
        return None

    payload = decode_token(token)
    user_id = get_user_id_from_token(payload)
    if not user_id:
        return None

    db = get_supabase_client()
    try:
        response = (
            db.table("users")
            .select("id,email,name,role,is_active")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None

        user = response.data[0]
        if not user.get("is_active"):
            return None

        return user
    except Exception:
        return None


@router.get("/dashboard/local/{local_id}", response_model=LocalAdminDashboardResponse)
async def get_local_admin_dashboard(
    local_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get admin dashboard metrics for a specific local."""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view local dashboard",
        )

    try:
        return await _build_local_admin_dashboard(db=db, local_id=local_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/dashboard/rendiciones", response_model=RendicionesDashboardResponse)
async def get_dashboard_rendiciones(
    local_id: UUID = Query(...),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    movement_limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get rendiciones summary with expense/transfer totals and detailed movements."""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view rendiciones metrics",
        )

    resolved_end = _normalize_utc_datetime(end_date or datetime.now(timezone.utc))
    resolved_start = _normalize_utc_datetime(start_date or _month_start(resolved_end))

    if resolved_start > resolved_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date",
        )

    try:
        return await _build_rendiciones_dashboard(
            db=db,
            local_id=local_id,
            start_date=resolved_start,
            end_date=resolved_end,
            movement_limit=movement_limit,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/dashboard/consolidated", response_model=ConsolidatedMetricsResponse)
async def get_consolidated_metrics(
    business_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get consolidated dashboard metrics for all locals in a business."""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view consolidated metrics",
        )

    try:
        return await _build_consolidated_metrics(db=db, business_id=business_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/dashboard/consolidated/export/pdf")
async def export_consolidated_metrics_pdf(
    business_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Export consolidated metrics report as PDF."""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can export consolidated metrics",
        )

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF export dependency missing. Install reportlab to enable this endpoint.",
        ) from exc

    metrics = await _build_consolidated_metrics(db=db, business_id=business_id)

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 40
    lines = [
        "Reporte Consolidado - Dashboard",
        f"Business ID: {metrics.business_id}",
        f"Fecha de generacion: {metrics.generated_at.isoformat()}",
        "",
        f"Locales activos: {metrics.local_count}",
        f"Ventas diarias: {metrics.daily_sales}",
        f"Ventas mensuales: {metrics.monthly_sales}",
        f"Flujo de caja mensual: {metrics.monthly_cash_flow}",
        f"Caja chica estado: {metrics.petty_cash.status}",
        f"Caja chica pendientes: {metrics.petty_cash.pending_expenses_amount}",
        f"Meta mensual objetivo: {metrics.monthly_goal.target_amount}",
        f"Meta mensual avance (%): {metrics.monthly_goal.progress_percentage}",
        f"Alertas activas: {metrics.active_alerts}",
        "",
        "Top productos del mes:",
    ]

    for product in metrics.top_products:
        lines.append(
            f"- {product.product_name}: unidades={product.units_sold}, ingreso={product.revenue}"
        )

    for line in lines:
        pdf.drawString(40, y, line)
        y -= 18
        if y < 50:
            pdf.showPage()
            y = height - 40

    pdf.save()
    buffer.seek(0)

    filename = f"dashboard_consolidado_{metrics.business_id}_{metrics.generated_at.date()}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/dashboard/mesas-kpis", response_model=MesasKPIResponse)
async def get_mesas_kpis(
    local_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get KPI summary for tables in a local: total, libres, ocupadas, en_cobro."""
    now = datetime.now(timezone.utc)

    mesas = await asyncio.to_thread(
        _safe_table_query,
        db,
        "mesas",
        "id,is_active",
        {"local_id": str(local_id)},
    )
    active_mesas = [m for m in mesas if m.get("is_active")]
    active_mesa_ids = {str(m["id"]) for m in active_mesas}
    total = len(active_mesas)

    orders = await asyncio.to_thread(
        _safe_table_query,
        db,
        "orders",
        "id,mesa_id,status",
        {"local_id": str(local_id)},
    )

    # Only consider non-cancelled, non-delivered orders with a mesa assigned
    mesa_status: dict[str, str] = {}
    for order in orders:
        mesa_id = str(order.get("mesa_id") or "")
        if mesa_id not in active_mesa_ids:
            continue
        status = str(order.get("status") or "").lower()
        if status in ("cancelled", "delivered"):
            continue
        # "ready" = en cobro; "pending"/"in_progress" = ocupada
        # Later statuses override earlier ones per mesa
        current = mesa_status.get(mesa_id, "")
        if status == "ready":
            mesa_status[mesa_id] = "en_cobro"
        elif status in ("pending", "in_progress") and current != "en_cobro":
            mesa_status[mesa_id] = "ocupada"

    ocupadas = sum(1 for s in mesa_status.values() if s == "ocupada")
    en_cobro = sum(1 for s in mesa_status.values() if s == "en_cobro")
    libres = total - ocupadas - en_cobro

    return MesasKPIResponse(
        local_id=local_id,
        total=total,
        libres=max(libres, 0),
        ocupadas=ocupadas,
        en_cobro=en_cobro,
        generated_at=now,
    )


@router.get("/dashboard/pos-reportes", response_model=POSReportesResponse)
async def get_pos_reportes(
    local_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    HU-64 SCRUM-468/502/503: Reportes básicos POS.
    Devuelve el producto más vendido, la bebida más vendida y el top 5
    de productos del local basado en todas las órdenes no canceladas.
    """
    now = datetime.now(timezone.utc)
    local_id_str = str(local_id)

    # Fetch mesas del local para filtrar órdenes por local_id
    # (orders no tiene local_id directo, se accede a través de mesas)
    mesas_for_local = await asyncio.to_thread(
        _safe_table_query, db, "mesas", "id", {"local_id": local_id_str}
    )
    local_mesa_ids = [str(m["id"]) for m in mesas_for_local]

    if not local_mesa_ids:
        return POSReportesResponse(
            local_id=local_id,
            top_producto=None,
            top_bebida=None,
            top_5=[],
            generated_at=now,
        )

    # Fetch orders (no canceladas) de esas mesas
    all_orders_resp = await asyncio.to_thread(
        lambda: db.table("orders")
        .select("id,status")
        .in_("mesa_id", local_mesa_ids)
        .execute()
    )
    active_order_ids = {
        str(o["id"])
        for o in (all_orders_resp.data or [])
        if str(o.get("status") or "").upper() != "CANCELLED"
    }

    if not active_order_ids:
        return POSReportesResponse(
            local_id=local_id,
            top_producto=None,
            top_bebida=None,
            top_5=[],
            generated_at=now,
        )

    # Fetch order_items de esas órdenes
    order_items_resp = await asyncio.to_thread(
        lambda: db.table("order_items")
        .select("order_id,product_id,quantity,total_price")
        .in_("order_id", list(active_order_ids))
        .execute()
    )
    order_items = order_items_resp.data or []

    # Fetch productos con su categoría para poder identificar bebidas
    products_resp = await asyncio.to_thread(
        lambda: db.table("products")
        .select("id,name,category_id")
        .execute()
    )
    products = products_resp.data or []

    # Fetch categorías para identificar cuáles son "bebidas"
    categories_resp = await asyncio.to_thread(
        lambda: db.table("categories")
        .select("id,name")
        .eq("local_id", local_id_str)
        .execute()
    )
    categories = categories_resp.data or []

    # Mapa: category_id → es_bebida (si el nombre contiene "bebida")
    bebida_cat_ids = {
        str(c["id"])
        for c in categories
        if any(kw in str(c.get("name") or "").lower() for kw in ("bebida", "jugo", "trago", "licor"))
    }

    # Mapa: product_id → {name, is_bebida}
    product_map = {
        str(p["id"]): {
            "name": p.get("name", "Producto"),
            "is_bebida": str(p.get("category_id") or "") in bebida_cat_ids,
        }
        for p in products
    }

    # SCRUM-503: Calcular top productos agregando por product_id
    by_product: dict[str, dict] = {}
    for item in order_items:
        pid = str(item.get("product_id") or "")
        if not pid or pid not in product_map:
            continue
        if pid not in by_product:
            by_product[pid] = {"units": 0, "revenue": 0}
        by_product[pid]["units"] += int(item.get("quantity") or 0)
        by_product[pid]["revenue"] += int(item.get("total_price") or 0)

    # Ordenar por unidades vendidas (criterio principal para POS)
    ranked = sorted(by_product.items(), key=lambda r: r[1]["units"], reverse=True)

    def _make_metric(pid: str, vals: dict) -> TopProductMetric:
        return TopProductMetric(
            product_id=UUID(pid),
            product_name=product_map[pid]["name"],
            units_sold=vals["units"],
            revenue=vals["revenue"],
        )

    top_5 = [_make_metric(pid, vals) for pid, vals in ranked[:5]]

    # Producto más vendido — excluir bebidas
    comida_ranked = [
        (pid, vals) for pid, vals in ranked
        if not product_map.get(pid, {}).get("is_bebida")
    ]
    top_producto = _make_metric(*comida_ranked[0]) if comida_ranked else None

    # Bebida más vendida — filtrar solo productos de categoría bebida
    bebida_ranked = [
        (pid, vals) for pid, vals in ranked
        if product_map.get(pid, {}).get("is_bebida")
    ]
    top_bebida = _make_metric(*bebida_ranked[0]) if bebida_ranked else None

    return POSReportesResponse(
        local_id=local_id,
        top_producto=top_producto,
        top_bebida=top_bebida,
        top_5=top_5,
        generated_at=now,
    )


def _product_matches_menu_search(product: dict, needle: str) -> bool:
    """HU-46: coincidencia por subcadena en nombre o descripción (sin distinguir mayúsculas)."""
    if not needle:
        return True
    n = needle.casefold()
    name = (product.get("name") or "").casefold()
    desc = (product.get("description") or "").casefold()
    return n in name or n in desc


@router.get("/dashboard/menu", response_model=POSMenuResponse)
async def get_pos_menu(
    local_id: UUID = Query(...),
    search: str | None = Query(
        None,
        description="HU-46 (SCRUM-429): filtra productos por nombre o descripción (?search=..., contiene, sin distinguir mayúsculas).",
    ),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    HU-65 SCRUM-469/505/506/507: Menú completo del local.
    Devuelve todas las categorías con sus productos activos,
    incluyendo conteo por categoría para los KPIs.
    HU-46: búsqueda opcional vía query `search`.
    """
    local_id_str = str(local_id)

    # Fetch categorías del local
    categories = await asyncio.to_thread(
        _safe_table_query, db, "categories", "id,name", {"local_id": local_id_str}
    )

    if not categories:
        return POSMenuResponse(local_id=local_id, total_products=0, categories=[])

    # Fetch todos los productos activos cuya categoría pertenece al local
    cat_ids = [str(c["id"]) for c in categories]
    products_resp = await asyncio.to_thread(
        lambda: db.table("products")
        .select("id,name,description,price,is_active,category_id")
        .in_("category_id", cat_ids)
        .eq("is_active", True)
        .execute()
    )
    all_products = products_resp.data or []

    if search and (needle := search.strip()):
        all_products = [p for p in all_products if _product_matches_menu_search(p, needle)]

    # Agrupar productos por category_id
    by_cat: dict[str, list] = {str(c["id"]): [] for c in categories}
    for p in all_products:
        cid = str(p.get("category_id") or "")
        if cid in by_cat:
            by_cat[cid].append(p)

    # Construir respuesta — solo categorías con productos
    category_groups = []
    for cat in sorted(categories, key=lambda c: c.get("name", "")):
        cid = str(cat["id"])
        prods = by_cat.get(cid, [])
        if not prods:
            continue
        category_groups.append({
            "id": cat["id"],
            "name": cat["name"],
            "product_count": len(prods),
            "products": [
                {
                    "id": p["id"],
                    "name": p.get("name", ""),
                    "description": p.get("description"),
                    "price": int(p.get("price") or 0),
                    "is_active": p.get("is_active", True),
                }
                for p in sorted(prods, key=lambda x: x.get("name", ""))
            ],
        })

    return POSMenuResponse(
        local_id=local_id,
        total_products=len(all_products),
        categories=category_groups,
    )


@router.websocket("/dashboard/consolidated/stream")
async def consolidated_metrics_stream(websocket: WebSocket):
    """Push consolidated metrics periodically for realtime dashboards."""
    user = _authenticate_websocket_user(websocket)
    if not user or user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        await websocket.close(code=1008)
        return

    business_id_raw = websocket.query_params.get("business_id")
    if not business_id_raw:
        await websocket.close(code=1008)
        return

    try:
        business_id = UUID(business_id_raw)
    except Exception:
        await websocket.close(code=1008)
        return

    try:
        refresh_seconds = int(websocket.query_params.get("refresh_seconds", "5"))
        refresh_seconds = max(2, min(refresh_seconds, 30))
    except Exception:
        refresh_seconds = 5

    await websocket.accept()

    db = get_supabase_client()
    try:
        while True:
            metrics = await _build_consolidated_metrics(db=db, business_id=business_id)
            await websocket.send_json(metrics.model_dump(mode="json"))
            await asyncio.sleep(refresh_seconds)
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=1011)
