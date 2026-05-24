from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Literal, Union
from uuid import UUID

_RE_STOCK_MAX = re.compile(r"Stock\s+m[aá]ximo:\s*(\d+)", re.IGNORECASE)
_RE_SUPPLIER = re.compile(r"Proveedor:\s*([^\.]+)", re.IGNORECASE)

_STOCK_STATUS_FILTER_ALLOWED = frozenset({"CRITICO", "BAJO", "OPTIMO"})

# % que se dispone respecto al tope: ratio = stock_actual / stock_máximo (0–1, ej. 0.4 = 40% del máximo).
# Sobre ese ratio: ≤25% crítico, ≤50% bajo, >50% óptimo. Sin máximo definido: solo agotado → crítico.
_STOCK_REF_CRIT_PCT = 0.25
_STOCK_REF_LOW_PCT = 0.50


def _stock_level_from_counts(
    stock_current: int,
    stock_max: int | None,
) -> Literal["critical", "low", "optimal"]:
    sc = int(stock_current or 0)
    smax_i: int | None = int(stock_max) if stock_max is not None and int(stock_max) > 0 else None

    if smax_i is None:
        return "critical" if sc <= 0 else "optimal"

    # Porcentaje de ocupación: cuánto hay frente al stock máximo configurado.
    ratio = sc / float(smax_i)
    if ratio <= _STOCK_REF_CRIT_PCT:
        return "critical"
    if ratio <= _STOCK_REF_LOW_PCT:
        return "low"
    return "optimal"


def _stock_status_api(level: Literal["critical", "low", "optimal"]) -> str:
    return {"critical": "CRITICO", "low": "BAJO", "optimal": "OPTIMO"}[level]


def _parse_stock_max(description: str | None) -> int | None:
    if not description:
        return None
    match = _RE_STOCK_MAX.search(description)
    return int(match.group(1)) if match else None


def _set_stock_max_in_description(description: str | None, max_stock: int) -> str:
    """Insert or replace 'Stock máximo: N' in the product description."""
    if max_stock <= 0:
        # Remove the pattern entirely when clearing the max
        if description:
            cleaned = _RE_STOCK_MAX.sub("", description).strip(" .")
            return cleaned
        return description or ""
    replacement = f"Stock máximo: {max_stock}"
    if not description:
        return replacement
    if _RE_STOCK_MAX.search(description):
        return _RE_STOCK_MAX.sub(replacement, description)
    return description.rstrip(". ") + f". {replacement}"


def _parse_supplier(description: str | None) -> str | None:
    if not description:
        return None
    match = _RE_SUPPLIER.search(description)
    return match.group(1).strip() if match else None


def _suppliers_name_map(db, supplier_ids: list[str]) -> dict[str, str]:
    ids = list(dict.fromkeys(str(i) for i in supplier_ids if i))
    if not ids:
        return {}
    try:
        response = db.table("suppliers").select("id,name").in_("id", ids).execute()
        rows = response.data or []
        return {str(r["id"]): (r.get("name") or "").strip() for r in rows}
    except Exception:
        return {}


def apply_inventory_stock_list_filters(
    items: list[dict],
    *,
    search: str | None = None,
    category_id: str | None = None,
    status_filters: list[str] | None = None,
) -> list[dict]:
    """Filtra filas ya construidas (misma semántica que query params del frontend: search, category, status[])."""
    needle = (search or "").strip().casefold()
    cat = (category_id or "").strip()
    status_set: frozenset[str] | None = None
    if status_filters:
        normalized = {str(s).strip().upper() for s in status_filters if s and str(s).strip()}
        allowed = normalized & _STOCK_STATUS_FILTER_ALLOWED
        if allowed:
            status_set = frozenset(allowed)

    if not needle and not cat and not status_set:
        return list(items)

    out: list[dict] = []
    for item in items:
        name = (item.get("product_name") or "").casefold()
        if needle and needle not in name:
            continue
        if cat and str(item.get("category_id") or "") != cat:
            continue
        if status_set and item.get("stock_status") not in status_set:
            continue
        out.append(item)
    return out


def build_inventory_stock_list_item(
    product: dict,
    inventory_row: dict,
    categories_by_id: dict[str, str],
    suppliers_by_id: dict[str, str],
) -> dict:
    """Single row for inventory stock list / KPIs (total_value = stock × unit cost from product.price)."""
    description = product.get("description")
    stock_current = int(inventory_row.get("stock") or 0)
    stock_min = int(inventory_row.get("min_stock") or 0)
    stock_max = _parse_stock_max(description)
    unit_cost_clp = int(product.get("price") or 0)
    level = _stock_level_from_counts(stock_current, stock_max)
    sid = product.get("supplier_id")
    sid_s = str(sid) if sid else ""
    supplier_name = suppliers_by_id.get(sid_s) if sid_s else None
    if not supplier_name:
        supplier_name = _parse_supplier(description)
    return {
        "inventory_id": inventory_row["id"],
        "product_id": product["id"],
        "category_id": product["category_id"],
        "product_name": product.get("name") or "",
        "category_name": categories_by_id.get(str(product.get("category_id")), "Sin categoría"),
        "stock_current": stock_current,
        "stock_min": stock_min,
        "stock_max": stock_max,
        "stock_status": _stock_status_api(level),
        "unit_cost_clp": unit_cost_clp,
        "total_value": stock_current * unit_cost_clp,
        "supplier_id": sid if sid else None,
        "supplier_name": supplier_name,
    }


def get_inventory_stock_list_for_local(db, local_id: Union[UUID, str]) -> list[dict]:
    inventory_response = db.table("inventory").select("id,product_id,stock,min_stock").eq("local_id", str(local_id)).execute()
    inventory_rows = inventory_response.data or []
    if not inventory_rows:
        return []

    product_ids = [str(row["product_id"]) for row in inventory_rows if row.get("product_id")]
    product_response = db.table("products").select("*").in_("id", product_ids).execute()
    products = product_response.data or []
    products_by_id = {str(product["id"]): product for product in products}

    # Fetch categories and suppliers in parallel — both depend on products, not on each other.
    category_ids = list({str(p["category_id"]) for p in products if p.get("category_id")})
    supplier_ids = list({str(p["supplier_id"]) for p in products if p.get("supplier_id")})

    categories_by_id: dict[str, str] = {}
    suppliers_by_id: dict[str, str] = {}

    def _fetch_categories():
        if not category_ids:
            return {}
        rows = db.table("categories").select("id,name").in_("id", category_ids).execute().data or []
        return {str(c["id"]): c.get("name") for c in rows}

    def _fetch_suppliers():
        return _suppliers_name_map(db, supplier_ids)

    with ThreadPoolExecutor(max_workers=2) as ex:
        f_cat = ex.submit(_fetch_categories)
        f_sup = ex.submit(_fetch_suppliers)
        categories_by_id = f_cat.result()
        suppliers_by_id = f_sup.result()

    result = []
    for row in inventory_rows:
        product = products_by_id.get(str(row.get("product_id")))
        if not product:
            continue
        result.append(build_inventory_stock_list_item(product, row, categories_by_id, suppliers_by_id))
    return result


def get_inventory_stock_list_for_local_filtered(
    db,
    local_id: Union[UUID, str],
    *,
    search: str | None = None,
    category_id: str | None = None,
    status_filters: list[str] | None = None,
) -> list[dict]:
    items = get_inventory_stock_list_for_local(db, local_id)
    return apply_inventory_stock_list_filters(
        items,
        search=search,
        category_id=category_id,
        status_filters=status_filters,
    )


def slice_inventory_page(items: list[dict], *, limit: int, offset: int) -> tuple[list[dict], int]:
    """Devuelve (página, total) con offset/limit acotados."""
    total = len(items)
    if offset < 0:
        offset = 0
    if limit < 1:
        return [], total
    return items[offset : offset + limit], total


def update_product_unit_cost_for_local(
    db,
    local_id: Union[UUID, str],
    product_id: Union[UUID, str],
    *,
    unit_cost_clp: int,
) -> dict | None:
    """Actualiza products.price si existe línea de inventario para ese local y producto; devuelve fila de listado recalculada."""
    inv_response = (
        db.table("inventory")
        .select("id,product_id,stock,min_stock")
        .eq("local_id", str(local_id))
        .eq("product_id", str(product_id))
        .execute()
    )
    rows = inv_response.data or []
    if not rows:
        return None
    cost = int(unit_cost_clp)
    if cost <= 0:
        raise ValueError("El costo unitario debe ser mayor que 0")
    db.table("products").update({"price": cost}).eq("id", str(product_id)).execute()
    return get_inventory_stock_line_for_product(db, local_id, product_id)


def get_inventory_stock_line_for_product(db, local_id: Union[UUID, str], product_id: Union[UUID, str]) -> dict | None:
    """Inventory line for one product in a local (after product edit, use fresh product row for recalculated total_value)."""
    inventory_response = (
        db.table("inventory")
        .select("id,product_id,stock,min_stock")
        .eq("local_id", str(local_id))
        .eq("product_id", str(product_id))
        .execute()
    )
    inventory_rows = inventory_response.data or []
    if not inventory_rows:
        return None
    row = inventory_rows[0]

    product_response = db.table("products").select("*").eq("id", str(product_id)).execute()
    products = product_response.data or []
    if not products:
        return None
    product = products[0]

    category_id = str(product.get("category_id") or "")
    if not category_id:
        return None
    category_response = db.table("categories").select("id,name").eq("id", category_id).execute()
    categories = category_response.data or []
    categories_by_id = {str(c["id"]): c.get("name") for c in categories}

    sid = product.get("supplier_id")
    suppliers_by_id = _suppliers_name_map(db, [str(sid)] if sid else [])

    return build_inventory_stock_list_item(product, row, categories_by_id, suppliers_by_id)


def update_inventory_stock_for_local(
    db,
    local_id: Union[UUID, str],
    inventory_id: Union[UUID, str],
    *,
    stock: int | None,
    min_stock: int | None,
    max_stock: int | None = None,
) -> dict | None:
    """Update stock/min_stock for one inventory row; returns list row with recalculated total_value."""
    inv_response = (
        db.table("inventory")
        .select("id,product_id,stock,min_stock")
        .eq("local_id", str(local_id))
        .eq("id", str(inventory_id))
        .execute()
    )
    rows = inv_response.data or []
    if not rows:
        return None

    row = rows[0]
    product_id = str(row.get("product_id") or "")
    if not product_id:
        return None

    update_payload: dict = {}
    if stock is not None:
        update_payload["stock"] = int(stock)
    if min_stock is not None:
        update_payload["min_stock"] = int(min_stock)

    if update_payload:
        db.table("inventory").update(update_payload).eq("id", str(inventory_id)).eq("local_id", str(local_id)).execute()

    if max_stock is not None:
        prod_resp = db.table("products").select("id,description").eq("id", product_id).execute()
        if prod_resp.data:
            current_desc = prod_resp.data[0].get("description")
            new_desc = _set_stock_max_in_description(current_desc, int(max_stock))
            db.table("products").update({"description": new_desc}).eq("id", product_id).execute()

    return get_inventory_stock_line_for_product(db, local_id, product_id)


def aggregate_inventory_kpis_from_items(items: list[dict]) -> dict:
    """Agregados para tarjetas KPI (misma lógica de niveles que el listado)."""
    if not items:
        return {
            "total_products": 0,
            "optimal_stock_count": 0,
            "low_stock_count": 0,
            "critical_stock_count": 0,
            "total_value": 0,
        }

    optimal_stock_count = 0
    low_stock_count = 0
    critical_stock_count = 0
    total_value = 0

    for item in items:
        stock_current = int(item.get("stock_current") or 0)
        stock_max = item.get("stock_max")
        unit_cost = int(item.get("unit_cost_clp") or 0)
        total_value += int(item.get("total_value") or (stock_current * unit_cost))

        level = _stock_level_from_counts(
            stock_current,
            int(stock_max) if stock_max is not None else None,
        )
        if level == "critical":
            critical_stock_count += 1
        elif level == "low":
            low_stock_count += 1
        else:
            optimal_stock_count += 1

    return {
        "total_products": len(items),
        "optimal_stock_count": optimal_stock_count,
        "low_stock_count": low_stock_count,
        "critical_stock_count": critical_stock_count,
        "total_value": total_value,
    }


def get_inventory_kpis_for_local(db, local_id: Union[UUID, str]) -> dict:
    items = get_inventory_stock_list_for_local(db, local_id)
    return aggregate_inventory_kpis_from_items(items)
