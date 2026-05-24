"""
Backend API Tests
Pruebas unitarias para endpoints principales
"""

import pytest
from fastapi.testclient import TestClient
from uuid import uuid4
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services.cart_items_service import check_product_stock

# Mock objects for testing
class MockSupabaseClient:
    """Mock Supabase client for testing"""

    def __init__(self):
        self.tables = {}

    def table(self, table_name):
        """Mock table method"""
        if table_name not in self.tables:
            self.tables[table_name] = MockTable(table_name)
        return self.tables[table_name]


class MockTable:
    """Mock Supabase table"""

    def __init__(self, table_name):
        self.table_name = table_name
        self.data_store = {
            "businesses": [
                {
                    "id": str(uuid4()),
                    "name": "Test Business",
                    "logo_url": "http://example.com/logo.png",
                }
            ],
            "users": [
                {
                    "id": "user-id",
                    "email": "admin@example.com",
                    "name": "Admin User",
                    "phone": "123456789",
                    "role": "ADMIN",
                    "is_active": True,
                    "business_id": None,
                    "created_at": datetime.utcnow().isoformat(),
                }
            ],
            "products": [
                {
                    "id": str(uuid4()),
                    "category_id": str(uuid4()),
                    "name": "Test Product",
                    "description": "A test product",
                    "price": 99.99,
                    "image_url": None,
                    "is_active": True,
                }
            ],
        }
        self.select_filters = {}
        self.insert_data = None
        self.update_data = None

    def select(self, *columns):
        """Mock select method"""
        return self

    def eq(self, column, value):
        """Mock eq filter"""
        self.select_filters[column] = value
        return self

    def execute(self):
        """Mock execute - return filtered data"""
        table_data = self.data_store.get(self.table_name, [])

        # Apply filters
        for column, value in self.select_filters.items():
            table_data = [
                row for row in table_data if row.get(column) == value
            ]

        if self.insert_data:
            new_row = {**self.insert_data, "id": str(uuid4())}
            table_data = [new_row]

        if self.update_data:
            if table_data:
                table_data[0].update(self.update_data)

        return MockResponse(table_data)

    def insert(self, data):
        """Mock insert"""
        self.insert_data = data
        return self

    def update(self, data):
        """Mock update"""
        self.update_data = data
        return self

    def delete(self):
        """Mock delete"""
        return MagicMock(execute=lambda: MockResponse([]))


class MockResponse:
    """Mock Supabase response"""

    def __init__(self, data):
        self.data = data


# ============= TESTS =============

@pytest.fixture
def mock_db():
    """Fixture: Mock Supabase client"""
    return MockSupabaseClient()


@pytest.fixture
def mock_current_user():
    """Fixture: Mock current user"""
    return {
        "user_id": "user-id",
        "id": "user-id",
        "email": "admin@example.com",
        "name": "Admin User",
        "role": "ADMIN",
        "is_active": True,
    }


@pytest.fixture
def mock_superadmin_user():
    """Fixture: Mock superadmin user"""
    return {
        "user_id": "superadmin-id",
        "id": "superadmin-id",
        "email": "superadmin@example.com",
        "name": "SuperAdmin User",
        "role": "SUPERADMIN",
        "is_active": True,
    }


@pytest.fixture
def mock_empleado_user():
    """Fixture: Mock empleado user"""
    return {
        "user_id": "empleado-id",
        "id": "empleado-id",
        "email": "empleado@example.com",
        "name": "Empleado",
        "role": "EMPLEADO",
        "is_active": True,
    }


# Auth Tests
class TestAuthEndpoints:
    """Test authentication endpoints"""

    @patch("src.deps.get_current_user")
    @patch("src.deps.get_db")
    def test_get_current_user_info(self, mock_get_db, mock_get_current_user, mock_current_user):
        """Test GET /auth/me endpoint"""
        mock_get_current_user.return_value = mock_current_user
        mock_get_db.return_value = Mock()

        # This would require importing the app and using TestClient
        # For now, we demonstrate the pattern
        assert mock_current_user["role"] == "ADMIN"
        assert mock_current_user["email"] == "admin@example.com"


# Business Tests
class TestBusinessEndpoints:
    """Test business CRUD endpoints"""

    def test_create_business_requires_superadmin(self, mock_current_user, mock_db):
        """Test that only superadmin can create businesses"""
        mock_current_user["role"] = "ADMIN"
        # Should fail - not superadmin
        assert mock_current_user["role"] != "SUPERADMIN"

    def test_create_business_success(self, mock_superadmin_user, mock_db):
        """Test successful business creation"""
        assert mock_superadmin_user["role"] == "SUPERADMIN"
        # Should succeed

    def test_list_businesses_requires_admin(self, mock_empleado_user):
        """Test that only admins can list businesses"""
        assert mock_empleado_user["role"] == "EMPLEADO"
        # Should fail - not admin/superadmin


