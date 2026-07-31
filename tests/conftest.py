import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from main import app

TEST_DB_URL = "sqlite:///./test_inventory.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Auth helpers ──────────────────────────────────────────────────────────────

def register_and_login(client, email="test@example.com", password="test1234", role="manager"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": password,
        "full_name": "Test User", "role": role,
    })
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ── Fixtures for common data ───────────────────────────────────────────────────

@pytest.fixture()
def manager_token(client):
    return register_and_login(client, email="manager@example.com", role="manager")


@pytest.fixture()
def staff_token(client):
    return register_and_login(client, email="staff@example.com", role="staff")


@pytest.fixture()
def supplier_id(client, manager_token):
    resp = client.post("/api/v1/suppliers", json={
        "name": "Fresh Farms", "supplier_code": "FF-001",
        "contact_email": "ff@example.com",
    }, headers=auth_headers(manager_token))
    return resp.json()["id"]


@pytest.fixture()
def product_id(client, manager_token, supplier_id):
    resp = client.post("/api/v1/products", json={
        "name": "Basmati Rice", "category": "grocery",
        "unit_price": 120.0, "cost_price": 85.0,
        "reorder_point": 20, "reorder_quantity": 100,
        "supplier_id": supplier_id,
    }, headers=auth_headers(manager_token))
    return resp.json()["id"]
