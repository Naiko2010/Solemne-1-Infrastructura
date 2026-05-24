from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...deps import get_current_user
from ...deps import effective_db_for_admin_scope, get_db
from ...services.supabase_client import get_supabase_client, is_service_role_configured
from ...schemas import (
    RecipeConsumeResponse,
    RecipeCreate,
    RecipeDetailResponse,
    RecipeKpisResponse,
    RecipeListItemResponse,
    RecipeUpdate,
    RecipeVersionResponse,
)
from ...services.recipes_service import (
    consume_recipe,
    create_recipe,
    delete_recipe,
    get_recipe_detail,
    get_recipe_kpis,
    list_recipe_versions,
    list_recipes as list_recipes_service,
    set_recipe_status,
    update_recipe,
)

router = APIRouter()


def _require_inventory_admin(current_user: dict) -> None:
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden acceder a recetas",
        )


def _is_recipes_schema_missing(exc: Exception) -> bool:
    msg = str(exc).lower()
    has_recipe_entity = (
        "recipes" in msg
        or "recipe_ingredients" in msg
        or "recipe_versions" in msg
        or "recipe_consumptions" in msg
    )
    return has_recipe_entity and (
        "relation" in msg
        or "does not exist" in msg
        or "schema cache" in msg
        or "could not find the table" in msg
    )


@router.get(
    "/recipes/kpis",
    response_model=RecipeKpisResponse,
    summary="KPIs de recetas por local",
)
async def get_recipes_kpis(
    local_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _require_inventory_admin(current_user)
    db = effective_db_for_admin_scope(current_user, db)
    try:
        return get_recipe_kpis(db, str(local_id))
    except HTTPException:
        raise
    except Exception as exc:
        if _is_recipes_schema_missing(exc):
            return {
                "total_recipes": 0,
                "active_recipes": 0,
                "total_cost_average": 0,
                "profit_margin_average": 0.0,
            }
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener KPIs de recetas: {exc}",
        )


@router.get(
    "/recipes",
    response_model=list[RecipeListItemResponse],
    summary="Listar recetas del local",
)
async def list_recipes(
    local_id: UUID = Query(...),
    search: str | None = Query(None),
    category_id: UUID | None = Query(None),
    is_active: bool | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _require_inventory_admin(current_user)
    db = effective_db_for_admin_scope(current_user, db)
    try:
        return list_recipes_service(
            db,
            str(local_id),
            search=search,
            category_id=str(category_id) if category_id else None,
            is_active=is_active,
        )
    except HTTPException:
        raise
    except Exception as exc:
        if _is_recipes_schema_missing(exc):
            return []
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al listar recetas: {exc}",
        )


@router.get("/recipes/{recipe_id}", response_model=RecipeDetailResponse)
async def get_recipe(
    recipe_id: UUID,
    local_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _require_inventory_admin(current_user)
    db = effective_db_for_admin_scope(current_user, db)
    try:
        row = get_recipe_detail(db, str(recipe_id), str(local_id))
    except HTTPException:
        raise
    except Exception as exc:
        if _is_recipes_schema_missing(exc):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Módulo recetas no inicializado en BD. Ejecuta migrations/hu90_recipes.sql",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener receta: {exc}",
        )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")
    return row


@router.post("/recipes", response_model=RecipeDetailResponse, status_code=status.HTTP_201_CREATED)
async def post_recipe(
    body: RecipeCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _require_inventory_admin(current_user)
    db = effective_db_for_admin_scope(current_user, db)
    try:
        return create_recipe(db, str(body.local_id), body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al crear receta: {exc}")


@router.put("/recipes/{recipe_id}", response_model=RecipeDetailResponse)
async def put_recipe(
    recipe_id: UUID,
    body: RecipeUpdate,
    local_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _require_inventory_admin(current_user)
    db = effective_db_for_admin_scope(current_user, db)
    try:
        return update_recipe(db, str(recipe_id), str(local_id), body.model_dump(exclude_unset=True))
    except ValueError as exc:
        if "no encontrada" in str(exc).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al actualizar receta: {exc}")


@router.patch("/recipes/{recipe_id}/status", response_model=RecipeDetailResponse)
async def patch_recipe_status(
    recipe_id: UUID,
    local_id: UUID = Query(...),
    is_active: bool = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _require_inventory_admin(current_user)
    db = effective_db_for_admin_scope(current_user, db)
    try:
        row = set_recipe_status(db, str(recipe_id), str(local_id), is_active)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al cambiar estado: {exc}")
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")
    return row


@router.delete("/recipes/{recipe_id}")
async def remove_recipe(
    recipe_id: UUID,
    local_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _require_inventory_admin(current_user)
    scoped_db = effective_db_for_admin_scope(current_user, db)
    del_db = get_supabase_client() if is_service_role_configured() else scoped_db
    delete_recipe(del_db, str(recipe_id), str(local_id))
    return {"ok": True}


@router.post("/recipes/{recipe_id}/consume", response_model=RecipeConsumeResponse)
async def post_recipe_consumption(
    recipe_id: UUID,
    local_id: UUID = Query(...),
    quantity_sold: float = Query(..., gt=0),
    order_id: UUID | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _require_inventory_admin(current_user)
    db = effective_db_for_admin_scope(current_user, db)
    try:
        return consume_recipe(
            db,
            str(recipe_id),
            str(local_id),
            quantity_sold=quantity_sold,
            order_id=str(order_id) if order_id else None,
            consumed_by=str(current_user.get("user_id") or ""),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/recipes/{recipe_id}/versions", response_model=list[RecipeVersionResponse])
async def get_recipe_versions(
    recipe_id: UUID,
    local_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _require_inventory_admin(current_user)
    db = effective_db_for_admin_scope(current_user, db)
    try:
        return list_recipe_versions(db, str(recipe_id), str(local_id))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al obtener versiones: {exc}")
