from fastapi import APIRouter, Depends, HTTPException, status

from ...deps import effective_db_for_admin_scope, get_current_user, get_db
from ...schemas import PurchaseCreate, PurchaseResponse
from ...services.purchases_service import create_purchase_and_update_inventory
from ...services.supplier_service import get_business_id_for_local

router = APIRouter()


@router.post(
    "/purchases",
    response_model=PurchaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar compra a proveedor y actualizar stock",
)
async def post_purchase(
    body: PurchaseCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")

    db = effective_db_for_admin_scope(current_user, db)
    try:
        local_business_id = get_business_id_for_local(db, str(body.local_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local no encontrado")

    if current_user.get("role") == "ADMIN":
        uid_business = current_user.get("business_id")
        if not uid_business or str(uid_business) != str(local_business_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Local no permitido")

    try:
        return create_purchase_and_update_inventory(db, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al registrar compra: {str(e)}",
        )
