from fastapi import Depends, HTTPException, status
from starlette.requests import Request

from src.core.security import decode_token_unsafe, get_user_id_from_token, get_role_from_token, get_business_id_from_token
from src.services.supabase_client import (
    create_request_supabase_client,
    get_supabase_client,
    is_service_role_configured,
)



async def get_current_user(request: Request) -> dict:
    """
    Get current authenticated user from Supabase JWT token.
    Token is issued by Supabase auth system and contains user_metadata with role and business_id.
    """
    authorization = request.headers.get("authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ")[1]

    # Decode token without signature verification (Supabase already validated it)
    payload = decode_token_unsafe(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = get_user_id_from_token(payload)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    role_raw = get_role_from_token(payload)
    business_id = get_business_id_from_token(payload)
    email = payload.get("email")

    # Normalizar rol para comparaciones (JWT puede traer mayúsculas distintas o variantes)
    role = role_raw
    if role_raw is not None:
        r = str(role_raw).strip().upper()
        if r in ("SUPERADMIN", "SUPER_ADMIN", "SUPER-ADMIN"):
            role = "SUPERADMIN"
        elif r == "ADMIN":
            role = "ADMIN"
        elif r in ("CAJERO", "EMPLEADO"):
            role = r
        elif r == "AUTHENTICATED":
            role = "EMPLEADO"
    if not role:
        role = "EMPLEADO"

    # Return user info directly from token
    # (Supabase already validated and issued the token)
    return {
        "user_id": user_id,
        "id": user_id,
        "email": email,
        "role": role,
        "is_active": True,
        "business_id": business_id,
    }


def get_db(request: Request):
    """
    Cliente Supabase alineado con la petición: con anon key envía el JWT al PostgREST
    para que las políticas RLS aplican al usuario autenticado.
    """
    authorization = request.headers.get("authorization")
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip() or None
    return create_request_supabase_client(token)


def effective_db_for_admin_scope(current_user: dict, request_db):
    """
    SUPERADMIN y ADMIN usan service role cuando está configurado (bypassa RLS).
    Necesario porque algunas tablas (recipes, orders) tienen políticas RLS que
    requieren SET app.current_business_id, parámetro que PostgREST no permite
    setear por request. El access control real lo hace el código Python.
    Sin service role key: usa el cliente con JWT del request (RLS puede bloquear).
    """
    if current_user.get("role") in ("SUPERADMIN", "ADMIN") and is_service_role_configured():
        return get_supabase_client()
    return request_db

