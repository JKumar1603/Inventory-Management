from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Supplier, Product
from app.schemas import SupplierCreate, SupplierResponse, ProductResponse
from app.dependencies import get_current_user, require_manager
from app.models import User

router = APIRouter(prefix="/api/v1/suppliers", tags=["suppliers"])


@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    supplier_in: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    existing = db.query(Supplier).filter(Supplier.supplier_code == supplier_in.supplier_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Supplier code already exists")
    supplier = Supplier(**supplier_in.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("", response_model=List[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Supplier).filter(Supplier.is_active == True).all()


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.get("/{supplier_id}/catalog", response_model=List[ProductResponse])
def supplier_catalog(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    products = db.query(Product).filter(Product.supplier_id == supplier_id).all()
    return products
