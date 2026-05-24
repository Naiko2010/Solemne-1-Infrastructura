from __future__ import annotations

from datetime import datetime, timezone

from ..services.supplier_service import assert_supplier_belongs_to_business, get_business_id_for_local


def _normalize_date(value: str | None) -> str:
    if value and str(value).strip():
        return str(value).strip()[:10]
    return datetime.now(timezone.utc).date().isoformat()


def _fetch_product(db, product_id: str) -> dict | None:
    response = (
        db.table("products")
        .select("id,name,supplier_id")
        .eq("id", str(product_id))
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


def _fetch_inventory_row(db, local_id: str, product_id: str) -> dict | None:
    response = (
        db.table("inventory")
        .select("id,stock,min_stock")
        .eq("local_id", str(local_id))
        .eq("product_id", str(product_id))
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


def create_purchase_and_update_inventory(db, payload: dict) -> dict:
    local_id = str(payload["local_id"])
    supplier_id = str(payload["supplier_id"])
    product_id = str(payload["product_id"])
    quantity = int(payload["quantity"])
    unit_cost_clp = int(payload["unit_cost_clp"])
    purchase_date = _normalize_date(payload.get("purchase_date"))

    if quantity <= 0:
        raise ValueError("quantity debe ser mayor a 0")
    if unit_cost_clp < 0:
        raise ValueError("unit_cost_clp no puede ser negativo")

    business_id = get_business_id_for_local(db, local_id)
    assert_supplier_belongs_to_business(db, supplier_id, business_id)

    product = _fetch_product(db, product_id)
    if not product:
        raise ValueError("Producto no encontrado")
    if str(product.get("supplier_id") or "") != supplier_id:
        raise ValueError("El producto no pertenece al proveedor indicado")

    inventory_row = _fetch_inventory_row(db, local_id, product_id)
    if inventory_row:
        new_stock = int(inventory_row.get("stock") or 0) + quantity
        (
            db.table("inventory")
            .update(
                {
                    "stock": new_stock,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", str(inventory_row["id"]))
            .eq("local_id", local_id)
            .execute()
        )
    else:
        created_inventory = (
            db.table("inventory")
            .insert(
                {
                    "local_id": local_id,
                    "product_id": product_id,
                    "stock": quantity,
                    "min_stock": 0,
                }
            )
            .execute()
        )
        created_rows = created_inventory.data or []
        if not created_rows:
            raise ValueError("No se pudo crear línea de inventario para el producto")
        new_stock = int(created_rows[0].get("stock") or quantity)

    purchase_insert = {
        "business_id": business_id,
        "local_id": local_id,
        "supplier_id": supplier_id,
        "product_id": product_id,
        "quantity": quantity,
        "unit_cost_clp": unit_cost_clp,
        "purchase_date": purchase_date,
        "total_clp": quantity * unit_cost_clp,
    }
    notes = payload.get("notes")
    if notes is not None and str(notes).strip():
        purchase_insert["notes"] = str(notes).strip()

    response = db.table("purchases").insert(purchase_insert).execute()
    rows = response.data or []
    if not rows:
        raise ValueError("No se pudo registrar la compra")

    created = dict(rows[0])
    created["new_stock"] = new_stock
    return created
