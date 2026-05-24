from fastapi import APIRouter, HTTPException, status, Depends, Query
from datetime import datetime
from uuid import UUID
from ...schemas import ExpenseCreate, ExpenseUpdate, ExpenseResponse
from ...deps import get_current_user, get_db

router = APIRouter()


def _normalize_datetime_like(value) -> str | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.isoformat()

    text = str(value).strip()
    if not text:
        return None

    # Convert DATE values (YYYY-MM-DD) into ISO datetime expected by schema.
    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        return f"{text}T00:00:00+00:00"

    return text


def _normalize_expense_category(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    category_aliases = {
        "insumos": "supplies",
        "supplies": "supplies",
        "servicios": "utilities",
        "utilities": "utilities",
        "mantenimiento": "maintenance",
        "maintenance": "maintenance",
        "staff": "staff",
        "personal": "staff",
        "otros": "other",
        "other": "other",
    }
    return category_aliases.get(normalized, normalized)


def _normalize_expense_status(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    status_aliases = {
        "validated": "approved",
        "approved": "approved",
        "pending": "pending",
        "rejected": "rejected",
    }
    return status_aliases.get(normalized, normalized)


def _normalize_expense_record(record: dict) -> dict:
    normalized = dict(record)
    normalized["category"] = _normalize_expense_category(record.get("category"))
    normalized["status"] = _normalize_expense_status(record.get("status"))
    normalized["expense_date"] = _normalize_datetime_like(
        record.get("expense_date") or record.get("created_at")
    )
    return normalized


@router.get("/expenses", response_model=list[ExpenseResponse])
async def list_expenses(
    local_id: UUID = Query(...),
    status_filter: str = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List expenses by local with optional status filter"""
    try:
        response = db.table("expenses").select("*").eq("local_id", str(local_id)).execute()
        items = [_normalize_expense_record(item) for item in (response.data or [])]

        if status_filter:
            normalized_filter = _normalize_expense_status(status_filter)
            items = [item for item in items if item.get("status") == normalized_filter]

        return items
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.post("/expenses", response_model=ExpenseResponse)
async def create_expense(
    expense: ExpenseCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new expense"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN", "CAJERO"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and cashiers can create expenses",
        )

    try:
        expense_data = expense.model_dump(mode="json")
        expense_data["status"] = "pending"  # Default status for new expenses
        response = db.table("expenses").insert(expense_data).execute()
        return _normalize_expense_record(response.data[0])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get("/expenses/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: UUID,
    db=Depends(get_db),
):
    """Get expense details"""
    try:
        response = (
            db.table("expenses")
            .select("*")
            .eq("id", str(expense_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense not found",
            )
        return _normalize_expense_record(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.patch("/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: UUID,
    expense: ExpenseUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update expense (admin only)"""
    if current_user.get("role") not in ["SUPERADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update expenses",
        )

    try:
        response = (
            db.table("expenses")
            .update(expense.model_dump(exclude_unset=True))
            .eq("id", str(expense_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense not found",
            )
        return _normalize_expense_record(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete expense (superadmin only)"""
    if current_user.get("role") != "SUPERADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can delete expenses",
        )

    try:
        db.table("expenses").delete().eq("id", str(expense_id)).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )
