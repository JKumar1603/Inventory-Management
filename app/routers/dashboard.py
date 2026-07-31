from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Product, StockLevel, PurchaseOrder, POStatus
from app.schemas import DashboardResponse
from app.dependencies import require_manager
from app.models import User

router = APIRouter(prefix="/api/v1", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    total_products = db.query(Product).count()

    products = db.query(Product).join(StockLevel, Product.id == StockLevel.product_id).all()
    low_stock_count = 0
    out_of_stock_count = 0
    total_stock_value = 0.0

    for product in products:
        stock = product.stock_level
        if stock is None:
            continue
        available = stock.quantity_available
        total_stock_value += available * product.cost_price
        if available == 0:
            out_of_stock_count += 1
        elif available <= product.reorder_point:
            low_stock_count += 1

    open_po_count = db.query(PurchaseOrder).filter(
        PurchaseOrder.status.in_([POStatus.draft, POStatus.submitted, POStatus.acknowledged])
    ).count()

    return DashboardResponse(
        total_products=total_products,
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        open_po_count=open_po_count,
        total_stock_value=round(total_stock_value, 2),
    )
