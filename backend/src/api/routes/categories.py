from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...deps import get_current_user, get_db
from ...schemas import CategoryCreate, CategoryResponse, CategoryUpdate

router = APIRouter()


def _json_safe_value(value: Any) -> Any:
    """PostgREST / client pueden devolver UUID u otros tipos no serializables en JSON estándar."""
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _category_row_for_response(row: dict) -> dict:
    return {k: _json_safe_value(v) for k, v in row.items()}


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    local_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List categories by local"""
    try:
        response = (
            db.table("categories")
            .select("*")
            .eq("local_id", str(local_id))
            .execute()
        )
        return [_category_row_for_response(r) for r in (response.data or [])]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.post("/categories", response_model=CategoryResponse)
async def create_category(
    category: CategoryCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new category"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create categories",
        )

    try:
        insert_payload = category.model_dump(mode="json")
        response = db.table("categories").insert(insert_payload).execute()
        rows = response.data or []
        if not rows:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Insert failed")
        return _category_row_for_response(rows[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.patch("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    category: CategoryUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update category"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update categories",
        )

    try:
        response = (
            db.table("categories")
            .update(category.model_dump(exclude_unset=True))
            .eq("id", str(category_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found",
            )
        return _category_row_for_response(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete category"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete categories",
        )

    try:
        db.table("categories").delete().eq("id", str(category_id)).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )
