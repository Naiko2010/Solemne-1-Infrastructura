from fastapi import APIRouter, HTTPException, status, Depends, Query
from uuid import UUID
from ...schemas import ProductCreate, ProductUpdate, ProductResponse
from ...deps import get_current_user, get_db

router = APIRouter()


@router.get("/products", response_model=list[ProductResponse])
async def list_products(
    category_id: UUID = Query(...),
    search: str | None = Query(
        None,
        description="HU-46 (SCRUM-429): filtra por nombre o descripción (?search=..., contiene, sin distinguir mayúsculas).",
    ),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List products by category; optional text search (HU-46)."""
    try:
        response = (
            db.table("products")
            .select("*")
            .eq("category_id", str(category_id))
            .execute()
        )
        rows = response.data or []
        if search and (needle := search.strip().casefold()):
            rows = [
                r
                for r in rows
                if needle in (r.get("name") or "").casefold()
                or needle in (r.get("description") or "").casefold()
            ]
        return rows
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.post("/products", response_model=ProductResponse)
async def create_product(
    product: ProductCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new product"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create products",
        )

    try:
        response = db.table("products").insert(product.model_dump()).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    db=Depends(get_db),
):
    """Get product details"""
    try:
        response = (
            db.table("products")
            .select("*")
            .eq("id", str(product_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    product: ProductUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update product"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update products",
        )

    try:
        response = (
            db.table("products")
            .update(product.model_dump(exclude_unset=True))
            .eq("id", str(product_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete product"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete products",
        )

    try:
        db.table("products").delete().eq("id", str(product_id)).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )
