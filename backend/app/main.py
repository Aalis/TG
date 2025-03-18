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

# Health check endpoint must be defined before static file mounting
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

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Get static directory from environment variable or use default
static_dir = Path(os.getenv("STATIC_FILES_DIR", "/home/appuser/static"))

# Create the static directory if it doesn't exist
try:
    static_dir.mkdir(parents=True, exist_ok=True)
except Exception as e:
    print(f"Warning: Could not create static directory: {e}")

# Ensure index.html exists in static directory
index_path = static_dir / "index.html"
if not index_path.exists():
    try:
        # Create a temporary index.html if it doesn't exist
        index_path.write_text("""<!DOCTYPE html>
<html>
    <head>
        <title>Telegram Parser</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 2rem;
                line-height: 1.6;
                color: #333;
            }
            h1 {
                color: #2563eb;
                margin-bottom: 1rem;
            }
            p {
                margin-bottom: 1rem;
            }
            .container {
                background-color: #f8fafc;
                border-radius: 8px;
                padding: 2rem;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Application is running</h1>
            <p>The backend API is operational. Please ensure the frontend is built and copied to the static directory.</p>
            <p>API endpoints are available at <code>/api/v1/*</code></p>
        </div>
    </body>
</html>
""")
    except Exception as e:
        print(f"Warning: Could not create index.html: {e}")

# Mount static files directory for all non-API routes
try:
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
except Exception as e:
    print(f"Warning: Could not mount static directory: {e}") 