import sys
from pathlib import Path
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.valor_total_inventario.service import get_inventory_total_value


@pytest.mark.asyncio
async def test_get_inventory_total_value_sums_stock_times_price():
    local_id = uuid4()
    mock_db = MagicMock()

    def table(name):
        m = MagicMock()
        m.select.return_value = m
        m.eq.return_value = m
        m.in_.return_value = m
        if name == "inventory":
            m.execute.return_value = MagicMock(
                data=[
                    {"product_id": "p1", "stock": 2, "min_stock": 0},
                    {"product_id": "p2", "stock": 1, "min_stock": 0},
                ]
            )
        elif name == "products":
            m.execute.return_value = MagicMock(
                data=[
                    {"id": "p1", "price": 10.0},
                    {"id": "p2", "price": 5.0},
                ]
            )
        return m

    mock_db.table.side_effect = table

    with patch("src.valor_total_inventario.service.get_supabase_client", return_value=mock_db):
        result = await get_inventory_total_value(local_id)

    assert result == 25.0


@pytest.mark.asyncio
async def test_get_inventory_total_value_empty_inventory():
    local_id = uuid4()
    mock_db = MagicMock()
    inv = MagicMock()
    inv.select.return_value = inv
    inv.eq.return_value = inv
    inv.execute.return_value = MagicMock(data=[])
    mock_db.table.return_value = inv

    with patch("src.valor_total_inventario.service.get_supabase_client", return_value=mock_db):
        result = await get_inventory_total_value(local_id)

    assert result == 0.0
    mock_db.table.assert_called_once_with("inventory")
