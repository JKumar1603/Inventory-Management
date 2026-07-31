from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from app.database import get_db
from app.models import PurchaseOrder, POItem, POStatus, Supplier, Product, StockLevel
from app.schemas import POCreate, POResponse, POStatusUpdate
from app.utils import generate_po_number, receive_purchase_order
from app.dependencies import get_current_user, require_manager
from app.models import User
import structlog

logger = structlog.get_logger()
POC_ID = "POC-07"

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])

VALID_TRANSITIONS = {
    POStatus.draft: [POStatus.submitted, POStatus.cancelled],
    POStatus.submitted: [POStatus.acknowledged, POStatus.cancelled],
    POStatus.acknowledged: [POStatus.received, POStatus.cancelled],
}


@router.post("", response_model=POResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    po_in: POCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    supplier = db.query(Supplier).filter(Supplier.id == po_in.supplier_id, Supplier.is_active == True).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    po_number = generate_po_number(db)
    total = sum(item.quantity_ordered * item.unit_cost for item in po_in.items)

    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=po_in.supplier_id,
        status=POStatus.draft,
        total_amount=total,
        order_date=po_in.order_date,
        expected_delivery=po_in.expected_delivery,
    )
    db.add(po)
    db.flush()

    for item_in in po_in.items:
        product = db.query(Product).filter(Product.id == item_in.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_in.product_id} not found")
        db.add(POItem(
            po_id=po.id,
            product_id=item_in.product_id,
            quantity_ordered=item_in.quantity_ordered,
            unit_cost=item_in.unit_cost,
        ))

    db.commit()
    db.refresh(po)

    logger.info(
        "po_created",
        poc_id=POC_ID,
        phase="P1",
        po_number=po_number,
        supplier_id=po_in.supplier_id,
        total_amount=total,
    )
    return po


@router.get("", response_model=List[POResponse])
def list_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(PurchaseOrder).all()


@router.get("/{po_id}", response_model=POResponse)
def get_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


@router.patch("/{po_id}/status", response_model=POResponse)
def update_order_status(
    po_id: int,
    update: POStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    allowed = VALID_TRANSITIONS.get(po.status, [])
    if update.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {po.status.value} to {update.status.value}",
        )
    po.status = update.status
    db.commit()
    db.refresh(po)
    return po


@router.patch("/{po_id}/receive", response_model=POResponse)
def receive_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status not in (POStatus.submitted, POStatus.acknowledged):
        raise HTTPException(
            status_code=400,
            detail=f"PO must be submitted or acknowledged to receive (current: {po.status.value})",
        )

    result = receive_purchase_order(po_id, db)
    db.refresh(result)
    return result
