from __future__ import annotations

import logging

from ..schemas import SupplierCreate
from .supplier_validation import (
    non_empty_str,
    validate_chile_phone,
    validate_chile_rut,
    validate_email_normalized,
)

logger = logging.getLogger(__name__)


class SupplierNotFoundError(ValueError):
    pass


_IN_CHUNK = 120


def _chunk_ids(ids: list[str], size: int = _IN_CHUNK) -> list[list[str]]:
    if not ids:
        return []
    return [ids[i : i + size] for i in range(0, len(ids), size)]


def _safe_int_metric(value) -> int:
    if value is None:
        return 0
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return 0


def _sanitize_supplier_row_for_response(row: dict, metrics: dict | None = None) -> dict:
    """Evita errores de validación Pydantic (SupplierResponse) con datos nulos o tipos sueltos."""
    m = metrics or {}
    out = {**row, **m}
    if out.get("name") is None:
        out["name"] = ""
    ia = out.get("is_active")
    out["is_active"] = True if ia is None else bool(ia)
    out["purchased_products_count"] = _safe_int_metric(out.get("purchased_products_count", m.get("purchased_products_count", 0)))
    out["supplier_purchases_total_clp"] = _safe_int_metric(
        out.get("supplier_purchases_total_clp", m.get("supplier_purchases_total_clp", 0))
    )
    # UUID / strings desde PostgREST
    if out.get("id") is not None:
        out["id"] = str(out["id"]).strip()
    if out.get("business_id") is not None:
        out["business_id"] = str(out["business_id"]).strip()
    return out


def _supplier_has_extended_fields(payload: SupplierCreate) -> bool:
    return any(
        ((getattr(payload, field) or "").strip())
        for field in (
            "rut",
            "address",
            "category",
            "contact_name",
            "phone",
            "email",
        )
    )


def get_business_id_for_local(db, local_id: str) -> str:
    response = db.table("locals").select("business_id").eq("id", str(local_id)).limit(1).execute()
    rows = response.data or []
    if not rows or rows[0].get("business_id") is None:
        raise ValueError("Local no encontrado")
    return str(rows[0]["business_id"])


def list_suppliers_for_business(
    db,
    business_id: str,
    *,
    active_only: bool = True,
    search: str | None = None,
    category: str | None = None,
) -> list[dict]:
    # "*" evita 500 si aún no se aplicó la migración HU-86 (columnas extra en suppliers).
    q = db.table("suppliers").select("*").eq("business_id", str(business_id))
    if active_only:
        q = q.eq("is_active", True)
    name_q = (search or "").strip()
    if name_q:
        q = q.ilike("name", f"%{name_q}%")
    cat_q = (category or "").strip()
    if cat_q:
        q = q.ilike("category", f"%{cat_q}%")
    response = q.execute()
    rows = response.data or []
    return sorted(rows, key=lambda r: (r.get("name") or "").casefold())


def list_suppliers_with_purchase_metrics_for_business(
    db,
    business_id: str,
    *,
    active_only: bool = True,
    search: str | None = None,
    category: str | None = None,
) -> list[dict]:
    suppliers = list_suppliers_for_business(
        db,
        business_id,
        active_only=active_only,
        search=search,
        category=category,
    )
    suppliers = [r for r in suppliers if r.get("id") and r.get("business_id") is not None]
    if not suppliers:
        return []

    supplier_ids = [str(row["id"]) for row in suppliers]
    products: list[dict] = []
    if supplier_ids:
        try:
            for chunk in _chunk_ids(supplier_ids):
                products_resp = (
                    db.table("products")
                    .select("id,supplier_id,price")
                    .in_("supplier_id", chunk)
                    .execute()
                )
                products.extend(products_resp.data or [])
        except Exception as e:
            logger.warning("Métricas proveedores: falló consulta products (%s). Métricas en 0.", e)
            products = []

    product_ids = [str(row["id"]) for row in products if row.get("id")]
    inventory_rows: list[dict] = []
    if product_ids:
        try:
            for chunk in _chunk_ids(product_ids):
                inventory_resp = (
                    db.table("inventory").select("product_id,stock").in_("product_id", chunk).execute()
                )
                inventory_rows.extend(inventory_resp.data or [])
        except Exception as e:
            logger.warning("Métricas proveedores: falló consulta inventory (%s). Stock 0.", e)

    stock_by_product_id = {}
    for row in inventory_rows:
        product_id = row.get("product_id")
        if not product_id:
            continue
        stock_by_product_id[str(product_id)] = _safe_int_metric(row.get("stock"))

    aggregate_by_supplier_id: dict[str, dict[str, int]] = {}
    for product in products:
        supplier_id = product.get("supplier_id")
        product_id = product.get("id")
        if not supplier_id or not product_id:
            continue
        supplier_key = str(supplier_id)
        stock = stock_by_product_id.get(str(product_id), 0)
        unit_cost = _safe_int_metric(product.get("price"))
        summary = aggregate_by_supplier_id.setdefault(
            supplier_key,
            {"purchased_products_count": 0, "supplier_purchases_total_clp": 0},
        )
        summary["purchased_products_count"] += stock
        summary["supplier_purchases_total_clp"] += stock * unit_cost

    enriched = []
    for row in suppliers:
        sid = str(row.get("id"))
        metrics = aggregate_by_supplier_id.get(
            sid,
            {"purchased_products_count": 0, "supplier_purchases_total_clp": 0},
        )
        enriched.append(_sanitize_supplier_row_for_response(row, metrics))
    return enriched


