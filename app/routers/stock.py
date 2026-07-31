from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Product, StockLevel, StockMovement
from app.schemas import LowStockProductResponse, RecentMovementResponse
from app.dependencies import get_current_user, require_manager
from app.models import User

router = APIRouter(prefix="/api/v1/stock", tags=["stock"])


@router.get("/low-alerts", response_model=List[LowStockProductResponse])
def low_stock_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    products = db.query(Product).join(StockLevel, Product.id == StockLevel.product_id).all()
    results = []
    for product in products:
        stock = product.stock_level
        if stock is None:
            continue
        available = stock.quantity_available
        if available <= product.reorder_point:
            criticality = "out_of_stock" if available == 0 else "low_stock"
            results.append(
                LowStockProductResponse(
                    product_id=product.id,
                    sku=product.sku,
                    name=product.name,
                    category=product.category.value,
                    quantity_available=available,
                    reorder_point=product.reorder_point,
                    criticality=criticality,
                )
            )
    results.sort(key=lambda r: (0 if r.criticality == "out_of_stock" else 1, r.quantity_available))
    return results


@router.get("/movements", response_model=List[RecentMovementResponse])
def recent_movements(
    limit: int = 15,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movements = (
        db.query(StockMovement)
        .order_by(StockMovement.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return [
        RecentMovementResponse(
            id=m.id,
            product_id=m.product_id,
            product_name=m.product.name if m.product else "Unknown",
            product_sku=m.product.sku if m.product else "",
            movement_type=m.movement_type,
            quantity=m.quantity,
            reference_number=m.reference_number,
            recorded_at=m.recorded_at,
            recorded_by=m.recorded_by or "system",
        )
        for m in movements
    ]
