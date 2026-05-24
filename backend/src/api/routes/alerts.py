"""
Router de alertas administrativas del sistema.

Endpoints expuestos bajo /api:
  GET  /alerts               — listar alertas de un local (filtro por estado)
  GET  /alerts/count         — conteo rápido de pendientes (badge del header)
  POST /alerts               — crear alerta manual (admin)
  POST /alerts/evaluate      — ejecutar motor de reglas y generar alertas
  PATCH /alerts/{id}/resolve — marcar alerta como resuelta
  GET  /alerts/stream        — Server-Sent Events con conteo en tiempo real
"""

import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from ...core.security import decode_token_unsafe, get_user_id_from_token
from ...deps import get_current_user, get_db
from ...schemas import (
    AdministrativeAlertCreate,
    AdministrativeAlertResponse,
    AlertEvaluationResponse,
)
from ...services.alert_service import (
    count_pending_alerts,
    create_alert,
    evaluate_all_rules,
    get_alert_by_id,
    get_alerts,
    resolve_alert,
)

router = APIRouter()

_ADMIN_ROLES = {"SUPERADMIN", "ADMIN"}


# ── GET /alerts ─────────────────────────────────────────────────

@router.get("/alerts", response_model=list[AdministrativeAlertResponse])
async def list_alerts(
    local_id: UUID = Query(...),
    alert_status: str = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Listar alertas de un local con filtro opcional por estado."""
    try:
        return get_alerts(db, str(local_id), alert_status)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ── GET /alerts/count ───────────────────────────────────────────

@router.get("/alerts/count")
async def count_alerts(
    local_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Conteo rápido de alertas pendientes — usado por el bell icon del header."""
    try:
        count = count_pending_alerts(db, str(local_id))
        return {"local_id": str(local_id), "pending": count}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ── POST /alerts ────────────────────────────────────────────────

@router.post("/alerts", response_model=AdministrativeAlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert_endpoint(
    body: AdministrativeAlertCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Crear una alerta manualmente (solo admins)."""
    if current_user.get("role") not in _ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores pueden crear alertas")
    try:
        data = body.model_dump()
        data["local_id"] = str(data["local_id"])
        alert = create_alert(db, data)
        if not alert:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo crear la alerta")
        return alert
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ── POST /alerts/evaluate ───────────────────────────────────────

@router.post("/alerts/evaluate", response_model=AlertEvaluationResponse)
async def evaluate_alerts(
    local_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Ejecutar motor de reglas para un local y generar alertas si aplica."""
    if current_user.get("role") not in _ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores pueden evaluar alertas")
    try:
        created = evaluate_all_rules(db, str(local_id))
        return {
            "evaluated_rules": 1,
            "alerts_created": len(created),
            "alerts": created,
        }
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ── PATCH /alerts/{alert_id}/resolve ────────────────────────────

@router.patch("/alerts/{alert_id}/resolve", response_model=AdministrativeAlertResponse)
async def resolve_alert_endpoint(
    alert_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Marcar una alerta como resuelta. Solo cambia alertas en estado pending."""
    if current_user.get("role") not in _ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores pueden resolver alertas")
    try:
        resolved = resolve_alert(db, str(alert_id), str(current_user["user_id"]))
        if not resolved:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alerta no encontrada o ya está resuelta",
            )
        return resolved
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ── GET /alerts/stream (SSE) ─────────────────────────────────────

@router.get("/alerts/stream")
async def alerts_sse_stream(
    local_id: UUID = Query(...),
    token: str = Query(..., description="JWT token (EventSource no soporta headers custom)"),
    request: Request = None,
):
    """Server-Sent Events — emite el conteo de alertas pendientes cada 15s.
    El token va en query param porque EventSource del browser no soporta headers custom."""
    # Validar token manualmente (EventSource no puede enviar Authorization header)
    payload = decode_token_unsafe(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user_id = get_user_id_from_token(payload)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    from ...services.supabase_client import create_request_supabase_client
    db = create_request_supabase_client(token)
    local_id_str = str(local_id)

    async def event_generator():
        last_count = -1
        while True:
            if await request.is_disconnected():
                break
            try:
                count = count_pending_alerts(db, local_id_str)
                if count != last_count:
                    last_count = count
                    payload_str = json.dumps({"local_id": local_id_str, "pending": count})
                    yield f"data: {payload_str}\n\n"
                else:
                    # Keep-alive para evitar timeout del proxy
                    yield ": keep-alive\n\n"
            except Exception:
                yield ": error\n\n"
            await asyncio.sleep(15)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
