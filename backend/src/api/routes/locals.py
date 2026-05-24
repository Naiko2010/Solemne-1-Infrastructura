from fastapi import APIRouter, HTTPException, status, Depends, Query
from uuid import UUID
from ...schemas import LocalCreate, LocalUpdate, LocalResponse
from ...deps import effective_db_for_admin_scope, get_current_user, get_db

router = APIRouter()

@router.get("/locals", response_model=list[LocalResponse])
async def list_locals(
    business_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List locals by business"""
    try:
        response = (
            db.table("locals")
            .select("*")
            .eq("business_id", str(business_id))
            .execute()
        )
        # Return empty list if no data, instead of error
        return response.data if response.data else []
    except Exception as e:
        # Log error but return empty list for now
        print(f"Error fetching locals: {str(e)}")
        return []


@router.get("/locals/by-business/{business_id}/available", response_model=list[LocalResponse])
async def list_locals_by_business(
    business_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Lista locales de un negocio — alias de GET /locals?business_id= para ChangeLocal flow."""
    try:
        response = (
            db.table("locals")
            .select("*")
            .eq("business_id", str(business_id))
            .execute()
        )
        return response.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.post("/locals", response_model=LocalResponse)
async def create_local(
    local: LocalCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new local"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create locals",
        )

    if not current_user.get("business_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have an associated business",
        )

    try:
        # Serialize UUID fields to JSON-safe values before sending to Supabase.
        local_data = local.model_dump(mode="json", exclude={"business_id"})
        local_data["business_id"] = str(current_user.get("business_id"))
        response = db.table("locals").insert(local_data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/locals/{local_id}", response_model=LocalResponse)
async def get_local(
    local_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get local details (JWT requerido; SUPERADMIN usa DB con alcance completo)."""
    db = effective_db_for_admin_scope(current_user, db)
    try:
        response = (
            db.table("locals")
            .select("*")
            .eq("id", str(local_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Local not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.patch("/locals/{local_id}", response_model=LocalResponse)
async def update_local(
    local_id: UUID,
    local: LocalUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update local"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update locals",
        )

    try:
        response = (
            db.table("locals")
            .update(local.model_dump(exclude_unset=True))
            .eq("id", str(local_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Local not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.delete("/locals/{local_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_local(
    local_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete local (superadmin only)"""
    if current_user.get("role") != "SUPERADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmins can delete locals",
        )

    try:
        db.table("locals").delete().eq("id", str(local_id)).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )
