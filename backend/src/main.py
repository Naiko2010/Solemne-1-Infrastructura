from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings

app = FastAPI(
    title="Restaurant Management API",
    description="Backend API for restaurant management system",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

_cors_origins = settings.cors_origins_list
_expose_headers = ["X-Total-Count"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"] if settings.app_env == "production" else ["*"],
    expose_headers=_expose_headers,
)


# Import routes after app creation to avoid circular imports
from .api.routes import (
    auth,
    businesses,
    locals,
    categories,
    products,
    orders,
    cajas,
    mesas,
    users,
    expenses,
    transfers,
    dashboard,
    inventory_stock,
    inventory_new_product,
    providers,
    recipes,
    inventory_kpi,
    alerts,
)


_routers = [
    (auth,                   "auth"),
    (businesses,             "businesses"),
    (locals,                 "locals"),
    (categories,             "categories"),
    (products,               "products"),
    (orders,                 "orders"),
    (cajas,                  "cajas"),
    (mesas,                  "mesas"),
    (users,                  "users"),
    (expenses,               "expenses"),
    (transfers,              "transfers"),
    (dashboard,              "dashboard"),
    (inventory_stock,        "inventory-stock"),
    (inventory_new_product,  "inventory-new-product"),
    (providers,              "providers"),
    (recipes,                "recipes"),
    (inventory_kpi,          "inventory-kpis"),
    (alerts,                 "alerts"),
]

for _module, _tag in _routers:
    app.include_router(_module.router, prefix="/api", tags=[_tag])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


@app.get("/")
async def root():
    """Root endpoint - API welcome message"""
    return {
        "message": "Welcome to Restaurant Management API",
        "version": "1.0.0",
        "docs": "/api/docs",
        "health": "/health"
    }


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Favicon endpoint - prevents 404 errors"""
    from fastapi.responses import Response
    return Response(status_code=204)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_debug,
    )
