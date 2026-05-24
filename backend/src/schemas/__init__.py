from pydantic import BaseModel, ConfigDict, Field
from typing import Literal, Optional
from uuid import UUID
from datetime import datetime
from enum import Enum


# ============= ENUMS =============

class RoleEnum(str, Enum):
    SUPERADMIN = "SUPERADMIN"
    ADMIN = "ADMIN"
    CAJERO = "CAJERO"
    EMPLEADO = "EMPLEADO"


class OrderStatusEnum(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "PREPARING"
    READY = "READY"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class PaymentMethodEnum(str, Enum):
    CASH = "CASH"
    TRANSFER = "TRANSFER"
    CARD = "CARD"
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"


class ServiceSourceEnum(str, Enum):
    DINE_IN = "dine-in"
    TAKEOUT = "takeout"


class ExpenseStatusEnum(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ExpenseCategoryEnum(str, Enum):
    SUPPLIES = "supplies"
    UTILITIES = "utilities"
    MAINTENANCE = "maintenance"
    STAFF = "staff"
    OTHER = "other"


class FinancialMovementTypeEnum(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


class TransferStatusEnum(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class RendicionStatusEnum(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# ============= USER & AUTH =============

class UserResponse(BaseModel):
    id: UUID
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    role: RoleEnum
    is_active: bool
    business_id: Optional[UUID] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: str = Field(..., min_length=1)
    name: Optional[str] = None
    phone: Optional[str] = None
    role: RoleEnum = RoleEnum.EMPLEADO
    business_id: Optional[UUID] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[RoleEnum] = None
    is_active: Optional[bool] = None


# ============= BUSINESSES =============

class BusinessCreate(BaseModel):
    name: str = Field(..., min_length=1)
    logo_url: Optional[str] = None


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None


class BusinessResponse(BaseModel):
    id: UUID
    name: str
    logo_url: Optional[str] = None

    class Config:
        from_attributes = True


# ============= LOCALS =============

class LocalCreate(BaseModel):
    business_id: Optional[UUID] = None
    name: str = Field(..., min_length=1)
    address: Optional[str] = None
    phone: Optional[str] = None


class LocalUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None


class LocalResponse(BaseModel):
    id: UUID
    business_id: UUID
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============= MESAS =============

class MesaCreate(BaseModel):
    local_id: UUID
    name: str = Field(..., min_length=1)
    capacidad: int = Field(..., gt=0, description="Capacidad máxima de personas")
    zona: str = Field(..., min_length=1, description="Zona del local")
    state: Optional[str] = Field("libre", description="libre, ocupada, en_cobro")
    is_delivery: bool = False
    is_active: bool = True


class MesaUpdate(BaseModel):
    name: Optional[str] = None
    capacidad: Optional[int] = Field(None, gt=0)
    zona: Optional[str] = None
    state: Optional[str] = Field(None, description="libre, ocupada, en_cobro")
    is_delivery: Optional[bool] = None
    is_active: Optional[bool] = None


class MesaResponse(BaseModel):
    id: UUID
    local_id: UUID
    name: str
    numero: Optional[int] = None
    capacidad: Optional[int] = None
    zona: Optional[str] = None
    state: Optional[str] = Field("libre", description="libre, ocupada, en_cobro")
    is_delivery: bool
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============= MESA DETAIL (HU-60) =============

class MesaDetailOrderItem(BaseModel):
    """Item de orden dentro de una mesa"""
    id: UUID
    product_id: Optional[UUID] = None
    product_name: Optional[str] = None
    product_description: Optional[str] = None
    quantity: int
    unit_price: int
    total_price: int

    class Config:
        from_attributes = True


class MesaDetailOrder(BaseModel):
    """Orden activa de una mesa"""
    id: UUID
    status: Optional[str] = "pending"
    payment_method: Optional[str] = None
    source: Optional[str] = None
    subtotal: int
    total: int
    items: list[MesaDetailOrderItem]
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MesaDetailResponse(BaseModel):
    """Detalle completo de una mesa con sus órdenes y KPIs (HU-60)"""
    mesa: MesaResponse
    active_orders: list[MesaDetailOrder]
    total_products: int
    total_value: int
    generated_at: datetime

    class Config:
        from_attributes = True


# ============= CAJAS =============

class CajaCreate(BaseModel):
    local_id: UUID
    name: str = Field(..., min_length=1)
    is_active: bool = True


class CajaUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class CajaResponse(BaseModel):
    id: UUID
    local_id: UUID
    name: str
    is_active: bool

    class Config:
        from_attributes = True


class UserCajaCreate(BaseModel):
    user_id: UUID
    caja_id: UUID
    is_active: bool = True


class UserCajaResponse(BaseModel):
    id: UUID
    user_id: UUID
    caja_id: UUID
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============= CATEGORIES =============

class CategoryCreate(BaseModel):
    local_id: UUID
    name: str = Field(..., min_length=1)
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: UUID
    local_id: UUID
    name: str
    is_active: bool

    class Config:
        from_attributes = True


# ============= SUPPLIERS =============

class SupplierCreate(BaseModel):
    """Alta rápida: solo `name`. Registro completo (HU-86): enviar también rut, email, etc."""

    name: str = Field(..., min_length=1)
    business_id: Optional[UUID] = None
    rut: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    start_date: Optional[str] = None


class SupplierResponse(BaseModel):
    id: UUID
    business_id: UUID
    name: str
    is_active: bool
    created_at: Optional[datetime] = None
    start_date: Optional[str] = None
    purchased_products_count: int = 0
    supplier_purchases_total_clp: int = 0
    rut: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

    class Config:
        from_attributes = True


class SupplierKpisResponse(BaseModel):
    total_suppliers: int
    active_suppliers: int
    month_purchases_clp: int
    year: int
    month: int
    period_start: str
    period_end: str


class SupplierPurchasedProductResponse(BaseModel):
    product_id: UUID
    name: str
    quantity: int
    unit_price_clp: int
    line_total_clp: int


class SupplierDetailResponse(SupplierResponse):
    payment_terms_days: Optional[int] = None
    delivery_lead_time_days: Optional[int] = None
    commercial_notes: Optional[str] = None
    purchased_products: list[SupplierPurchasedProductResponse] = []


class SupplierPatchBody(BaseModel):
    payment_terms_days: Optional[int] = Field(None, ge=0)
    delivery_lead_time_days: Optional[int] = Field(None, ge=0)
    commercial_notes: Optional[str] = None
    is_active: Optional[bool] = None


# ============= PURCHASES =============

class PurchaseCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    local_id: UUID = Field(..., alias="localId")
    supplier_id: UUID = Field(..., alias="supplierId")
    product_id: UUID = Field(..., alias="productId")
    quantity: int = Field(..., gt=0, alias="cantidad")
    unit_cost_clp: int = Field(..., ge=0, alias="costoUnitario")
    purchase_date: Optional[str] = Field(None, alias="fecha")
    notes: Optional[str] = None


class PurchaseResponse(BaseModel):
    id: UUID
    business_id: UUID
    local_id: UUID
    supplier_id: UUID
    product_id: UUID
    quantity: int
    unit_cost_clp: int
    total_clp: int
    purchase_date: str
    notes: Optional[str] = None
    new_stock: int
    created_at: Optional[datetime] = None


# ============= RECIPES =============

class RecipeIngredientInput(BaseModel):
    product_id: UUID
    quantity_required: float = Field(..., gt=0)
    unit: str = Field(default="unidad", min_length=1)


class RecipeCreate(BaseModel):
    local_id: UUID
    category_id: UUID
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    price_sale: int = Field(..., gt=0)
    yield_portions: int = Field(..., ge=1)
    ingredients: list[RecipeIngredientInput] = Field(..., min_length=1)


class RecipeUpdate(BaseModel):
    category_id: UUID
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    price_sale: int = Field(..., gt=0)
    yield_portions: int = Field(..., ge=1)
    ingredients: list[RecipeIngredientInput] = Field(..., min_length=1)
    is_active: Optional[bool] = None


class RecipeIngredientResponse(BaseModel):
    id: Optional[UUID] = None
    recipe_id: Optional[UUID] = None
    product_id: UUID
    product_name: str
    quantity_required: float
    unit: str
    unit_cost_clp: int
    ingredient_subtotal: int


class RecipeListItemResponse(BaseModel):
    id: UUID
    local_id: UUID
    business_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    category_name: Optional[str] = None
    name: str
    description: Optional[str] = None
    price_sale: int
    yield_portions: int
    is_active: bool
    version_number: int
    total_cost: int
    profit_margin_percent: float
    cost_per_portion: int
    gross_profit: int


class RecipeDetailResponse(RecipeListItemResponse):
    ingredients: list[RecipeIngredientResponse]


class RecipeKpisResponse(BaseModel):
    total_recipes: int
    active_recipes: int
    total_cost_average: int
    profit_margin_average: float


class RecipeVersionResponse(BaseModel):
    id: UUID
    recipe_id: UUID
    version_number: int
    is_active: bool
    payload: dict
    created_at: Optional[datetime] = None


class RecipeConsumeResponse(BaseModel):
    ok: bool
    recipe_id: UUID
    local_id: UUID
    quantity_sold: float
    movements: list[dict]


# ============= PRODUCTS =============

class ProductCreate(BaseModel):
    category_id: UUID
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    price: int = Field(..., gt=0)
    image_url: Optional[str] = None
    is_active: bool = True
    supplier_id: Optional[UUID] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = Field(None, gt=0)
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    supplier_id: Optional[UUID] = None


class ProductResponse(BaseModel):
    id: UUID
    category_id: UUID
    name: str
    description: Optional[str] = None
    price: int
    image_url: Optional[str] = None
    is_active: bool
    supplier_id: Optional[UUID] = None

    class Config:
        from_attributes = True


# ============= INVENTORY & STOCK =============

class InventoryCreate(BaseModel):
    local_id: UUID
    product_id: UUID
    stock: int = Field(..., ge=0)
    min_stock: int = Field(default=0, ge=0)


class InventoryUpdate(BaseModel):
    stock: Optional[int] = Field(None, ge=0)
    min_stock: Optional[int] = Field(None, ge=0)
    max_stock: Optional[int] = Field(None, ge=0)


class InventoryProductUnitCostUpdate(BaseModel):
    """Actualizar costo unitario (products.price) para recalcular total_value en listados."""

    model_config = ConfigDict(populate_by_name=True)

    unit_cost_clp: int = Field(..., gt=0, alias="unitCost")


class InventoryResponse(BaseModel):
    id: UUID
    local_id: UUID
    product_id: UUID
    stock: int
    min_stock: int
    updated_at: datetime

    class Config:
        from_attributes = True


class InventoryStockListItemResponse(BaseModel):
    inventory_id: UUID
    product_id: UUID
    category_id: UUID
    product_name: str
    category_name: str
    stock_current: int
    stock_min: int
    stock_max: Optional[int] = None
    stock_status: Optional[Literal["CRITICO", "BAJO", "OPTIMO"]] = None
    unit_cost_clp: int
    total_value: int
    supplier_id: Optional[UUID] = None
    supplier_name: Optional[str] = None


class InventoryKpisResponse(BaseModel):
    total_products: int
    optimal_stock_count: int
    low_stock_count: int
    critical_stock_count: int
    total_value: int


class InventoryProductsPageResponse(BaseModel):
    """Listado paginado de productos del inventario del local (HU-42 /products + paginación)."""

    items: list[InventoryStockListItemResponse]
    total: int
    limit: int
    offset: int


class NewProductInventoryForm(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_name: str = Field(..., min_length=1, alias="productName")
    category_name: str = Field(..., min_length=1, alias="category")
    unit: Literal["kg", "g", "L", "ml", "unidad"]
    stock_current: int = Field(..., ge=0, alias="currentStock")
    stock_min: int = Field(..., ge=0, alias="minStock")
    stock_max: int = Field(..., ge=0, alias="maxStock")
    unit_cost_clp: int = Field(..., gt=0, alias="unitCost")
    supplier_id: UUID = Field(..., alias="supplierId")


class NewProductPersistedResponse(BaseModel):
    category_id: UUID
    product_id: UUID
    inventory_id: UUID


class StockMovementCreate(BaseModel):
    product_id: UUID
    local_id: UUID
    type: str = Field(..., description="in, out, adjustment")
    quantity: int
    reason: Optional[str] = None


class StockMovementResponse(BaseModel):
    id: UUID
    product_id: UUID
    local_id: UUID
    type: str
    quantity: int
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============= ORDERS & ORDER ITEMS =============

class OrderItemCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(..., gt=0)
    unit_price: int = Field(..., gt=0)


class OrderItemUpdate(BaseModel):
    quantity: Optional[int] = Field(None, gt=0)
    unit_price: Optional[int] = Field(None, gt=0)


class OrderItemResponse(BaseModel):
    id: UUID
    order_id: UUID
    product_id: UUID
    quantity: int
    unit_price: int
    total_price: int

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    local_id: UUID
    mesa_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    caja_id: Optional[UUID] = None
    source: ServiceSourceEnum = ServiceSourceEnum.DINE_IN
    payment_method: PaymentMethodEnum
    items: list[OrderItemCreate]


class OrderUpdate(BaseModel):
    status: Optional[OrderStatusEnum] = None
    payment_method: Optional[PaymentMethodEnum] = None


class OrderResponse(BaseModel):
    id: UUID
    local_id: UUID
    mesa_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    caja_id: Optional[UUID] = None
    status: OrderStatusEnum
    payment_method: PaymentMethodEnum
    source: ServiceSourceEnum
    subtotal: int
    total: int
    created_at: datetime

    class Config:
        from_attributes = True


class OrderDetailResponse(OrderResponse):
    items: list[OrderItemResponse]


class OrderStatusHistoryCreate(BaseModel):
    status: OrderStatusEnum


class OrderStatusHistoryResponse(BaseModel):
    id: UUID
    order_id: UUID
    changed_by: Optional[UUID] = None
    status: OrderStatusEnum
    changed_at: datetime

    class Config:
        from_attributes = True


# ============= EXPENSES =============

class ExpenseCreate(BaseModel):
    local_id: UUID
    category: ExpenseCategoryEnum
    amount: int = Field(..., gt=0)
    expense_date: Optional[datetime] = None
    description: Optional[str] = None
    receipt_url: Optional[str] = None


class ExpenseUpdate(BaseModel):
    category: Optional[ExpenseCategoryEnum] = None
    amount: Optional[int] = Field(None, gt=0)
    description: Optional[str] = None
    receipt_url: Optional[str] = None
    status: Optional[ExpenseStatusEnum] = None


class ExpenseResponse(BaseModel):
    id: UUID
    local_id: UUID
    category: ExpenseCategoryEnum
    amount: int
    expense_date: datetime
    description: Optional[str] = None
    receipt_url: Optional[str] = None
    status: ExpenseStatusEnum

    class Config:
        from_attributes = True


# ============= TRANSFERS =============

class TransferCreate(BaseModel):
    local_id: UUID
    amount: int = Field(..., gt=0)
    receipt_url: Optional[str] = None


class TransferUpdate(BaseModel):
    status: Optional[TransferStatusEnum] = None
    receipt_url: Optional[str] = None


class TransferResponse(BaseModel):
    id: UUID
    local_id: UUID
    amount: int
    receipt_url: Optional[str] = None
    status: TransferStatusEnum
    created_at: datetime

    class Config:
        from_attributes = True


# ============= RENDICION =============

class RendicionCreate(BaseModel):
    local_id: UUID
    start_date: datetime
    end_date: datetime
    total_transfers: Optional[int] = None
    total_expenses: Optional[int] = None


class RendicionUpdate(BaseModel):
    status: Optional[RendicionStatusEnum] = None


class RendicionResponse(BaseModel):
    id: UUID
    local_id: UUID
    submitted_by: Optional[UUID] = None
    start_date: datetime
    end_date: datetime
    status: RendicionStatusEnum
    total_transfers: Optional[int] = None
    total_expenses: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RendicionMovementMetric(BaseModel):
    id: UUID
    movement_type: str = Field(..., description="expense or transfer")
    amount: int
    status: str
    occurred_at: datetime
    description: Optional[str] = None
    receipt_url: Optional[str] = None

    class Config:
        from_attributes = True


class RendicionesDashboardResponse(BaseModel):
    local_id: UUID
    start_date: datetime
    end_date: datetime
    approved_expenses_total: int
    pending_expenses_total: int
    completed_transfers_total: int
    pending_transfers_total: int
    net_flow: int
    movements: list[RendicionMovementMetric]
    generated_at: datetime

    class Config:
        from_attributes = True


# ============= CASH FLOW =============

class CashFlowResponse(BaseModel):
    id: UUID
    local_id: UUID
    total_income: int
    total_expense: int
    net_flow: int
    period_start: datetime
    period_end: datetime

    class Config:
        from_attributes = True


# ============= GOALS =============

class GoalCreate(BaseModel):
    local_id: UUID
    period_month: int = Field(..., ge=1, le=12)
    period_year: int = Field(..., ge=2020)
    target_amount: int = Field(..., gt=0)
    bonus_percentage: Optional[float] = Field(None, ge=0, le=100)


class GoalUpdate(BaseModel):
    target_amount: Optional[int] = Field(None, gt=0)
    bonus_percentage: Optional[float] = Field(None, ge=0, le=100)


class GoalResponse(BaseModel):
    id: UUID
    local_id: UUID
    period_month: int
    period_year: int
    target_amount: int
    bonus_percentage: Optional[float] = None

    class Config:
        from_attributes = True


# ============= RATINGS =============

class RatingCreate(BaseModel):
    order_id: UUID
    target_type: str = Field(..., description="product, service, etc")
    target_id: UUID
    stars: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class RatingResponse(BaseModel):
    id: UUID
    order_id: UUID
    client_id: Optional[UUID] = None
    target_type: str
    target_id: UUID
    stars: int
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============= ALERTS & NOTIFICATIONS =============

class AlertCreate(BaseModel):
    local_id: UUID
    type: str
    message: str = Field(..., min_length=1)


class AlertResponse(BaseModel):
    id: UUID
    local_id: UUID
    type: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    user_id: UUID
    alert_level: str = Field(..., description="info, warning, error")
    message: str = Field(..., min_length=1)


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    alert_level: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============= FINANCIAL MOVEMENTS =============

class FinancialMovementResponse(BaseModel):
    id: UUID
    local_id: UUID
    type: FinancialMovementTypeEnum
    amount: int
    source_table: str
    source_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

# ============= DASHBOARD METRICS =============

class TopProductMetric(BaseModel):
    product_id: UUID
    product_name: str
    units_sold: int
    revenue: int


class PettyCashMetric(BaseModel):
    active_cajas: int
    total_cajas: int
    pending_expenses_amount: int
    status: str


class MonthlyGoalMetric(BaseModel):
    target_amount: int
    achieved_amount: int
    progress_percentage: float
    remaining_amount: int


class ConsolidatedMetricsResponse(BaseModel):
    business_id: UUID
    local_count: int
    daily_sales: int
    monthly_sales: int
    monthly_cash_flow: int
    petty_cash: PettyCashMetric
    monthly_goal: MonthlyGoalMetric
    active_alerts: int
    top_products: list[TopProductMetric]
    generated_at: datetime

    class Config:
        from_attributes = True


# ============= POS / REPORTES (HU-64 SCRUM-468) =============

class POSReportesResponse(BaseModel):
    """Reportes básicos POS: producto más vendido y bebida más vendida."""
    local_id: UUID
    top_producto: Optional["TopProductMetric"] = None
    top_bebida: Optional["TopProductMetric"] = None
    top_5: list["TopProductMetric"] = []
    generated_at: datetime

    class Config:
        from_attributes = True


# ============= POS / MENU (HU-65 SCRUM-469) =============

class MenuProductItem(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    price: int
    is_active: bool = True

    class Config:
        from_attributes = True


class MenuCategoryGroup(BaseModel):
    id: UUID
    name: str
    product_count: int
    products: list[MenuProductItem]

    class Config:
        from_attributes = True


class POSMenuResponse(BaseModel):
    local_id: UUID
    total_products: int
    categories: list[MenuCategoryGroup]

    class Config:
        from_attributes = True


# ============= POS / MESAS KPIs =============

class MesasKPIResponse(BaseModel):
    local_id: UUID
    total: int
    libres: int
    ocupadas: int
    en_cobro: int
    generated_at: datetime

    class Config:
        from_attributes = True


# ============= LOCAL ADMIN DASHBOARD =============

class LocalAdminDashboardResponse(BaseModel):
    local: LocalResponse
    daily_sales: int
    monthly_sales: int
    monthly_cash_flow: int
    monthly_expenses: int
    monthly_transfers: int
    petty_cash: PettyCashMetric
    monthly_goal: MonthlyGoalMetric
    active_alerts: int
    top_products: list[TopProductMetric]
    cajas_count: int
    active_cajas_count: int
    generated_at: datetime

    class Config:
        from_attributes = True


# ============= WEEKLY PURCHASE ORDERS (compras semanales / HU-34) =============


class WeeklyPurchaseLineIn(BaseModel):
    product_id: UUID
    quantity_ordered: float = Field(..., gt=0)
    unit_price_clp: int = Field(..., ge=0)
    line_notes: Optional[str] = None


class WeeklyPurchaseOrderCreateBody(BaseModel):
    business_id: UUID
    local_id: Optional[UUID] = None
    supplier_id: UUID
    week_start_date: str = Field(..., min_length=8)
    items: list[WeeklyPurchaseLineIn]


class WeeklyPurchaseOrderPatchBody(BaseModel):
    status: str = Field(..., min_length=1)


class WeeklyPurchaseOrderItemsPutBody(BaseModel):
    items: list[WeeklyPurchaseLineIn]


class ReceptionPatchBody(BaseModel):
    quantity_received: float = Field(..., ge=0)


# ============= ADMINISTRATIVE ALERTS =============

class AdministrativeAlertSeverityEnum(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AdministrativeAlertStatusEnum(str, Enum):
    PENDING = "pending"
    RESOLVED = "resolved"


class AdministrativeAlertCreate(BaseModel):
    local_id: UUID
    type: str = Field(..., min_length=1)
    severity: AdministrativeAlertSeverityEnum = AdministrativeAlertSeverityEnum.MEDIUM
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1)
    metadata: Optional[dict] = None


class AdministrativeAlertResponse(BaseModel):
    id: UUID
    local_id: UUID
    type: str
    severity: AdministrativeAlertSeverityEnum
    title: str
    message: str
    status: AdministrativeAlertStatusEnum
    metadata: Optional[dict] = None
    resolved_by: Optional[UUID] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AlertEvaluationResponse(BaseModel):
    evaluated_rules: int
    alerts_created: int
    alerts: list[AdministrativeAlertResponse]


# ============= INVENTORY KPI AGGREGATE =============

class InventoryKpiAggregateResponse(BaseModel):
    local_id: UUID
    total_value: float
    total_products: int
    critical_stock_count: int
    low_stock_count: int
    medium_stock_count: int
    total_inventory_value: float
    generated_at: datetime
    metrics: list[dict] = Field(default_factory=list)

