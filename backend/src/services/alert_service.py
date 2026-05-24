"""
Servicio de alertas administrativas.

Expone operaciones CRUD sobre la tabla administrative_alerts y el motor de
reglas que evalúa condiciones del local para generar alertas automáticas.

Reglas implementadas:
  - petty_cash_low: saldo neto de caja chica < THRESHOLD_CLP
"""

import json
from datetime import datetime, timezone
from typing import Optional

# Umbral mínimo de saldo neto en caja chica (transferencias - gastos aprobados)
PETTY_CASH_LOW_THRESHOLD_CLP = 50_000


# ── CRUD helpers ────────────────────────────────────────────────

def get_alerts(db, local_id: str, status: Optional[str] = None) -> list[dict]:
    query = (
        db.table("administrative_alerts")
        .select("*")
        .eq("local_id", local_id)
        .order("created_at", desc=True)
    )
    if status:
        query = query.eq("status", status)
    result = query.execute()
    return result.data or []


def get_alert_by_id(db, alert_id: str) -> Optional[dict]:
    result = (
        db.table("administrative_alerts")
        .select("*")
        .eq("id", alert_id)
        .execute()
    )
    return result.data[0] if result.data else None


def create_alert(db, alert_data: dict) -> Optional[dict]:
    if "metadata" in alert_data and isinstance(alert_data["metadata"], dict):
        alert_data = {**alert_data, "metadata": json.dumps(alert_data["metadata"])}
    result = db.table("administrative_alerts").insert(alert_data).execute()
    return result.data[0] if result.data else None


def resolve_alert(db, alert_id: str, resolved_by: str) -> Optional[dict]:
    result = (
        db.table("administrative_alerts")
        .update({
            "status": "resolved",
            "resolved_by": resolved_by,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", alert_id)
        .eq("status", "pending")
        .execute()
    )
    return result.data[0] if result.data else None


def count_pending_alerts(db, local_id: str) -> int:
    result = (
        db.table("administrative_alerts")
        .select("id")
        .eq("local_id", local_id)
        .eq("status", "pending")
        .execute()
    )
    return len(result.data or [])


# ── Motor de reglas ─────────────────────────────────────────────

def _has_pending_alert_of_type(db, local_id: str, alert_type: str) -> bool:
    result = (
        db.table("administrative_alerts")
        .select("id")
        .eq("local_id", local_id)
        .eq("type", alert_type)
        .eq("status", "pending")
        .execute()
    )
    return bool(result.data)


def evaluate_petty_cash_rule(db, local_id: str) -> Optional[dict]:
    """Regla: detectar saldo bajo en caja chica del local."""
    expenses_res = (
        db.table("expenses")
        .select("amount")
        .eq("local_id", local_id)
        .eq("status", "approved")
        .execute()
    )
    total_expenses = sum(float(r.get("amount", 0)) for r in (expenses_res.data or []))

    transfers_res = (
        db.table("transfers")
        .select("amount")
        .eq("local_id", local_id)
        .eq("status", "completed")
        .execute()
    )
    total_transfers = sum(float(r.get("amount", 0)) for r in (transfers_res.data or []))

    balance = total_transfers - total_expenses

    if balance >= PETTY_CASH_LOW_THRESHOLD_CLP:
        return None

    if _has_pending_alert_of_type(db, local_id, "petty_cash_low"):
        return None

    severity = "critical" if balance <= 0 else "high"
    return create_alert(db, {
        "local_id": local_id,
        "type": "petty_cash_low",
        "severity": severity,
        "title": "Saldo de caja chica bajo",
        "message": (
            f"El saldo neto de caja chica es ${int(balance):,} CLP, "
            f"por debajo del umbral mínimo de ${PETTY_CASH_LOW_THRESHOLD_CLP:,} CLP."
        ),
        "metadata": {
            "balance_clp": int(balance),
            "threshold_clp": PETTY_CASH_LOW_THRESHOLD_CLP,
            "total_transfers_clp": int(total_transfers),
            "total_expenses_clp": int(total_expenses),
        },
    })


def evaluate_all_rules(db, local_id: str) -> list[dict]:
    """Ejecuta todas las reglas de alerta para un local y retorna las alertas creadas."""
    created: list[dict] = []

    alert = evaluate_petty_cash_rule(db, local_id)
    if alert:
        created.append(alert)

    return created
