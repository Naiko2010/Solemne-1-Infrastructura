from fastapi import APIRouter, HTTPException, status, Depends, Query
from uuid import UUID
from ...schemas import TransferCreate, TransferUpdate, TransferResponse
from ...deps import get_current_user, get_db

router = APIRouter()


def _normalize_transfer_status(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    status_aliases = {
        "validated": "completed",
        "completed": "completed",
        "pending": "pending",
        "failed": "failed",
    }
    return status_aliases.get(normalized, normalized)


def _normalize_transfer_record(record: dict) -> dict:
    normalized = dict(record)
    normalized["status"] = _normalize_transfer_status(record.get("status"))
    return normalized


@router.get("/transfers", response_model=list[TransferResponse])
async def list_transfers(
    local_id: UUID = Query(...),
    status_filter: str = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List transfers by local with optional status filter"""
    try:
        response = db.table("transfers").select("*").eq("local_id", str(local_id)).execute()
        items = [_normalize_transfer_record(item) for item in (response.data or [])]

        if status_filter:
            normalized_filter = _normalize_transfer_status(status_filter)
            items = [item for item in items if item.get("status") == normalized_filter]

        return items
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.post("/transfers", response_model=TransferResponse)
async def create_transfer(
    transfer: TransferCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new transfer"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN", "CAJERO"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and cashiers can create transfers",
        )

    try:
        transfer_data = transfer.model_dump(mode="json")
        transfer_data["status"] = "pending"  # Default status for new transfers
        response = db.table("transfers").insert(transfer_data).execute()
        return _normalize_transfer_record(response.data[0])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/transfers/{transfer_id}", response_model=TransferResponse)
async def get_transfer(
    transfer_id: UUID,
    db=Depends(get_db),
):
    """Get transfer details"""
    try:
        response = (
            db.table("transfers")
            .select("*")
            .eq("id", str(transfer_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transfer not found",
            )
        return _normalize_transfer_record(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.patch("/transfers/{transfer_id}", response_model=TransferResponse)
async def update_transfer(
    transfer_id: UUID,
    transfer: TransferUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update transfer status (admin only)"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update transfers",
        )

    try:
        response = (
            db.table("transfers")
            .update(transfer.model_dump(exclude_unset=True))
            .eq("id", str(transfer_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transfer not found",
            )
        return _normalize_transfer_record(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.delete("/transfers/{transfer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transfer(
    transfer_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete transfer (admin only)"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete transfers",
        )

    try:
        db.table("transfers").delete().eq("id", str(transfer_id)).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )
