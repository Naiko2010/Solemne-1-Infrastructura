from fastapi import APIRouter, Depends, HTTPException, status

from ...deps import effective_db_for_admin_scope, get_current_user, get_db
from ...schemas import NewProductInventoryForm, NewProductPersistedResponse
from ...services.inventory_new_product_service import create_inventory_new_product
from ...services.supplier_service import get_business_id_for_local

router = APIRouter()


@router.post(
    "/inventory/locals/{local_id}/new-product",
    response_model=NewProductPersistedResponse,
    summary="Crear nuevo producto para inventario de local",
)
async def create_new_product_for_inventory(
    local_id: str,
    form: NewProductInventoryForm,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can create inventory products")

    db = effective_db_for_admin_scope(current_user, db)

    try:
        business_id = get_business_id_for_local(db, str(local_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local no encontrado")
    if current_user.get("role") == "ADMIN":
        uid_business = current_user.get("business_id")
        if not uid_business or str(uid_business) != str(business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Local not in your business")

    try:
        return create_inventory_new_product(db, local_id, form.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(exc)}")
