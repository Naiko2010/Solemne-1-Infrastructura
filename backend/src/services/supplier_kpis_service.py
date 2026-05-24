from __future__ import annotations

import calendar
import logging
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

_IN_CHUNK = 120
_CHILE_TZ = ZoneInfo("America/Santiago")


def _chunk_ids(ids: list[str], size: int = _IN_CHUNK) -> list[list[str]]:
    if not ids:
        return []
    return [ids[i : i + size] for i in range(0, len(ids), size)]


def _normalize_expense_category(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    aliases = {
        "insumos": "supplies",
        "supplies": "supplies",
    }
    return aliases.get(normalized, normalized)


def _normalize_expense_status(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    aliases = {
        "validated": "approved",
        "approved": "approved",
        "pending": "pending",
        "rejected": "rejected",
    }
    return aliases.get(normalized, normalized)


def _parse_expense_day(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    text = str(value).strip()
    if not text:
        return None
    # Keep date-only values as calendar dates, but parse datetimes
    # to timezone-aware Chile day boundaries.
    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.date()
        return parsed.astimezone(_CHILE_TZ).date()
    except ValueError:
        return None


def _safe_int_clp(value: Any) -> int:
    """Convierte amount/montos desde DB (int, float, Decimal, string) sin lanzar."""
    if value is None:
        return 0
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return 0


def _expense_in_calendar_month(row: dict, year: int, month: int) -> bool:
    d = _parse_expense_day(row.get("expense_date")) or _parse_expense_day(row.get("created_at"))
    if d is None:
        return False
    last = calendar.monthrange(year, month)[1]
    start = date(year, month, 1)
    end = date(year, month, last)
    return start <= d <= end


def get_chile_now() -> datetime:
    return datetime.now(_CHILE_TZ)


def _empty_kpis_payload(year: int, month: int) -> dict:
    last = calendar.monthrange(year, month)[1]
    return {
        "total_suppliers": 0,
        "active_suppliers": 0,
        "month_purchases_clp": 0,
        "year": int(year),
        "month": int(month),
        "period_start": date(year, month, 1).isoformat(),
        "period_end": date(year, month, last).isoformat(),
    }


def get_supplier_kpis_for_business(db, business_id: str, year: int, month: int) -> dict:
    if month < 1 or month > 12:
        raise ValueError("Mes inválido")
    if year < 2000 or year > 2100:
        raise ValueError("Año inválido")

    if not db:
        logger.error("KPIs proveedores: cliente Supabase no disponible (db es None)")
        return _empty_kpis_payload(year, month)

    try:
        last = calendar.monthrange(year, month)[1]
        period_start = date(year, month, 1).isoformat()
        period_end = date(year, month, last).isoformat()

        supp_rows: list[dict] = []
        try:
            supp_resp = (
                db.table("suppliers").select("id,is_active").eq("business_id", str(business_id)).execute()
            )
            supp_rows = supp_resp.data or []
        except Exception as e:
            logger.warning("KPIs proveedores: no se pudo leer suppliers (%s). Contadores en 0.", e)

        total_suppliers = len(supp_rows)
        active_suppliers = sum(
            1
            for r in supp_rows
            if isinstance(r, dict) and r.get("is_active") is not False
        )

        local_ids: list[str] = []
        try:
            loc_resp = db.table("locals").select("id").eq("business_id", str(business_id)).execute()
            local_ids = [
                str(r["id"]) for r in (loc_resp.data or []) if isinstance(r, dict) and r.get("id")
            ]
        except Exception as e:
            logger.warning("KPIs proveedores: no se pudo leer locals (%s). Sin compras por local.", e)

        month_purchases_clp = 0
        if local_ids:
            try:
                for chunk in _chunk_ids(local_ids):
                    exp_resp = (
                        db.table("expenses")
                        .select("amount,category,expense_category,status,expense_date,created_at")
                        .in_("local_id", chunk)
                        .gte("expense_date", period_start)
                        .lte("expense_date", period_end)
                        .execute()
                    )
                    for row in exp_resp.data or []:
                        if not isinstance(row, dict):
                            continue
                        cat = row.get("category") or row.get("expense_category")
                        if _normalize_expense_category(cat) != "supplies":
                            continue
                        if _normalize_expense_status(row.get("status")) != "approved":
                            continue
                        if not _expense_in_calendar_month(row, year, month):
                            continue
                        month_purchases_clp += _safe_int_clp(row.get("amount"))
            except Exception as e:
                logger.warning("KPIs proveedores: no se pudo leer expenses (%s). month_purchases_clp=0.", e)

        return {
            "total_suppliers": int(total_suppliers),
            "active_suppliers": int(active_suppliers),
            "month_purchases_clp": int(month_purchases_clp),
            "year": int(year),
            "month": int(month),
            "period_start": str(period_start),
            "period_end": str(period_end),
        }
    except Exception as e:
        logger.exception("KPIs proveedores: error inesperado; se devuelven ceros (%s)", e)
        return _empty_kpis_payload(year, month)