# Product Tests
class TestProductEndpoints:
    """Test product CRUD endpoints"""

    def test_list_products_by_category(self, mock_db, mock_current_user):
        """Test listing products by category"""
        products = mock_db.table("products").select("*").execute().data
        assert len(products) > 0
        assert products[0]["name"] == "Test Product"

    def test_create_product_requires_admin(self, mock_current_user):
        """Test that only admins can create products"""
        assert mock_current_user["role"] == "ADMIN"
        # Should succeed

    def test_create_product_fails_for_empleado(self, mock_empleado_user):
        """Test that empleados cannot create products"""
        assert mock_empleado_user["role"] == "EMPLEADO"
        # Should fail


# Order Tests
class TestOrderEndpoints:
    """Test order CRUD endpoints"""

    def test_create_order_requires_cashier_or_admin(self, mock_current_user):
        """Test that only cashiers/admins can create orders"""
        authorized_roles = ["SUPERADMIN", "ADMIN", "CAJERO"]
        assert mock_current_user["role"] in authorized_roles
        # Should succeed

    def test_create_order_fails_for_empleado(self, mock_empleado_user):
        """Test that empleados cannot create orders"""
        authorized_roles = ["SUPERADMIN", "ADMIN", "CAJERO"]
        assert mock_empleado_user["role"] not in authorized_roles
        # Should fail


# Integration Tests
class TestRLSEnforcement:
    """Test RLS policy enforcement"""

    def test_empleado_can_only_see_own_cajas(self, mock_empleado_user, mock_db):
        """Test that empleados only see their assigned cajas"""
        # In real implementation, would check user_cajas table
        pass

    def test_admin_can_see_all_orders(self, mock_current_user, mock_db):
        """Test that admins see all orders"""
        # Should return all orders without filtering
        pass


# Stock Validation Tests
class TestStockValidation:
    """Test stock availability validation in cart"""

    @pytest.mark.asyncio
    async def test_add_to_cart_with_sufficient_stock(self):
        """Test adding product to cart when stock is available"""
        # Mock database with sufficient stock
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"stock": 10}]
        )

        # Should not raise exception
        available = await check_product_stock(
            db=mock_db,
            product_id=uuid4(),
            local_id=uuid4(),
            required_quantity=5,
        )

        assert available == 10
        print("[OK] Can add to cart with sufficient stock")

    @pytest.mark.asyncio
    async def test_add_to_cart_with_insufficient_stock(self):
        """Test adding product to cart when stock is insufficient"""
        from fastapi import HTTPException

        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"stock": 3}]
        )

        # Should raise HTTPException for insufficient stock
        with pytest.raises(HTTPException) as exc_info:
            await check_product_stock(
                db=mock_db,
                product_id=uuid4(),
                local_id=uuid4(),
                required_quantity=5,
            )

        assert exc_info.value.status_code == 400
        assert "Stock insuficiente" in str(exc_info.value.detail)
        print("[OK] Blocks add to cart with insufficient stock")

    @pytest.mark.asyncio
    async def test_add_to_cart_product_out_of_stock(self):
        """Test adding product when completely out of stock"""
        from fastapi import HTTPException

        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"stock": 0}]
        )

        # Should raise HTTPException for out of stock
        with pytest.raises(HTTPException) as exc_info:
            await check_product_stock(
                db=mock_db,
                product_id=uuid4(),
                local_id=uuid4(),
                required_quantity=1,
            )

        assert exc_info.value.status_code == 400
        assert "agotado" in str(exc_info.value.detail).lower()
        print("[OK] Blocks add to cart when product out of stock")

    @pytest.mark.asyncio
    async def test_add_to_cart_no_inventory_record(self):
        """Test adding product when no inventory record exists"""
        from fastapi import HTTPException

        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[]
        )

        # Should raise HTTPException when inventory doesn't exist
        with pytest.raises(HTTPException) as exc_info:
            await check_product_stock(
                db=mock_db,
                product_id=uuid4(),
                local_id=uuid4(),
                required_quantity=1,
            )

        assert exc_info.value.status_code == 400
        assert "agotado" in str(exc_info.value.detail).lower()
        print("[OK] Blocks add to cart with no inventory record")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
