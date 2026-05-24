from fastapi import APIRouter, HTTPException, status, Depends, Query
from uuid import UUID
from ...schemas import UserCreate, UserUpdate, UserResponse
from ...deps import get_current_user, get_db

router = APIRouter()


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    business_id: UUID = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List users (admin only), optionally filtered by business"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can list users",
        )

    try:
        query = db.table("users").select("*")

        if business_id:
            query = query.eq("business_id", str(business_id))

        response = query.execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get user details (self or ADMIN+)"""
    role = current_user.get("role")
    if current_user.get("user_id") != str(user_id) and role not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only view your own profile",
        )
    try:
        response = (
            db.table("users")
            .select("*")
            .eq("id", str(user_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update user (user can update self, admins can update others)"""
    # Users can only update themselves unless they're admins
    if current_user.get("user_id") != str(user_id) and current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update your own profile",
        )

    # Only admins can change roles or is_active status
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        if user.role is not None or user.is_active is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can change role or active status",
            )

    try:
        response = (
            db.table("users")
            .update(user.model_dump(exclude_unset=True))
            .eq("id", str(user_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete user (superadmin only)"""
    if current_user.get("role") != "SUPERADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can delete users",
        )

    try:
        db.table("users").delete().eq("id", str(user_id)).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )
