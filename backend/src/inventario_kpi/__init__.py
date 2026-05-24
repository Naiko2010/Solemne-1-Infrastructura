"""KPIs de inventario: lógica pura en `logic`; servicio en `service` (importar explícitamente)."""

from .logic import AggregatedInventoryKpis, aggregate_inventory_kpi_metrics, classify_inventory_band

__all__ = [
    "AggregatedInventoryKpis",
    "aggregate_inventory_kpi_metrics",
    "classify_inventory_band",
]
