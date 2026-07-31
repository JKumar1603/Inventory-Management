from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import engine, Base
from app.routers import products, suppliers, orders, stock, dashboard, auth
import app.logging_config  # noqa: F401 — initialises structlog
import os

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="POC-07 — Inventory Management & Procurement",
    version="1.0.0",
    description="Retail inventory management: products, stock movements, purchase orders, alerts.",
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(suppliers.router)
app.include_router(orders.router)
app.include_router(stock.router)
app.include_router(dashboard.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "poc_id": "POC-07"}


# ── Serve React SPA (must be last) ────────────────────────────
REACT_DIST = os.path.join(os.path.dirname(__file__), "frontend-react", "dist")
if os.path.isdir(REACT_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(REACT_DIST, "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str = ""):
        return FileResponse(os.path.join(REACT_DIST, "index.html"))