def get_supplier_row(db, supplier_id: str) -> dict | None:
    response = (
        db.table("suppliers")
        .select("*")
        .eq("id", str(supplier_id))
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


def assert_supplier_belongs_to_business(db, supplier_id: str, business_id: str) -> dict:
    row = get_supplier_row(db, supplier_id)
    if not row:
        raise SupplierNotFoundError("Proveedor no encontrado")
    if str(row.get("business_id")) != str(business_id):
        raise ValueError("El proveedor no pertenece al negocio de este local")
    if row.get("is_active") is False:
        raise ValueError("El proveedor está inactivo")
    return row


def create_supplier(db, business_id: str, payload: SupplierCreate) -> dict:
    clean = (payload.name or "").strip()
    if not clean:
        raise ValueError("El nombre del proveedor es obligatorio")

    if not _supplier_has_extended_fields(payload):
        insert_row = {"business_id": str(business_id), "name": clean, "is_active": True}
    else:
        rut = validate_chile_rut(non_empty_str(payload.rut, "RUT"))
        address = non_empty_str(payload.address, "Dirección")
        category = non_empty_str(payload.category, "Categoría")
        contact_name = non_empty_str(payload.contact_name, "Contacto")
        phone = validate_chile_phone(non_empty_str(payload.phone, "Teléfono"))
        email = validate_email_normalized(non_empty_str(payload.email, "Email"))
        insert_row = {
            "business_id": str(business_id),
            "name": clean,
            "is_active": True,
            "rut": rut,
            "address": address,
            "category": category,
            "contact_name": contact_name,
            "phone": phone,
            "email": email,
        }

    sd = str(payload.start_date).strip() if payload.start_date else None
    if sd:
        insert_row["start_date"] = sd

    response = db.table("suppliers").insert(insert_row).execute()
    rows = response.data or []
    if not rows:
        raise ValueError("No se pudo crear el proveedor")
    return _sanitize_supplier_row_for_response(rows[0], {"purchased_products_count": 0, "supplier_purchases_total_clp": 0})


def get_supplier_detail_for_business(db, supplier_id: str, business_id: str) -> dict:
    supplier = get_supplier_row(db, supplier_id)
    if not supplier:
        raise SupplierNotFoundError("Proveedor no encontrado")
    if str(supplier.get("business_id")) != str(business_id):
        raise ValueError("Proveedor no pertenece al negocio indicado")

    products_resp = (
        db.table("products")
        .select("id,name,price")
        .eq("supplier_id", str(supplier_id))
        .execute()
    )
    products = products_resp.data or []
    product_ids = [str(p["id"]) for p in products if p.get("id")]

    stock_by_product_id: dict[str, int] = {}
    if product_ids:
        inventory_rows: list[dict] = []
        for chunk in _chunk_ids(product_ids):
            inventory_resp = db.table("inventory").select("product_id,stock").in_("product_id", chunk).execute()
            inventory_rows.extend(inventory_resp.data or [])
        for row in inventory_rows:
            pid = row.get("product_id")
            if not pid:
                continue
            stock_by_product_id[str(pid)] = _safe_int_metric(row.get("stock"))

    purchased_products: list[dict] = []
    total_units = 0
    total_clp = 0
    for product in products:
        pid = str(product.get("id") or "")
        if not pid:
            continue
        qty = stock_by_product_id.get(pid, 0)
        unit_price = _safe_int_metric(product.get("price"))
        line_total = qty * unit_price
        total_units += qty
        total_clp += line_total
        purchased_products.append(
            {
                "product_id": pid,
                "name": str(product.get("name") or ""),
                "quantity": qty,
                "unit_price_clp": unit_price,
                "line_total_clp": line_total,
            }
        )

    base = _sanitize_supplier_row_for_response(
        supplier,
        {
            "purchased_products_count": total_units,
            "supplier_purchases_total_clp": total_clp,
        },
    )
    base["purchased_products"] = purchased_products
    return base


def patch_supplier_for_business(db, supplier_id: str, business_id: str, payload: dict) -> dict:
    row = get_supplier_row(db, supplier_id)
    if not row:
        raise SupplierNotFoundError("Proveedor no encontrado")
    if str(row.get("business_id")) != str(business_id):
        raise ValueError("Proveedor no pertenece al negocio indicado")

    update_row = {}
    if "payment_terms_days" in payload:
        update_row["payment_terms_days"] = payload.get("payment_terms_days")
    if "delivery_lead_time_days" in payload:
        update_row["delivery_lead_time_days"] = payload.get("delivery_lead_time_days")
    if "commercial_notes" in payload:
        notes = payload.get("commercial_notes")
        update_row["commercial_notes"] = (str(notes).strip() if notes is not None else None) or None
    if "is_active" in payload and payload.get("is_active") is not None:
        update_row["is_active"] = bool(payload["is_active"])

    if not update_row:
        return _sanitize_supplier_row_for_response(row)

    updated_resp = (
        db.table("suppliers")
        .update(update_row)
        .eq("id", str(supplier_id))
        .eq("business_id", str(business_id))
        .execute()
    )
    updated_rows = updated_resp.data or []
    updated = updated_rows[0] if updated_rows else get_supplier_row(db, supplier_id) or row
    return _sanitize_supplier_row_for_response(updated)
