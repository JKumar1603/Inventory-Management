"""
20 test cases covering all user stories for POC-07 Phase 1.
"""
import pytest
from tests.conftest import auth_headers, register_and_login


# ── TC-01: Register a new product — SKU auto-generated ────────────────────────
def test_tc01_product_registration_sku_auto_generated(client, manager_token, supplier_id):
    resp = client.post("/api/v1/products", json={
        "name": "Sunflower Oil", "category": "grocery",
        "unit_price": 200.0, "cost_price": 140.0,
        "supplier_id": supplier_id,
    }, headers=auth_headers(manager_token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["sku"].startswith("SKU-GRO-")
    assert len(data["sku"].split("-")[-1]) == 4   # zero-padded 4 digits


# ── TC-02: SKU prefix is category-aware ───────────────────────────────────────
def test_tc02_sku_prefix_matches_category(client, manager_token):
    resp = client.post("/api/v1/products", json={
        "name": "Laptop", "category": "electronics",
        "unit_price": 50000.0, "cost_price": 40000.0,
    }, headers=auth_headers(manager_token))
    assert resp.status_code == 201
    assert resp.json()["sku"].startswith("SKU-ELC-")


# ── TC-03: Product requires auth — 401 or 403 depending on FastAPI version ────
def test_tc03_product_creation_requires_auth(client):
    resp = client.post("/api/v1/products", json={
        "name": "Soap", "category": "personal_care",
        "unit_price": 30.0, "cost_price": 20.0,
    })
    assert resp.status_code in (401, 403)


# ── TC-04: List products ──────────────────────────────────────────────────────
def test_tc04_list_products(client, manager_token, product_id):
    resp = client.get("/api/v1/products", headers=auth_headers(manager_token))
    assert resp.status_code == 200
    assert any(p["id"] == product_id for p in resp.json())


# ── TC-05: Get single product with stock level ────────────────────────────────
def test_tc05_get_product_includes_stock(client, manager_token, product_id):
    resp = client.get(f"/api/v1/products/{product_id}", headers=auth_headers(manager_token))
    assert resp.status_code == 200
    data = resp.json()
    assert "stock_level" in data
    assert data["stock_level"]["quantity_on_hand"] == 0


# ── TC-06: Stock update — receipt increases quantity ─────────────────────────
def test_tc06_stock_receipt_increases_quantity(client, manager_token, product_id):
    resp = client.patch(f"/api/v1/products/{product_id}/stock", json={
        "movement_type": "receipt", "quantity": 50,
        "notes": "Initial stock receipt",
    }, headers=auth_headers(manager_token))
    assert resp.status_code == 200
    assert resp.json()["stock_level"]["quantity_on_hand"] == 50


# ── TC-07: Stock update — sale decreases quantity ─────────────────────────────
def test_tc07_stock_sale_decreases_quantity(client, manager_token, product_id):
    # Receipt first
    client.patch(f"/api/v1/products/{product_id}/stock", json={
        "movement_type": "receipt", "quantity": 100,
    }, headers=auth_headers(manager_token))
    resp = client.patch(f"/api/v1/products/{product_id}/stock", json={
        "movement_type": "sale", "quantity": 30,
    }, headers=auth_headers(manager_token))
    assert resp.status_code == 200
    assert resp.json()["stock_level"]["quantity_on_hand"] == 70


# ── TC-08: Low stock alert created when quantity ≤ reorder_point ──────────────
def test_tc08_low_stock_alert_triggered(client, manager_token, product_id):
    # product has reorder_point=20; put stock at 15
    client.patch(f"/api/v1/products/{product_id}/stock", json={
        "movement_type": "receipt", "quantity": 15,
    }, headers=auth_headers(manager_token))
    # Verify alert endpoint returns this product
    resp = client.get("/api/v1/stock/low-alerts", headers=auth_headers(manager_token))
    assert resp.status_code == 200
    skus = [p["product_id"] for p in resp.json()]
    assert product_id in skus


# ── TC-09: Create supplier ────────────────────────────────────────────────────
def test_tc09_create_supplier(client, manager_token):
    resp = client.post("/api/v1/suppliers", json={
        "name": "Tech World", "supplier_code": "TW-999",
        "contact_email": "tw@example.com",
        "payment_terms_days": 45,
    }, headers=auth_headers(manager_token))
    assert resp.status_code == 201
    assert resp.json()["supplier_code"] == "TW-999"


# ── TC-10: Supplier catalog returns supplier's products ──────────────────────
def test_tc10_supplier_catalog(client, manager_token, supplier_id, product_id):
    resp = client.get(f"/api/v1/suppliers/{supplier_id}/catalog",
                      headers=auth_headers(manager_token))
    assert resp.status_code == 200
    assert any(p["id"] == product_id for p in resp.json())


# ── TC-11: Create purchase order — PO number auto-generated ──────────────────
def test_tc11_po_creation_auto_po_number(client, manager_token, supplier_id, product_id):
    from datetime import date
    resp = client.post("/api/v1/orders", json={
        "supplier_id": supplier_id,
        "order_date": str(date.today()),
        "items": [{"product_id": product_id, "quantity_ordered": 100, "unit_cost": 85.0}],
    }, headers=auth_headers(manager_token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["po_number"].startswith(f"PO-{date.today().year}-")
    assert data["status"] == "draft"


# ── TC-12: PO total amount calculated correctly ───────────────────────────────
def test_tc12_po_total_amount(client, manager_token, supplier_id, product_id):
    from datetime import date
    resp = client.post("/api/v1/orders", json={
        "supplier_id": supplier_id,
        "order_date": str(date.today()),
        "items": [{"product_id": product_id, "quantity_ordered": 10, "unit_cost": 100.0}],
    }, headers=auth_headers(manager_token))
    assert resp.status_code == 201
    assert resp.json()["total_amount"] == 1000.0


# ── TC-13: PO status transition draft → submitted ────────────────────────────
def test_tc13_po_status_transition(client, manager_token, supplier_id, product_id):
    from datetime import date
    create_resp = client.post("/api/v1/orders", json={
        "supplier_id": supplier_id,
        "order_date": str(date.today()),
        "items": [{"product_id": product_id, "quantity_ordered": 50, "unit_cost": 85.0}],
    }, headers=auth_headers(manager_token))
    po_id = create_resp.json()["id"]
    resp = client.patch(f"/api/v1/orders/{po_id}/status",
                        json={"status": "submitted"},
                        headers=auth_headers(manager_token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "submitted"


# ── TC-14: PO receive — stock updated, status=received ───────────────────────
def test_tc14_po_receive_updates_stock(client, manager_token, supplier_id, product_id):
    from datetime import date
    create_resp = client.post("/api/v1/orders", json={
        "supplier_id": supplier_id,
        "order_date": str(date.today()),
        "items": [{"product_id": product_id, "quantity_ordered": 60, "unit_cost": 85.0}],
    }, headers=auth_headers(manager_token))
    po_id = create_resp.json()["id"]
    # Transition to submitted first
    client.patch(f"/api/v1/orders/{po_id}/status",
                 json={"status": "submitted"},
                 headers=auth_headers(manager_token))
    resp = client.patch(f"/api/v1/orders/{po_id}/receive",
                        headers=auth_headers(manager_token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "received"
    # Check stock increased
    product_resp = client.get(f"/api/v1/products/{product_id}",
                               headers=auth_headers(manager_token))
    assert product_resp.json()["stock_level"]["quantity_on_hand"] >= 60


# ── TC-15: Receive PO from draft — should fail ───────────────────────────────
def test_tc15_receive_draft_po_fails(client, manager_token, supplier_id, product_id):
    from datetime import date
    create_resp = client.post("/api/v1/orders", json={
        "supplier_id": supplier_id,
        "order_date": str(date.today()),
        "items": [{"product_id": product_id, "quantity_ordered": 10, "unit_cost": 85.0}],
    }, headers=auth_headers(manager_token))
    po_id = create_resp.json()["id"]
    resp = client.patch(f"/api/v1/orders/{po_id}/receive",
                        headers=auth_headers(manager_token))
    assert resp.status_code == 400


# ── TC-16: Low-alerts endpoint requires manager role ─────────────────────────
def test_tc16_low_alerts_requires_manager(client, staff_token):
    resp = client.get("/api/v1/stock/low-alerts", headers=auth_headers(staff_token))
    assert resp.status_code == 403


# ── TC-17: Dashboard endpoint returns required fields ─────────────────────────
def test_tc17_dashboard_returns_fields(client, manager_token, product_id):
    resp = client.get("/api/v1/dashboard", headers=auth_headers(manager_token))
    assert resp.status_code == 200
    data = resp.json()
    for key in ("total_products", "low_stock_count", "out_of_stock_count",
                "open_po_count", "total_stock_value"):
        assert key in data


# ── TC-18: Dashboard requires manager role ────────────────────────────────────
def test_tc18_dashboard_requires_manager(client, staff_token):
    resp = client.get("/api/v1/dashboard", headers=auth_headers(staff_token))
    assert resp.status_code == 403


# ── TC-19: Stock movement history returned in product detail ──────────────────
def test_tc19_stock_movement_history(client, manager_token, product_id):
    client.patch(f"/api/v1/products/{product_id}/stock", json={
        "movement_type": "receipt", "quantity": 25, "notes": "Delivery batch A",
    }, headers=auth_headers(manager_token))
    resp = client.get(f"/api/v1/products/{product_id}", headers=auth_headers(manager_token))
    assert resp.status_code == 200
    movements = resp.json().get("movements", [])
    assert len(movements) >= 1
    assert movements[-1]["movement_type"] == "receipt"


# ── TC-20: Duplicate supplier code rejected ───────────────────────────────────
def test_tc20_duplicate_supplier_code_rejected(client, manager_token):
    payload = {"name": "Supplier A", "supplier_code": "DUP-001"}
    client.post("/api/v1/suppliers", json=payload, headers=auth_headers(manager_token))
    resp = client.post("/api/v1/suppliers", json=payload, headers=auth_headers(manager_token))
    assert resp.status_code == 400
