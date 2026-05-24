from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Query
from uuid import UUID
from ...schemas import MesaCreate, MesaUpdate, MesaResponse, MesaDetailResponse
from ...deps import get_current_user, get_db

router = APIRouter()

# Status values that mean the order is still active on the mesa (case-insensitive)
_ACTIVE_STATUSES = {"pending", "in_progress", "preparing"}
_COBRO_STATUSES = {"ready"}
_TERMINAL_STATUSES = {"cancelled", "completed", "delivered"}


def _derive_mesa_state(mesa_id: str, orders: list[dict]) -> str:
    """Compute 'libre' | 'ocupada' | 'en_cobro' from a mesa's active orders."""
    state = "libre"
    for order in orders:
        if str(order.get("mesa_id") or "") != mesa_id:
            continue
        s = str(order.get("status") or "").lower()
        if s in _COBRO_STATUSES:
            return "en_cobro"
        if s in _ACTIVE_STATUSES:
            state = "ocupada"
    return state


# ── /mesas/con-estado must be declared BEFORE /{mesa_id} to avoid route capture ──

@router.get("/mesas", response_model=list[MesaResponse])
async def list_mesas(
    local_id: UUID = Query(...),
    with_state: bool = Query(False, description="Include computed state (libre/ocupada/en_cobro)"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List mesas by local. Use ?with_state=true to include computed state from active orders."""
    try:
        mesas_resp = (
            db.table("mesas").select("*").eq("local_id", str(local_id)).execute()
        )
        mesas = mesas_resp.data or []

        if not with_state:
            return mesas

        # Compute state from active orders (SCRUM-482/483/484/485)
        active_ids = {str(m["id"]) for m in mesas if m.get("is_active")}
        orders_resp = (
            db.table("orders")
            .select("id,mesa_id,status")
            .eq("local_id", str(local_id))
            .execute()
        )
        relevant_orders = [
            o for o in (orders_resp.data or [])
            if str(o.get("mesa_id") or "") in active_ids
            and str(o.get("status") or "").lower() not in _TERMINAL_STATUSES
        ]
        for mesa in mesas:
            mesa["state"] = _derive_mesa_state(str(mesa["id"]), relevant_orders)

        return mesas
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.post("/mesas", response_model=MesaResponse)
async def create_mesa(
    mesa: MesaCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new mesa (admin only)"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create mesas",
        )

    try:
        # Validate name uniqueness within the local (SCRUM-480)
        existing = (
            db.table("mesas")
            .select("id")
            .eq("local_id", str(mesa.local_id))
            .eq("name", mesa.name)
            .execute()
        )
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una mesa con el nombre '{mesa.name}' en este local",
            )

        insert_data = {
            "local_id": str(mesa.local_id),
            "name": mesa.name,
            "capacidad": mesa.capacidad,
            "zona": mesa.zona,
            "is_delivery": mesa.is_delivery,
            "is_active": mesa.is_active,
        }
        response = db.table("mesas").insert(insert_data).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/mesas/{mesa_id}/detail")
async def get_mesa_detail(
    mesa_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get mesa details with active orders and KPIs (HU-60 / SCRUM-487/488/489)."""
    try:
        # 1. Mesa base data
        mesa_resp = (
            db.table("mesas").select("*").eq("id", str(mesa_id)).execute()
        )
        if not mesa_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mesa not found",
            )
        mesa_data = mesa_resp.data[0]

        # 2. Active orders for this mesa (exclude terminal statuses)
        orders_resp = (
            db.table("orders")
            .select("*")
            .eq("mesa_id", str(mesa_id))
            .execute()
        )
        orders = [
            o for o in (orders_resp.data or [])
            if str(o.get("status") or "").lower() not in _TERMINAL_STATUSES
        ]

        # 3. Build order list with items + product names
        active_orders_list = []
        total_products = 0
        total_value = 0.0

        for order in orders:
            order_id = str(order.get("id"))

            items_resp = (
                db.table("order_items").select("*").eq("order_id", order_id).execute()
            )
            items = items_resp.data or []

            product_ids = [str(i["product_id"]) for i in items if i.get("product_id")]
            products_map = {}
            if product_ids:
                p_resp = (
                    db.table("products")
                    .select("id,name,description")
                    .in_("id", product_ids)
                    .execute()
                )
                products_map = {
                    str(p["id"]): {
                        "name": p.get("name", "Producto"),
                        "description": p.get("description") or "",
                    }
                    for p in (p_resp.data or [])
                }

            order_items_list = []
            for item in items:
                pid = str(item.get("product_id") or "")
                qty = int(item.get("quantity") or 0)
                tp = int(item.get("total_price") or 0)
                prod_info = products_map.get(pid, {"name": "Producto", "description": ""})
                order_items_list.append({
                    "id": item["id"],
                    "product_id": item.get("product_id"),
                    "product_name": prod_info["name"],
                    "product_description": prod_info["description"],
                    "quantity": qty,
                    "unit_price": int(item.get("unit_price") or 0),
                    "total_price": tp,
                })
                total_products += qty
                total_value += tp

            # Normalize status/payment_method/source for frontend
            raw_status = str(order.get("status") or "pending").lower()
            raw_pm = str(order.get("payment_method") or "cash").lower()
            raw_src = order.get("source") or "dine-in"
            if raw_src not in ("dine-in", "takeout"):
                raw_src = "dine-in"

            created_raw = order.get("created_at")
            if isinstance(created_raw, str):
                created_at = created_raw
            else:
                created_at = datetime.now(timezone.utc).isoformat()

            active_orders_list.append({
                "id": order_id,
                "status": raw_status,
                "payment_method": raw_pm,
                "source": raw_src,
                "subtotal": float(order.get("subtotal") or 0),
                "total": float(order.get("total") or 0),
                "items": order_items_list,
                "created_at": created_at,
            })

        # 4. Compute mesa state from orders
        mesa_state = _derive_mesa_state(str(mesa_id), orders)
        mesa_data["state"] = mesa_state

        return {
            "mesa": mesa_data,
            "active_orders": active_orders_list,
            "total_products": total_products,
            "total_value": round(total_value, 2),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/mesas/{mesa_id}", response_model=MesaResponse)
async def get_mesa(
    mesa_id: UUID,
    db=Depends(get_db),
):
    """Get mesa details"""
    try:
        response = (
            db.table("mesas")
            .select("*")
            .eq("id", str(mesa_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mesa not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.patch("/mesas/{mesa_id}", response_model=MesaResponse)
async def update_mesa(
    mesa_id: UUID,
    mesa: MesaUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update mesa (admin only)"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update mesas",
        )

    try:
        response = (
            db.table("mesas")
            .update(mesa.model_dump(exclude_unset=True))
            .eq("id", str(mesa_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mesa not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.delete("/mesas/{mesa_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mesa(
    mesa_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete mesa (superadmin only) - only if no active orders"""
    if current_user.get("role") != "SUPERADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can delete mesas",
        )

    try:
        # HU-64 SCRUM-521: Check for active orders before deleting
        orders_resp = (
            db.table("orders")
            .select("id,status")
            .eq("mesa_id", str(mesa_id))
            .execute()
        )
        
        # Check if there are any non-terminal orders
        active_orders = [
            o for o in (orders_resp.data or [])
            if str(o.get("status") or "").lower() not in _TERMINAL_STATUSES
        ]
        
        if active_orders:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete mesa with {len(active_orders)} active order(s). Close or complete them first.",
            )
        
        # Safe to delete - no active orders
        db.table("mesas").delete().eq("id", str(mesa_id)).execute()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )
