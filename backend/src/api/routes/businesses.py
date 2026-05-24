from fastapi import APIRouter, HTTPException, status, Depends
from uuid import UUID
from ...schemas import BusinessCreate, BusinessUpdate, BusinessResponse
from ...deps import get_current_user, get_db

router = APIRouter()


@router.get("/businesses", response_model=list[BusinessResponse])
async def list_businesses(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List all businesses (admin only)"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can list businesses",
        )

    try:
        response = db.table("businesses").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.post("/businesses", response_model=BusinessResponse)
async def create_business(
    business: BusinessCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new business (superadmin only)"""
    if current_user.get("role") != "SUPERADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmins can create businesses",
        )

    try:
        response = db.table("businesses").insert(business.model_dump()).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/businesses/{business_id}", response_model=BusinessResponse)
async def get_business(
    business_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get business details (superadmin sees any; admin only their own business)"""
    role = current_user.get("role")
    if role not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view business details",
        )
    if role == "ADMIN" and current_user.get("business_id") != str(business_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins can only view their own business",
        )
    try:
        response = (
            db.table("businesses")
            .select("*")
            .eq("id", str(business_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.patch("/businesses/{business_id}", response_model=BusinessResponse)
async def update_business(
    business_id: UUID,
    business: BusinessUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update business (superadmin only)"""
    if current_user.get("role") != "SUPERADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmins can update businesses",
        )

    try:
        response = (
            db.table("businesses")
            .update(business.model_dump(exclude_unset=True))
            .eq("id", str(business_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )
