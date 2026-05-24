from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from .supplier_service import assert_supplier_belongs_to_business

logger = logging.getLogger(__name__)

ALLOWED_STATUSES = frozenset(
    {
        "draft",
        "sent",
        "in_transit",
        "partially_received",
        "received",
        "cancelled",
    }
)


def _iso_date(value: Any) -> str:
    if value is None:
        return ""
    s = str(value)
    return s[:10] if len(s) >= 10 else s


def _line_total_clp(qty: Any, unit_price: Any) -> int:
    try:
        return int(round(float(qty) * float(unit_price)))
    except (TypeError, ValueError):
        return 0


def _enrich_item(row: dict) -> dict:
    out = dict(row)
    out["line_total_estimated_clp"] = _line_total_clp(out.get("quantity_ordered"), out.get("unit_price_clp", 0))
    for k in ("id", "product_id", "order_id"):
        if out.get(k) is not None:
            out[k] = str(out[k]).strip()
    return out


def _order_total_from_items(items: list[dict]) -> int:
    t = 0
    for it in items:
        t += _line_total_clp(it.get("quantity_ordered"), it.get("unit_price_clp", 0))
    return t


def _line_received_clp(qty_received: Any, unit_price: Any) -> int:
    try:
        return int(round(float(qty_received) * float(unit_price)))
    except (TypeError, ValueError):
        return 0


def _received_totals_by_order(db, order_ids: list[str]) -> dict[str, int]:
    if not order_ids:
        return {}
    r = (
        db.table("weekly_purchase_order_items")
        .select("order_id,quantity_received,unit_price_clp")
        .in_("order_id", order_ids)
        .execute()
    )
    out: dict[str, int] = {}
    for it in r.data or []:
        oid = str(it.get("order_id") or "").strip()
        if not oid:
            continue
        out[oid] = out.get(oid, 0) + _line_received_clp(it.get("quantity_received"), it.get("unit_price_clp", 0))
    return out


def _fetch_product_for_supplier(db, product_id: str, supplier_id: str) -> dict | None:
    r = (
        db.table("products")
        .select("id,name,supplier_id")
        .eq("id", str(product_id))
        .limit(1)
        .execute()
    )
    rows = r.data or []
    if not rows:
        return None
    row = rows[0]
    if str(row.get("supplier_id") or "") != str(supplier_id):
        return None
    return row


def _fetch_items(db, order_id: str) -> list[dict]:
    r = db.table("weekly_purchase_order_items").select("*").eq("order_id", str(order_id)).execute()
    return [_enrich_item(x) for x in (r.data or [])]


