from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel, EmailStr, Field
from ...schemas import UserResponse, RoleEnum
from ...deps import get_current_user, get_db
from ...core.config import settings

router = APIRouter()


class AdminCreateUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    email_confirm: bool = True
    role: RoleEnum = RoleEnum.EMPLEADO
    name: str | None = None
    phone: str | None = None
    business_id: UUID | None = None


@router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user),
):
    """Get current authenticated user info from Supabase token"""
    return current_user


@router.put("/auth/admin/sync-metadata", status_code=status.HTTP_200_OK)
async def sync_user_metadata(
    sync_key: str = Query(...),
    db=Depends(get_db),
):
    """Sync user_metadata for all existing users from public.users table (protected by sync_key)."""
    # Simple protection - could be enhanced with environment variable
    if sync_key != settings.sync_metadata_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid sync key",
        )

    try:
        # Get all users from public.users table
        users_response = db.table("users").select("id, role, business_id").execute()
        if not users_response.data:
            return {"synced": 0, "message": "No users found"}

        synced_count = 0
        errors = []

        for user_record in users_response.data:
            user_id = user_record.get("id")
            role = user_record.get("role", "EMPLEADO")
            business_id = user_record.get("business_id")

            try:
                # Update user metadata in auth.users
                db.auth.admin.update_user_by_id(
                    user_id,
                    {
                        "user_metadata": {
                            "role": role,
                            "business_id": business_id,
                        }
                    },
                )
                synced_count += 1
            except Exception as e:
                errors.append({"user_id": user_id, "error": str(e)})

        return {
            "synced": synced_count,
            "total": len(users_response.data),
            "errors": errors if errors else None,
            "message": f"Synced {synced_count}/{len(users_response.data)} users successfully",
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error syncing metadata: {str(e)}",
        )


@router.post("/auth/admin/create-user", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_with_supabase_admin(
    payload: AdminCreateUserRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a user in Supabase auth.users and mirror it in public.users (superadmin only)."""
    if current_user.get("role") != "SUPERADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can create users",
        )

    # Prevent duplicate emails in application table before creating auth user.
    existing_user = db.table("users").select("id").eq("email", payload.email).limit(1).execute()
    if existing_user.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    created_auth_user_id = None
    try:
        data = db.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": payload.email_confirm,
                "user_metadata": {
                    "role": payload.role.value,
                    "business_id": str(payload.business_id) if payload.business_id else None,
                },
            }
        )

        # Keep compatibility with the common SDK pattern: data.user.id
        created_auth_user = getattr(data, "user", None)
        if created_auth_user and getattr(created_auth_user, "id", None):
            created_auth_user_id = str(created_auth_user.id)
        elif isinstance(data, dict) and data.get("user") and data["user"].get("id"):
            created_auth_user_id = str(data["user"]["id"])

        if not created_auth_user_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase did not return data.user.id",
            )

        user_insert = {
            "id": created_auth_user_id,
            "email": payload.email,
            "name": payload.name,
            "phone": payload.phone,
            "role": payload.role.value,
            "business_id": str(payload.business_id) if payload.business_id else None,
            "is_active": True,
        }

        response = db.table("users").insert(user_insert).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User was created in auth but not in users table",
            )

        return response.data[0]
    except HTTPException:
        if created_auth_user_id:
            try:
                db.auth.admin.delete_user(created_auth_user_id)
            except Exception:
                pass
        raise
    except Exception as e:
        if created_auth_user_id:
            try:
                db.auth.admin.delete_user(created_auth_user_id)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating user: {str(e)}",
        )

