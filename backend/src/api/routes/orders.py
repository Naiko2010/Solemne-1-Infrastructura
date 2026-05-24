from fastapi import APIRouter, Body, HTTPException, status, Depends, Query
from uuid import UUID
from datetime import datetime
from ...schemas import OrderCreate, OrderUpdate, OrderResponse, OrderItemResponse, OrderItemCreate, OrderItemUpdate
from ...deps import get_current_user, get_db

router = APIRouter()


@router.get("/orders", response_model=list[OrderResponse])
async def list_orders(
    local_id: UUID = Query(...),
    status_filter: str = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List orders by local with optional status filter"""
    try:
        query = db.table("orders").select("*").eq("local_id", str(local_id))

        if status_filter:
            query = query.eq("status", status_filter)

        response = query.execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.post("/orders", response_model=OrderResponse)
async def create_order(
    order: OrderCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new order"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN", "CAJERO", "EMPLEADO"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and cashiers can create orders",
        )

    try:
        # Calculate subtotal and total
        subtotal = sum(item.quantity * item.unit_price for item in order.items)

        # Create order record
        order_data = {
            "local_id": str(order.local_id),
            "mesa_id": str(order.mesa_id) if order.mesa_id else None,
            "source": order.source,
            "payment_method": order.payment_method,
            "status": "PENDING",
            "subtotal": subtotal,
            "total": subtotal,  # For now, no taxes/fees
            "created_at": datetime.utcnow().isoformat(),
        }

        order_response = db.table("orders").insert(order_data).execute()
        created_order = order_response.data[0]
        order_id = created_order["id"]

        # Create order items
        for item in order.items:
            item_total = item.quantity * item.unit_price
            item_data = {
                "order_id": order_id,
                "product_id": str(item.product_id),
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item_total,
            }
            db.table("order_items").insert(item_data).execute()

        # Return created order with items
        return created_order
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/orders/{order_id}/summary")
async def get_order_summary(
    order_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Resumen completo de orden para ChangeLocal flow: orden + local_info + items."""
    order_resp = (
        db.table("orders")
        .select("*")
        .eq("id", str(order_id))
        .execute()
    )
    if not order_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    order = order_resp.data[0]

    local_info = None
    local_id = order.get("local_id")
    if local_id:
        try:
            local_resp = (
                db.table("locals")
                .select("id, name, address, business_id")
                .eq("id", str(local_id))
                .execute()
            )
            local_info = local_resp.data[0] if local_resp.data else None
        except Exception:
            pass

    try:
        items_resp = (
            db.table("order_items")
            .select("*, products(id, name, price)")
            .eq("order_id", str(order_id))
            .execute()
        )
        items = items_resp.data or []
    except Exception:
        items = []

    return {
        **order,
        "business_id": local_info.get("business_id") if local_info else None,
        "local_info": local_info,
        "items": items,
    }


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: UUID,
    db=Depends(get_db),
):
    """Get order details"""
    try:
        response = (
            db.table("orders")
            .select("*")
            .eq("id", str(order_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.patch("/orders/{order_id}/local", response_model=OrderResponse)
async def change_order_local(
    order_id: UUID,
    local_id: UUID = Body(..., embed=True),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Reasigna la orden a otro local del mismo negocio (flujo ChangeLocal)."""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN", "CAJERO", "EMPLEADO"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    local_resp = db.table("locals").select("id").eq("id", str(local_id)).execute()
    if not local_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local not found")

    try:
        response = (
            db.table("orders")
            .update({"local_id": str(local_id)})
            .eq("id", str(order_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.patch("/orders/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: UUID,
    order_update: OrderUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update order status or payment method"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN", "CAJERO", "EMPLEADO"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and cashiers can update orders",
        )

    try:
        update_data = order_update.model_dump(exclude_unset=True)

        response = (
            db.table("orders")
            .update(update_data)
            .eq("id", str(order_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        # Record status change if status was updated
        if "status" in update_data:
            db.table("order_status_history").insert({
                "order_id": str(order_id),
                "changed_by": current_user.get("user_id"),
                "status": update_data["status"],
            }).execute()

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/orders/{order_id}/items", response_model=list[OrderItemResponse])
async def get_order_items(
    order_id: UUID,
    db=Depends(get_db),
):
    """Get items from an order"""
    try:
        response = (
            db.table("order_items")
            .select("*")
            .eq("order_id", str(order_id))
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.delete("/orders/{order_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order_item(
    order_id: UUID,
    item_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete an item from an order"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN", "CAJERO", "EMPLEADO"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and cashiers can delete order items",
        )

    try:
        db.table("order_items").delete().eq("id", str(item_id)).eq("order_id", str(order_id)).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.post("/orders/{order_id}/items", response_model=OrderItemResponse)
async def create_order_item(
    order_id: UUID,
    item: OrderItemCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Add a new item to an order (para agregar productos extras como pan, aceite, etc.)"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN", "CAJERO", "EMPLEADO"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and cashiers can add order items",
        )

    try:
        # Calculate total price
        total_price = item.quantity * item.unit_price

        # Insert new item
        item_data = {
            "order_id": str(order_id),
            "product_id": str(item.product_id),
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total_price": total_price,
        }

        response = db.table("order_items").insert(item_data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.patch("/orders/{order_id}/items/{item_id}", response_model=OrderItemResponse)
async def update_order_item(
    order_id: UUID,
    item_id: UUID,
    item_update: OrderItemUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update an item in an order"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN", "CAJERO", "EMPLEADO"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and cashiers can update order items",
        )

    try:
        # Get current item to calculate new total
        current = db.table("order_items").select("*").eq("id", str(item_id)).execute()
        if not current.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found",
            )

        current_item = current.data[0]
        quantity = item_update.quantity if item_update.quantity is not None else current_item["quantity"]
        unit_price = item_update.unit_price if item_update.unit_price is not None else current_item["unit_price"]

        # Calculate new total
        total_price = quantity * unit_price

        # Update item
        update_data = {
            "quantity": quantity,
            "unit_price": unit_price,
            "total_price": total_price,
        }

        response = db.table("order_items").update(update_data).eq("id", str(item_id)).eq("order_id", str(order_id)).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )
