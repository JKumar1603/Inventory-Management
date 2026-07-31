from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import date, datetime
from app.models import Category, MovementType, POStatus


# ── Supplier ──────────────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name: str
    supplier_code: str
    contact_email: Optional[str] = None
    payment_terms_days: int = 30
    lead_time_days: int = 7


class SupplierResponse(BaseModel):
    id: int
    name: str
    supplier_code: str
    contact_email: Optional[str]
    payment_terms_days: int
    lead_time_days: int
    is_active: bool

    model_config = {"from_attributes": True}


# ── Product ───────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str
    category: Category
    unit_price: float
    cost_price: float
    unit_of_measure: str = "pieces"
    reorder_point: int = 10
    reorder_quantity: int = 50
    supplier_id: Optional[int] = None


class StockLevelResponse(BaseModel):
    quantity_on_hand: int
    quantity_reserved: int
    quantity_available: int

    model_config = {"from_attributes": True}


class StockMovementResponse(BaseModel):
    id: int
    movement_type: MovementType
    quantity: int
    reference_number: Optional[str]
    notes: Optional[str]
    recorded_at: datetime
    recorded_by: str

    model_config = {"from_attributes": True}


class ProductResponse(BaseModel):
    id: int
    sku: str
    name: str
    category: Category
    unit_price: float
    cost_price: float
    unit_of_measure: str
    reorder_point: int
    reorder_quantity: int
    supplier_id: Optional[int]
    created_at: Optional[datetime]
    stock_level: Optional[StockLevelResponse]
    movements: Optional[List[StockMovementResponse]] = []

    model_config = {"from_attributes": True}


# ── Stock Movement ────────────────────────────────────────────────────────────

class StockUpdateRequest(BaseModel):
    movement_type: MovementType
    quantity: int
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    recorded_by: str = "system"

    @field_validator("quantity")
    @classmethod
    def quantity_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v


# ── Purchase Order ────────────────────────────────────────────────────────────

class POItemCreate(BaseModel):
    product_id: int
    quantity_ordered: int
    unit_cost: float


class POCreate(BaseModel):
    supplier_id: int
    order_date: date
    expected_delivery: Optional[date] = None
    items: List[POItemCreate]


class POItemResponse(BaseModel):
    id: int
    product_id: int
    quantity_ordered: int
    unit_cost: float
    quantity_received: Optional[int]

    model_config = {"from_attributes": True}


class POResponse(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    status: POStatus
    total_amount: float
    order_date: date
    expected_delivery: Optional[date]
    received_date: Optional[date]
    created_at: Optional[datetime]
    items: List[POItemResponse] = []

    model_config = {"from_attributes": True}


class POStatusUpdate(BaseModel):
    status: POStatus


# ── Alerts ────────────────────────────────────────────────────────────────────

class StockAlertResponse(BaseModel):
    id: int
    product_id: int
    alert_type: str
    message: str
    is_resolved: bool
    triggered_at: datetime

    model_config = {"from_attributes": True}


class LowStockProductResponse(BaseModel):
    product_id: int
    sku: str
    name: str
    category: str
    quantity_available: int
    reorder_point: int
    criticality: str

    model_config = {"from_attributes": True}


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardResponse(BaseModel):
    total_products: int
    low_stock_count: int
    out_of_stock_count: int
    open_po_count: int
    total_stock_value: float


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "staff"


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    phone: Optional[str] = None
    address: Optional[str] = None

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginRequest(BaseModel):
    email: str
    password: str


# ── Recent Movements ───────────────────────────────────────────────

class RecentMovementResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_sku: str
    movement_type: MovementType
    quantity: int
    reference_number: Optional[str]
    recorded_at: datetime
    recorded_by: str
