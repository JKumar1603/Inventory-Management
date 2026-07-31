from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Product, StockLevel, StockMovement
from app.schemas import ProductCreate, ProductResponse, StockUpdateRequest, StockMovementResponse
from app.utils import generate_sku, check_stock_alerts
from app.dependencies import get_current_user, require_manager
from app.models import User
import structlog

logger = structlog.get_logger()
POC_ID = "POC-07"

router = APIRouter(prefix="/api/v1/products", tags=["products"])


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    sku = generate_sku(product_in.category.value, db)
    product = Product(
        sku=sku,
        name=product_in.name,
        category=product_in.category,
        unit_price=product_in.unit_price,
        cost_price=product_in.cost_price,
        unit_of_measure=product_in.unit_of_measure,
        reorder_point=product_in.reorder_point,
        reorder_quantity=product_in.reorder_quantity,
        supplier_id=product_in.supplier_id,
    )
    db.add(product)
    db.flush()
    stock = StockLevel(product_id=product.id, quantity_on_hand=0, quantity_reserved=0)
    db.add(stock)
    db.commit()
    db.refresh(product)
    return product


@router.get("", response_model=List[ProductResponse])
def list_products(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Product).all()


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.patch("/{product_id}/stock", response_model=ProductResponse)
def update_stock(
    product_id: int,
    movement_in: StockUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    stock = db.query(StockLevel).filter(StockLevel.product_id == product_id).first()
    if not stock:
        stock = StockLevel(product_id=product_id)
        db.add(stock)

    from app.models import MovementType
    # Outbound movements reduce stock; inbound increase it
    outbound = {MovementType.sale, MovementType.transfer}
    if movement_in.movement_type in outbound:
        stock.quantity_on_hand = max(0, stock.quantity_on_hand - movement_in.quantity)
    else:
        stock.quantity_on_hand += movement_in.quantity

    movement = StockMovement(
        product_id=product_id,
        movement_type=movement_in.movement_type,
        quantity=movement_in.quantity,
        reference_number=movement_in.reference_number,
        notes=movement_in.notes,
        recorded_by=movement_in.recorded_by,
    )
    db.add(movement)
    db.flush()

    check_stock_alerts(product, stock, db)

    logger.info(
        "stock_updated",
        poc_id=POC_ID,
        phase="P1",
        product_sku=product.sku,
        movement_type=movement_in.movement_type.value,
        quantity=movement_in.quantity,
        new_quantity_on_hand=stock.quantity_on_hand,
    )

    db.commit()
    db.refresh(product)
    return product
