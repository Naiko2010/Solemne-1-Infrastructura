from fastapi import APIRouter, HTTPException, status, Depends, Query
from uuid import UUID
from ...schemas import CajaCreate, CajaUpdate, CajaResponse, UserCajaCreate, UserCajaResponse
from ...deps import get_current_user, get_db

router = APIRouter()


# ============= CAJAS ENDPOINTS =============

@router.get("/cajas", response_model=list[CajaResponse])
async def list_cajas(
    local_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List cajas (cash registers) by local"""
    try:
        response = (
            db.table("cajas")
            .select("*")
            .eq("local_id", str(local_id))
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.post("/cajas", response_model=CajaResponse)
async def create_caja(
    caja: CajaCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new caja (admin only)"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create cajas",
        )

    try:
        response = db.table("cajas").insert(caja.model_dump()).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/cajas/{caja_id}", response_model=CajaResponse)
async def get_caja(
    caja_id: UUID,
    db=Depends(get_db),
):
    """Get caja details"""
    try:
        response = (
            db.table("cajas")
            .select("*")
            .eq("id", str(caja_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Caja not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.patch("/cajas/{caja_id}", response_model=CajaResponse)
async def update_caja(
    caja_id: UUID,
    caja: CajaUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update caja (admin only)"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update cajas",
        )

    try:
        response = (
            db.table("cajas")
            .update(caja.model_dump(exclude_unset=True))
            .eq("id", str(caja_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Caja not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.delete("/cajas/{caja_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_caja(
    caja_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete caja (superadmin only)"""
    if current_user.get("role") != "SUPERADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can delete cajas",
        )

    try:
        db.table("cajas").delete().eq("id", str(caja_id)).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


# ============= USER CAJAS ENDPOINTS =============

@router.get("/user-cajas", response_model=list[UserCajaResponse])
async def list_user_cajas(
    user_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List cajas assigned to a user"""
    try:
        response = (
            db.table("user_cajas")
            .select("*")
            .eq("user_id", str(user_id))
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.post("/user-cajas", response_model=UserCajaResponse)
async def assign_caja_to_user(
    user_caja: UserCajaCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Assign a caja to a user (admin only)"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can assign cajas",
        )

    try:
        response = db.table("user_cajas").insert(user_caja.model_dump()).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.delete("/user-cajas/{user_caja_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_caja_from_user(
    user_caja_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Remove caja assignment from user (admin only)"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can remove caja assignments",
        )

    try:
        db.table("user_cajas").delete().eq("id", str(user_caja_id)).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )
