from __future__ import annotations

from .supplier_service import assert_supplier_belongs_to_business, get_business_id_for_local


def _build_product_description(unit: str, stock_max: int, supplier_name: str) -> str:
    return f"Unidad: {unit}. Stock máximo: {int(stock_max)}. Proveedor: {supplier_name}."


def _get_or_create_category(db, local_id: str, category_name: str) -> str:
    response = (
        db.table("categories")
        .select("id,name")
        .eq("local_id", str(local_id))
        .eq("name", category_name)
        .execute()
    )
    rows = response.data or []
    if rows:
        return str(rows[0]["id"])

    created = (
        db.table("categories")
        .insert({"local_id": str(local_id), "name": category_name, "is_active": True})
        .execute()
    )
    created_rows = created.data or []
    if not created_rows:
        raise ValueError("No se pudo crear la categoría")
    return str(created_rows[0]["id"])


def create_inventory_new_product(db, local_id: str, payload: dict) -> dict:
    business_id = get_business_id_for_local(db, str(local_id))
    supplier_row = assert_supplier_belongs_to_business(db, str(payload["supplier_id"]), business_id)
    supplier_name = str(supplier_row.get("name") or "").strip() or "—"

    category_id = _get_or_create_category(db, str(local_id), payload["category_name"].strip())

    product_response = (
        db.table("products")
        .insert(
            {
                "category_id": category_id,
                "name": payload["product_name"].strip(),
                "description": _build_product_description(
                    payload["unit"], int(payload["stock_max"]), supplier_name
                ),
                "price": int(payload["unit_cost_clp"]),
                "is_active": True,
                "supplier_id": str(payload["supplier_id"]),
            }
        )
        .execute()
    )
    product_rows = product_response.data or []
    if not product_rows:
        raise ValueError("No se pudo crear el producto; verifica datos e inténtalo de nuevo")
    product_id = str(product_rows[0]["id"])

    inventory_response = (
        db.table("inventory")
        .insert(
            {
                "local_id": str(local_id),
                "product_id": product_id,
                "stock": int(payload["stock_current"]),
                "min_stock": int(payload["stock_min"]),
            }
        )
        .execute()
    )
    inventory_rows = inventory_response.data or []
    if not inventory_rows:
        raise ValueError("No se pudo crear la fila de inventario para el producto")

    return {
        "category_id": category_id,
        "product_id": product_id,
        "inventory_id": str(inventory_rows[0]["id"]),
    }