def _recalc_order_total(db, order_id: str) -> int:
    items = _fetch_items(db, order_id)
    total = _order_total_from_items(items)
    db.table("weekly_purchase_orders").update(
        {"total_estimated_clp": total, "updated_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", str(order_id)).execute()
    return total


def get_weekly_purchase_orders_list(
    db,
    business_id: str,
    *,
    week_start: str | None = None,
    supplier_id: str | None = None,
    status: str | None = None,
) -> list[dict]:
    q = db.table("weekly_purchase_orders").select("*").eq("business_id", str(business_id))
    if week_start and str(week_start).strip():
        q = q.eq("week_start_date", str(week_start).strip()[:10])
    if supplier_id and str(supplier_id).strip():
        q = q.eq("supplier_id", str(supplier_id).strip())
    if status and str(status).strip():
        q = q.eq("status", str(status).strip())
    r = q.execute()
    rows = sorted(
        r.data or [],
        key=lambda x: str(x.get("week_start_date") or ""),
        reverse=True,
    )
    ids = [str(x.get("id")).strip() for x in rows if x.get("id")]
    received_map = _received_totals_by_order(db, ids)
    out = []
    for row in rows:
        x = dict(row)
        x["week_start_date"] = _iso_date(x.get("week_start_date"))
        for k in ("id", "business_id", "supplier_id", "local_id"):
            if x.get(k) is not None:
                x[k] = str(x[k]).strip()
        oid = str(x.get("id") or "").strip()
        x["total_received_clp"] = int(received_map.get(oid, 0))
        out.append(x)
    return out


def get_weekly_purchase_order_detail(db, order_id: str, business_id: str) -> dict | None:
    r = (
        db.table("weekly_purchase_orders")
        .select("*")
        .eq("id", str(order_id))
        .eq("business_id", str(business_id))
        .limit(1)
        .execute()
    )
    rows = r.data or []
    if not rows:
        return None
    order = dict(rows[0])
    order["week_start_date"] = _iso_date(order.get("week_start_date"))
    for k in ("id", "business_id", "supplier_id", "local_id"):
        if order.get(k) is not None:
            order[k] = str(order[k]).strip()
    order["items"] = _fetch_items(db, str(order_id))
    return order


def create_weekly_purchase_order(db, business_id: str, payload: dict) -> dict:
    supplier_id = str(payload["supplier_id"])
    assert_supplier_belongs_to_business(db, supplier_id, business_id)

    week_start = str(payload.get("week_start_date") or "").strip()[:10]
    if len(week_start) != 10:
        raise ValueError("week_start_date inválido (use YYYY-MM-DD)")

    items_in = payload.get("items") or []
    if not isinstance(items_in, list) or len(items_in) == 0:
        raise ValueError("Se requiere al menos una línea de producto")

    local_id = payload.get("local_id")
    insert_order = {
        "business_id": str(business_id),
        "supplier_id": supplier_id,
        "week_start_date": week_start,
        "status": "draft",
        "total_estimated_clp": 0,
    }
    if local_id:
        insert_order["local_id"] = str(local_id)

    oresp = db.table("weekly_purchase_orders").insert(insert_order).execute()
    orows = oresp.data or []
    if not orows:
        raise ValueError("No se pudo crear la orden")
    order_id = str(orows[0]["id"])

    item_rows: list[dict] = []
    for it in items_in:
        pid = str(it.get("product_id") or "").strip()
        if not pid:
            raise ValueError("Cada línea debe tener product_id")
        prod = _fetch_product_for_supplier(db, pid, supplier_id)
        if not prod:
            raise ValueError(f"Producto no válido para este proveedor: {pid}")
        qty = float(it.get("quantity_ordered") or 0)
        if qty <= 0:
            raise ValueError("quantity_ordered debe ser mayor a cero")
        price = int(round(float(it.get("unit_price_clp") or 0)))
        if price < 0:
            raise ValueError("unit_price_clp inválido")
        notes = it.get("line_notes")
        item_rows.append(
            {
                "order_id": order_id,
                "product_id": pid,
                "quantity_ordered": qty,
                "unit_price_clp": price,
                "line_notes": (str(notes).strip() if notes else None),
                "quantity_received": 0,
                "product_name_snapshot": str(prod.get("name") or "")[:500] or None,
            }
        )

    db.table("weekly_purchase_order_items").insert(item_rows).execute()
    _recalc_order_total(db, order_id)
    detail = get_weekly_purchase_order_detail(db, order_id, business_id)
    if not detail:
        raise ValueError("Orden creada pero no se pudo leer")
    return detail


def patch_weekly_purchase_order_status(db, order_id: str, business_id: str, status: str) -> dict:
    st = str(status or "").strip()
    if st not in ALLOWED_STATUSES:
        raise ValueError("Estado no permitido")

    cur = get_weekly_purchase_order_detail(db, order_id, business_id)
    if not cur:
        raise ValueError("Orden no encontrada")

    db.table("weekly_purchase_orders").update(
        {"status": st, "updated_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", str(order_id)).eq("business_id", str(business_id)).execute()

    detail = get_weekly_purchase_order_detail(db, order_id, business_id)
    if not detail:
        raise ValueError("No se pudo leer la orden actualizada")
    return detail


def replace_weekly_purchase_order_items(db, order_id: str, business_id: str, items_in: list) -> dict:
    cur = get_weekly_purchase_order_detail(db, order_id, business_id)
    if not cur:
        raise ValueError("Orden no encontrada")
    if cur.get("status") != "draft":
        raise ValueError("Solo se pueden editar líneas en borrador")

    supplier_id = str(cur.get("supplier_id"))
    if not isinstance(items_in, list) or len(items_in) == 0:
        raise ValueError("Se requiere al menos una línea")

    db.table("weekly_purchase_order_items").delete().eq("order_id", str(order_id)).execute()

    item_rows: list[dict] = []
    for it in items_in:
        pid = str(it.get("product_id") or "").strip()
        prod = _fetch_product_for_supplier(db, pid, supplier_id)
        if not prod:
            raise ValueError(f"Producto no válido para este proveedor: {pid}")
        qty = float(it.get("quantity_ordered") or 0)
        if qty <= 0:
            raise ValueError("quantity_ordered debe ser mayor a cero")
        price = int(round(float(it.get("unit_price_clp") or 0)))
        if price < 0:
            raise ValueError("unit_price_clp inválido")
        notes = it.get("line_notes")
        item_rows.append(
            {
                "order_id": str(order_id),
                "product_id": pid,
                "quantity_ordered": qty,
                "unit_price_clp": price,
                "line_notes": (str(notes).strip() if notes else None),
                "quantity_received": 0,
                "product_name_snapshot": str(prod.get("name") or "")[:500] or None,
            }
        )

    db.table("weekly_purchase_order_items").insert(item_rows).execute()
    _recalc_order_total(db, order_id)
    detail = get_weekly_purchase_order_detail(db, order_id, business_id)
    if not detail:
        raise ValueError("No se pudo leer la orden actualizada")
    return detail


def patch_line_reception(
    db,
    order_id: str,
    item_id: str,
    business_id: str,
    quantity_received: float,
) -> dict:
    cur = get_weekly_purchase_order_detail(db, order_id, business_id)
    if not cur:
        raise ValueError("Orden no encontrada")
    if cur.get("status") == "draft":
        raise ValueError("Recepción no aplica en borrador")

    qty = float(quantity_received)
    if qty < 0 or qty != qty:  # NaN
        raise ValueError("quantity_received inválida")

    r = (
        db.table("weekly_purchase_order_items")
        .select("id,order_id")
        .eq("id", str(item_id))
        .eq("order_id", str(order_id))
        .limit(1)
        .execute()
    )
    rows = r.data or []
    if not rows:
        raise ValueError("Línea no encontrada")

    db.table("weekly_purchase_order_items").update(
        {
            "quantity_received": qty,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", str(item_id)).execute()

    detail = get_weekly_purchase_order_detail(db, order_id, business_id)
    if not detail:
        raise ValueError("No se pudo leer la orden actualizada")
    return detail


def delete_weekly_purchase_order_draft(db, order_id: str, business_id: str) -> None:
    cur = get_weekly_purchase_order_detail(db, order_id, business_id)
    if not cur:
        raise ValueError("Orden no encontrada")
    if cur.get("status") != "draft":
        raise ValueError("Solo se pueden eliminar borradores")

    db.table("weekly_purchase_orders").delete().eq("id", str(order_id)).eq("business_id", str(business_id)).execute()


def get_comparison_report(db, business_id: str, week_from: str, week_to: str) -> dict:
    wf = str(week_from or "").strip()[:10]
    wt = str(week_to or "").strip()[:10]
    if len(wf) != 10 or len(wt) != 10:
        raise ValueError("week_from / week_to deben ser YYYY-MM-DD")

    r = (
        db.table("weekly_purchase_orders")
        .select("id,supplier_id,week_start_date,total_estimated_clp,status")
        .eq("business_id", str(business_id))
        .gte("week_start_date", wf)
        .lte("week_start_date", wt)
        .execute()
    )
    orders = r.data or []

    by_week: dict[str, dict[str, Any]] = {}
    by_supplier: dict[str, dict[str, Any]] = {}

    supplier_names: dict[str, str] = {}
    sids = list({str(o.get("supplier_id")) for o in orders if o.get("supplier_id")})
    if sids:
        try:
            for chunk_start in range(0, len(sids), 100):
                chunk = sids[chunk_start : chunk_start + 100]
                sr = db.table("suppliers").select("id,name").in_("id", chunk).execute()
                for row in sr.data or []:
                    if row.get("id"):
                        supplier_names[str(row["id"])] = str(row.get("name") or row["id"])
        except Exception as e:
            logger.warning("Reporte comparativo: no se pudieron cargar nombres de proveedor (%s)", e)

    for o in orders:
        if o.get("status") == "cancelled":
            continue
        wk = _iso_date(o.get("week_start_date"))
        te = int(round(float(o.get("total_estimated_clp") or 0)))
        agg_w = by_week.setdefault(wk, {"week_start_date": wk, "orders_count": 0, "total_estimated_clp": 0})
        agg_w["orders_count"] += 1
        agg_w["total_estimated_clp"] += te

        sid = str(o.get("supplier_id") or "")
        if sid:
            agg_s = by_supplier.setdefault(
                sid,
                {
                    "supplier_id": sid,
                    "supplier_name": supplier_names.get(sid, sid),
                    "orders_count": 0,
                    "total_estimated_clp": 0,
                },
            )
            agg_s["orders_count"] += 1
            agg_s["total_estimated_clp"] += te

    return {
        "by_week": sorted(by_week.values(), key=lambda x: x["week_start_date"]),
        "by_supplier": sorted(by_supplier.values(), key=lambda x: x.get("supplier_name") or ""),
    }
