from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path
from .api.api import api_router
from .database import models
from .database.database import engine
from .core.config import settings

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Telegram Group Parser API",
    description="API for parsing Telegram groups",
    version="1.0.0",
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Create a static directory if it doesn't exist
static_dir = Path(__file__).parent.parent.parent / "static"
static_dir.mkdir(exist_ok=True)

# Mount static files directory
app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

@app.get("/health")
def health_check():
    """
    Health check endpoint for Railway to monitor the application.
    """
    return JSONResponse(
        content={
            "status": "healthy",
            "version": "1.0.0",
        }
    )

# Serve frontend routes by redirecting to index.html for client-side routing
@app.get("/{full_path:path}")
async def serve_frontend_routes(full_path: str):
    # API routes should be handled by the API router
    if full_path.startswith("api/") or full_path == "docs" or full_path == "redoc" or full_path == "openapi.json":
        return {"detail": "Not Found"}
        
    # Serve the index.html file for all other routes to support client-side routing
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse(status_code=404, content={"message": "Not found"}) 