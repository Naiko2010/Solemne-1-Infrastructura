"""HU-44: tests de clasificación OPTIMO | BAJO | CRITICO."""

import pytest

from src.schemas import InventoryStockStatus
from src.services.inventory_stock_service import compute_inventory_stock_status, get_inventory_kpis_for_local


@pytest.mark.parametrize(
    "stock,stock_max,expected",
    [
        (0, 100, InventoryStockStatus.CRITICO),
        (0, None, InventoryStockStatus.CRITICO),
        (50, 100, InventoryStockStatus.BAJO),
        (51, 100, InventoryStockStatus.OPTIMO),
        (100, 100, InventoryStockStatus.OPTIMO),
        (1, 2, InventoryStockStatus.BAJO),
        (2, 2, InventoryStockStatus.OPTIMO),
        (10, None, InventoryStockStatus.OPTIMO),
        (5, 0, InventoryStockStatus.OPTIMO),
    ],
)
def test_compute_inventory_stock_status(stock, stock_max, expected):
    assert compute_inventory_stock_status(stock, stock_max) == expected


def test_kpis_count_by_stock_status():
    class _Db:
        pass

    items = [
        {"stock_current": 0, "unit_cost_clp": 1, "total_value": 0, "stock_status": InventoryStockStatus.CRITICO},
        {"stock_current": 10, "unit_cost_clp": 1, "total_value": 10, "stock_status": InventoryStockStatus.BAJO},
        {"stock_current": 80, "unit_cost_clp": 1, "total_value": 80, "stock_status": InventoryStockStatus.OPTIMO},
    ]

    def fake_get_list(_db, _lid):
        return items

    import src.services.inventory_stock_service as mod

    orig = mod.get_inventory_stock_list_for_local
    mod.get_inventory_stock_list_for_local = fake_get_list
    try:
        kpis = get_inventory_kpis_for_local(_Db(), "00000000-0000-0000-0000-000000000001")
    finally:
        mod.get_inventory_stock_list_for_local = orig

    assert kpis["total_products"] == 3
    assert kpis["critical_stock_count"] == 1
    assert kpis["low_stock_count"] == 1
    assert kpis["total_value"] == 90
