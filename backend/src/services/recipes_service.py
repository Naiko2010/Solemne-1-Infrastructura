from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from .supplier_service import get_business_id_for_local

_UNIT_TO_BASE: dict[str, tuple[str, float]] = {
    "kg": ("g", 1000.0),
    "g": ("g", 1.0),
    "l": ("ml", 1000.0),
    "ml": ("ml", 1.0),
    "unidad": ("unidad", 1.0),
    "un": ("unidad", 1.0),
}


def _normalize_unit(unit: str | None) -> str:
    return (unit or "unidad").strip().lower()


def _unit_to_base(unit: str | None) -> tuple[str, float]:
    normalized = _normalize_unit(unit)
    return _UNIT_TO_BASE.get(normalized, (normalized, 1.0))


def _conversion_factor(from_unit: str | None, to_unit: str | None) -> float:
    from_base, from_factor = _unit_to_base(from_unit)
    to_base, to_factor = _unit_to_base(to_unit)
    if from_base != to_base:
        return 1.0
    return from_factor / to_factor if to_factor else 1.0


def _parse_product_unit(description: str | None) -> str:
    raw = (description or "").lower()
    marker = "unidad:"
    if marker not in raw:
        return "unidad"
    candidate = raw.split(marker, 1)[1].split(".", 1)[0].strip()
    return _normalize_unit(candidate or "unidad")


def _safe_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


def _compute_financials(price_sale: int, yield_portions: int, ingredients: list[dict]) -> dict:
    total_cost = 0.0
    normalized_ingredients = []
    for item in ingredients:
        qty = _safe_float(item.get("quantity_required"), 0.0)
        unit_cost = _safe_int(item.get("unit_cost_clp"), 0)
        subtotal = qty * float(unit_cost)
        total_cost += subtotal
        normalized_ingredients.append(
            {
                **item,
                "quantity_required": qty,
                "unit_cost_clp": unit_cost,
                "ingredient_subtotal": int(round(subtotal)),
            }
        )

    sale = max(0, _safe_int(price_sale, 0))
    portions = max(1, _safe_int(yield_portions, 1))
    margin = 0.0
    if sale > 0:
        margin = ((sale - total_cost) / float(sale)) * 100.0

    return {
        "ingredients": normalized_ingredients,
        "total_cost": int(round(total_cost)),
        "profit_margin_percent": float(round(margin, 2)),
        "cost_per_portion": int(round(total_cost / float(portions))),
        "gross_profit": int(round(sale - total_cost)),
    }


def _get_products_map_for_local(db, local_id: str) -> dict[str, dict]:
    inv_rows = (
        db.table("inventory")
        .select("product_id,stock")
        .eq("local_id", str(local_id))
        .execute()
        .data
        or []
    )
    product_ids = [str(r.get("product_id")) for r in inv_rows if r.get("product_id")]
    if not product_ids:
        return {}
    products = db.table("products").select("id,name,price,description").in_("id", product_ids).execute().data or []
    stock_by_product = {str(r.get("product_id")): _safe_float(r.get("stock"), 0.0) for r in inv_rows}
    out = {}
    for p in products:
        pid = str(p.get("id"))
        out[pid] = {
            "id": pid,
            "name": p.get("name") or "",
            "unit_cost_clp": _safe_int(p.get("price"), 0),
            "unit": _parse_product_unit(p.get("description")),
            "stock": stock_by_product.get(pid, 0.0),
        }
    return out


def _hydrate_recipe_ingredients(db, recipe_id: str) -> list[dict]:
    # Compat: en algunas BD antiguas recipe_ingredients no tiene unit_cost_clp.
    rows = (
        db.table("recipe_ingredients")
        .select("id,recipe_id,product_id,quantity_required,unit")
        .eq("recipe_id", str(recipe_id))
        .execute()
        .data
        or []
    )
    if not rows:
        return []
    product_ids = [str(r.get("product_id")) for r in rows if r.get("product_id")]
    products = db.table("products").select("id,name,price").in_("id", product_ids).execute().data or []
    pmap = {str(p["id"]): p for p in products}
    hydrated = []
    for row in rows:
        pid = str(row.get("product_id"))
        p = pmap.get(pid, {})
        qty = _safe_float(row.get("quantity_required"), 0.0)
        unit_cost = _safe_int(p.get("price"), row.get("unit_cost_clp"))
        hydrated.append(
            {
                "id": row.get("id"),
                "recipe_id": row.get("recipe_id"),
                "product_id": pid,
                "product_name": p.get("name") or "Producto",
                "quantity_required": qty,
                "unit": row.get("unit") or "unidad",
                "unit_cost_clp": unit_cost,
                "ingredient_subtotal": int(round(qty * unit_cost)),
            }
        )
    return hydrated


def _insert_recipe_ingredient_row(db, row: dict) -> None:
    payload = {
        "recipe_id": row["recipe_id"],
        "product_id": row["product_id"],
        "quantity_required": row["quantity_required"],
        "unit": row["unit"],
        "unit_cost_clp": row["unit_cost_clp"],
    }
    try:
        db.table("recipe_ingredients").insert(payload).execute()
    except Exception as exc:
        msg = str(exc).lower()
        if "unit_cost_clp" in msg and "does not exist" in msg:
            fallback = {k: v for k, v in payload.items() if k != "unit_cost_clp"}
            db.table("recipe_ingredients").insert(fallback).execute()
            return
        raise


def _serialize_recipe_version(recipe_row: dict, ingredients: list[dict]) -> dict:
    return {
        "recipe": {
            "id": str(recipe_row.get("id")),
            "name": recipe_row.get("name"),
            "description": recipe_row.get("description"),
            "price_sale": _safe_int(recipe_row.get("price_sale"), 0),
            "yield_portions": _safe_int(recipe_row.get("yield_portions"), 1),
            "category_id": str(recipe_row.get("category_id")) if recipe_row.get("category_id") else None,
            "is_active": bool(recipe_row.get("is_active", True)),
        },
        "ingredients": [
            {
                "product_id": str(i.get("product_id")),
                "product_name": i.get("product_name"),
                "quantity_required": _safe_float(i.get("quantity_required"), 0.0),
                "unit": i.get("unit"),
                "unit_cost_clp": _safe_int(i.get("unit_cost_clp"), 0),
            }
            for i in ingredients
        ],
    }


def _insert_recipe_version(db, recipe_id: str, version_number: int, payload: dict) -> None:
    db.table("recipe_versions").update({"is_active": False}).eq("recipe_id", str(recipe_id)).execute()
    db.table("recipe_versions").insert(
        {
            "recipe_id": str(recipe_id),
            "version_number": int(version_number),
            "is_active": True,
            "payload": payload,
        }
    ).execute()


def list_recipes(
    db,
    local_id: str | UUID,
    *,
    search: str | None = None,
    category_id: str | None = None,
    is_active: bool | None = None,
) -> list[dict]:
    q = db.table("recipes").select("*").eq("local_id", str(local_id))
    if search and str(search).strip():
        q = q.ilike("name", f"%{str(search).strip()}%")
    if category_id and str(category_id).strip():
        q = q.eq("category_id", str(category_id).strip())
    if is_active is not None:
        q = q.eq("is_active", bool(is_active))
    rows = q.execute().data or []
    if not rows:
        return []

    category_ids = [str(r.get("category_id")) for r in rows if r.get("category_id")]
    categories = db.table("categories").select("id,name").in_("id", category_ids).execute().data or []
    cmap = {str(c["id"]): c.get("name") or "Sin categoría" for c in categories}

    out = []
    for row in rows:
        ingredients = _hydrate_recipe_ingredients(db, str(row["id"]))
        fin = _compute_financials(row.get("price_sale"), row.get("yield_portions"), ingredients)
        out.append(
            {
                "id": str(row["id"]),
                "local_id": str(row.get("local_id")),
                "business_id": str(row.get("business_id")) if row.get("business_id") else None,
                "category_id": str(row.get("category_id")) if row.get("category_id") else None,
                "category_name": cmap.get(str(row.get("category_id")), "Sin categoría"),
                "name": row.get("name") or "",
                "description": row.get("description"),
                "price_sale": _safe_int(row.get("price_sale"), 0),
                "yield_portions": _safe_int(row.get("yield_portions"), 1),
                "is_active": bool(row.get("is_active", True)),
                "version_number": _safe_int(row.get("current_version"), 1),
                "total_cost": fin["total_cost"],
                "profit_margin_percent": fin["profit_margin_percent"],
                "cost_per_portion": fin["cost_per_portion"],
                "gross_profit": fin["gross_profit"],
            }
        )
    return out


def get_recipe_kpis(db, local_id: str | UUID) -> dict:
    recipes = list_recipes(db, local_id)
    if not recipes:
        return {
            "total_recipes": 0,
            "active_recipes": 0,
            "total_cost_average": 0,
            "profit_margin_average": 0.0,
        }
    total = len(recipes)
    active = sum(1 for r in recipes if r.get("is_active"))
    total_cost_avg = int(round(sum(_safe_int(r.get("total_cost"), 0) for r in recipes) / float(total)))
    margin_avg = round(sum(_safe_float(r.get("profit_margin_percent"), 0.0) for r in recipes) / float(total), 2)
    return {
        "total_recipes": total,
        "active_recipes": active,
        "total_cost_average": total_cost_avg,
        "profit_margin_average": margin_avg,
    }


def get_recipe_detail(db, recipe_id: str | UUID, local_id: str | UUID) -> dict | None:
    rows = (
        db.table("recipes")
        .select("*")
        .eq("id", str(recipe_id))
        .eq("local_id", str(local_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return None
    row = rows[0]
    category_name = None
    if row.get("category_id"):
        category_rows = (
            db.table("categories")
            .select("id,name")
            .eq("id", str(row["category_id"]))
            .limit(1)
            .execute()
            .data
            or []
        )
        if category_rows:
            category_name = category_rows[0].get("name")

    ingredients = _hydrate_recipe_ingredients(db, str(recipe_id))
    fin = _compute_financials(row.get("price_sale"), row.get("yield_portions"), ingredients)
    return {
        "id": str(row["id"]),
        "local_id": str(row.get("local_id")),
        "business_id": str(row.get("business_id")) if row.get("business_id") else None,
        "category_id": str(row.get("category_id")) if row.get("category_id") else None,
        "category_name": category_name,
        "name": row.get("name") or "",
        "description": row.get("description"),
        "price_sale": _safe_int(row.get("price_sale"), 0),
        "yield_portions": _safe_int(row.get("yield_portions"), 1),
        "is_active": bool(row.get("is_active", True)),
        "version_number": _safe_int(row.get("current_version"), 1),
        "ingredients": fin["ingredients"],
        "total_cost": fin["total_cost"],
        "profit_margin_percent": fin["profit_margin_percent"],
        "cost_per_portion": fin["cost_per_portion"],
        "gross_profit": fin["gross_profit"],
    }


def _validate_recipe_payload(db, local_id: str, payload: dict) -> tuple[dict, list[dict]]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise ValueError("Nombre de receta es obligatorio")
    category_id = payload.get("category_id")
    if not category_id:
        raise ValueError("category_id es obligatorio")
    price_sale = _safe_int(payload.get("price_sale"), -1)
    if price_sale <= 0:
        raise ValueError("price_sale debe ser mayor que 0")
    yield_portions = _safe_int(payload.get("yield_portions"), 1)
    if yield_portions < 1:
        raise ValueError("yield_portions debe ser mayor o igual a 1")
    ingredients_in = payload.get("ingredients") or []
    if not isinstance(ingredients_in, list) or not ingredients_in:
        raise ValueError("Debes incluir al menos un ingrediente")

    products_map = _get_products_map_for_local(db, str(local_id))
    normalized = []
    seen = set()
    for item in ingredients_in:
        pid = str(item.get("product_id") or "").strip()
        if not pid:
            raise ValueError("Cada ingrediente debe tener product_id")
        if pid in seen:
            raise ValueError("No se permiten ingredientes duplicados")
        seen.add(pid)
        if pid not in products_map:
            raise ValueError("El ingrediente debe existir en inventario del local")
        qty = _safe_float(item.get("quantity_required"), 0.0)
        if qty <= 0:
            raise ValueError("quantity_required debe ser mayor que 0")
        recipe_unit = _normalize_unit(item.get("unit"))
        product = products_map[pid]
        normalized.append(
            {
                "product_id": pid,
                "product_name": product["name"],
                "quantity_required": qty,
                "unit": recipe_unit,
                "product_unit": product["unit"],
                "unit_cost_clp": product["unit_cost_clp"],
            }
        )

    base_payload = {
        "category_id": str(category_id),
        "name": name,
        "description": str(payload.get("description") or "").strip() or None,
        "price_sale": price_sale,
        "yield_portions": yield_portions,
    }
    return base_payload, normalized


def create_recipe(db, local_id: str | UUID, payload: dict) -> dict:
    business_id = get_business_id_for_local(db, str(local_id))
    base_payload, ingredients = _validate_recipe_payload(db, str(local_id), payload)
    recipe_row = (
        db.table("recipes")
        .insert(
            {
                "business_id": str(business_id),
                "local_id": str(local_id),
                **base_payload,
                "is_active": True,
                "current_version": 1,
            }
        )
        .execute()
        .data
        or []
    )
    if not recipe_row:
        raise ValueError("No se pudo crear la receta")
    recipe = recipe_row[0]
    recipe_id = str(recipe["id"])
    for ing in ingredients:
        _insert_recipe_ingredient_row(
            db,
            {
                "recipe_id": recipe_id,
                "product_id": ing["product_id"],
                "quantity_required": ing["quantity_required"],
                "unit": ing["unit"],
                "unit_cost_clp": ing["unit_cost_clp"],
            },
        )
    detail = get_recipe_detail(db, recipe_id, str(local_id))
    if not detail:
        raise ValueError("No se pudo recuperar la receta creada")
    _insert_recipe_version(
        db,
        recipe_id,
        1,
        _serialize_recipe_version(recipe, detail["ingredients"]),
    )
    return detail


def update_recipe(db, recipe_id: str | UUID, local_id: str | UUID, payload: dict) -> dict:
    current = get_recipe_detail(db, recipe_id, local_id)
    if not current:
        raise ValueError("Receta no encontrada")
    base_payload, ingredients = _validate_recipe_payload(db, str(local_id), payload)
    next_version = _safe_int(current.get("version_number"), 1) + 1
    is_active = bool(payload.get("is_active", current.get("is_active", True)))
    db.table("recipes").update(
        {
            **base_payload,
            "is_active": is_active,
            "current_version": next_version,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", str(recipe_id)).eq("local_id", str(local_id)).execute()
    db.table("recipe_ingredients").delete().eq("recipe_id", str(recipe_id)).execute()
    for ing in ingredients:
        _insert_recipe_ingredient_row(
            db,
            {
                "recipe_id": str(recipe_id),
                "product_id": ing["product_id"],
                "quantity_required": ing["quantity_required"],
                "unit": ing["unit"],
                "unit_cost_clp": ing["unit_cost_clp"],
            },
        )
    detail = get_recipe_detail(db, recipe_id, local_id)
    if not detail:
        raise ValueError("No se pudo recuperar la receta actualizada")
    _insert_recipe_version(
        db,
        str(recipe_id),
        next_version,
        _serialize_recipe_version(
            {
                "id": str(recipe_id),
                "name": detail["name"],
                "description": detail.get("description"),
                "price_sale": detail["price_sale"],
                "yield_portions": detail["yield_portions"],
                "category_id": detail.get("category_id"),
                "is_active": detail.get("is_active", True),
            },
            detail["ingredients"],
        ),
    )
    return detail


def set_recipe_status(db, recipe_id: str | UUID, local_id: str | UUID, is_active: bool) -> dict | None:
    db.table("recipes").update({"is_active": bool(is_active)}).eq("id", str(recipe_id)).eq("local_id", str(local_id)).execute()
    return get_recipe_detail(db, recipe_id, local_id)


def delete_recipe(db, recipe_id: str | UUID, local_id: str | UUID) -> bool:
    for _table, _field in [("recipe_ingredients", "recipe_id"), ("recipe_versions", "recipe_id")]:
        try:
            db.table(_table).delete().eq(_field, str(recipe_id)).execute()
        except Exception:
            pass
    db.table("recipes").delete().eq("id", str(recipe_id)).eq("local_id", str(local_id)).execute()
    return True


def consume_recipe(
    db,
    recipe_id: str | UUID,
    local_id: str | UUID,
    *,
    quantity_sold: float,
    order_id: str | None = None,
    consumed_by: str | None = None,
) -> dict:
    recipe = get_recipe_detail(db, recipe_id, local_id)
    if not recipe:
        raise ValueError("Receta no encontrada")
    if not recipe.get("is_active", True):
        raise ValueError("La receta está inactiva")
    qty_sold = _safe_float(quantity_sold, 0.0)
    if qty_sold <= 0:
        raise ValueError("quantity_sold debe ser mayor que 0")

    products_map = _get_products_map_for_local(db, str(local_id))
    requirements = []
    for ing in recipe.get("ingredients", []):
        pid = str(ing.get("product_id"))
        product = products_map.get(pid)
        if not product:
            raise ValueError("Ingrediente sin inventario en el local")
        factor = _conversion_factor(ing.get("unit"), product.get("unit"))
        required = _safe_float(ing.get("quantity_required"), 0.0) * qty_sold * factor
        available = _safe_float(product.get("stock"), 0.0)
        if available < required:
            raise ValueError(f"Stock insuficiente para {product.get('name')}")
        requirements.append((pid, product, required))

    movements = []
    for pid, product, required in requirements:
        new_stock = _safe_float(product.get("stock"), 0.0) - required
        db.table("inventory").update({"stock": new_stock}).eq("local_id", str(local_id)).eq("product_id", pid).execute()
        movement_payload = {
            "local_id": str(local_id),
            "product_id": pid,
            "recipe_id": str(recipe_id),
            "quantity_delta": -required,
            "source": "recipe_sale",
            "reference_id": str(order_id) if order_id else None,
            "consumed_by": str(consumed_by) if consumed_by else None,
        }
        try:
            db.table("recipe_consumptions").insert(movement_payload).execute()
        except Exception:
            # No romper flujo si aún no se ejecutó la migración.
            pass
        movements.append(
            {
                "product_id": pid,
                "product_name": product.get("name"),
                "quantity_consumed": required,
                "new_stock": new_stock,
            }
        )
    return {
        "ok": True,
        "recipe_id": str(recipe_id),
        "local_id": str(local_id),
        "quantity_sold": qty_sold,
        "movements": movements,
    }


def list_recipe_versions(db, recipe_id: str | UUID, local_id: str | UUID) -> list[dict]:
    recipe_rows = (
        db.table("recipes").select("id,local_id").eq("id", str(recipe_id)).eq("local_id", str(local_id)).limit(1).execute().data
        or []
    )
    if not recipe_rows:
        return []
    rows = (
        db.table("recipe_versions")
        .select("id,recipe_id,version_number,is_active,payload,created_at")
        .eq("recipe_id", str(recipe_id))
        .order("version_number", desc=True)
        .execute()
        .data
        or []
    )
    return [
        {
            "id": str(r.get("id")),
            "recipe_id": str(r.get("recipe_id")),
            "version_number": _safe_int(r.get("version_number"), 1),
            "is_active": bool(r.get("is_active", False)),
            "payload": r.get("payload") or {},
            "created_at": r.get("created_at"),
        }
        for r in rows
    ]
