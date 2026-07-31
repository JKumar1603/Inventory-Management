from datetime import date
from sqlalchemy.orm import Session
from app.models import Product, PurchaseOrder, StockLevel, StockAlert, StockMovement, MovementType, CATEGORY_PREFIXES
import structlog

logger = structlog.get_logger()
POC_ID = "POC-07"


def generate_sku(category: str, db: Session) -> str:
    prefix = CATEGORY_PREFIXES.get(category, "GEN")
    count = db.query(Product).filter(Product.sku.like(f"SKU-{prefix}-%")).count()
    return f"SKU-{prefix}-{count + 1:04d}"


def generate_po_number(db: Session) -> str:
    year = date.today().year
    count = db.query(PurchaseOrder).filter(
        PurchaseOrder.po_number.like(f"PO-{year}-%")
    ).count()
    return f"PO-{year}-{count + 1:04d}"


def check_stock_alerts(product: Product, stock: StockLevel, db: Session):
    available = stock.quantity_available
    if available == 0:
        alert = StockAlert(
            product_id=product.id,
            alert_type="out_of_stock",
            message=f"SKU {product.sku} is OUT OF STOCK.",
        )
        db.add(alert)
        logger.info(
            "low_stock_alert",
            poc_id=POC_ID,
            phase="P1",
            product_sku=product.sku,
            quantity_available=available,
            reorder_point=product.reorder_point,
        )
    elif available <= product.reorder_point:
        alert = StockAlert(
            product_id=product.id,
            alert_type="low_stock",
            message=(
                f"SKU {product.sku}: only {available} units left "
                f"(reorder point: {product.reorder_point})."
            ),
        )
        db.add(alert)
        logger.info(
            "low_stock_alert",
            poc_id=POC_ID,
            phase="P1",
            product_sku=product.sku,
            quantity_available=available,
            reorder_point=product.reorder_point,
        )


def receive_purchase_order(po_id: int, db: Session):
    from app.models import POStatus

    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        return None
    po.status = POStatus.received
    po.received_date = date.today()
    for item in po.items:
        qty = item.quantity_received or item.quantity_ordered
        item.quantity_received = qty
        stock = db.query(StockLevel).filter(StockLevel.product_id == item.product_id).first()
        if stock:
            stock.quantity_on_hand += qty
        movement = StockMovement(
            product_id=item.product_id,
            movement_type=MovementType.receipt,
            quantity=qty,
            reference_number=po.po_number,
            notes=f"Received from PO {po.po_number}",
        )
        db.add(movement)
        product = db.query(Product).filter(Product.id == item.product_id).first()
        # Resolve open low_stock/out_of_stock alerts for this product
        db.query(StockAlert).filter(
            StockAlert.product_id == item.product_id,
            StockAlert.is_resolved == False,
        ).update({"is_resolved": True})
        logger.info(
            "stock_updated",
            poc_id=POC_ID,
            phase="P1",
            product_sku=product.sku if product else "unknown",
            movement_type="receipt",
            quantity=qty,
            new_quantity_on_hand=stock.quantity_on_hand if stock else None,
        )
    db.commit()
    return po
