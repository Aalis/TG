from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

@app.get("/")
def root():
    return JSONResponse(
        content={
            "message": "Welcome to Telegram Group Parser API",
            "docs": "/docs",
        }
    )

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